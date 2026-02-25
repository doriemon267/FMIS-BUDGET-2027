const mongoose = require("mongoose");
const Employee = require("../models/EmployeeList");
const PersonnelService = require('../models/PersonnelServices');
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
} = require("../utils/controller_get_process");
exports.getAllEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      Department,
      positionTitle,
      Division,
      Section,
      region, // Changed from Region to region to match client-side parameter
      StatusOfAppointment,
      sg,
      step,
      jg,
      Rate,
      charging,
      employeeID,
      EmployeeFullName,
      DateOfAppointment,
      DateOfBirth,
      Status,
      processBy, // Add processBy parameter for additional access control
    } = req.query;
    // Get filters from middleware - prioritize submission workflow filters over hierarchical filters
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};

    // Use submission workflow filters if available (they include status filtering), otherwise use hierarchical filters
    const activeFilters = Object.keys(submissionWorkflowFilters).length > 0 ? submissionWorkflowFilters : hierarchicalFilters;

    // Budget Preparer / workflow user without Department/Division assignment cannot see employee list (would see other depts' data)
    if (activeFilters.__noScope || hierarchicalFilters.__noScope) {
      return res.status(403).json({
        success: false,
        message: 'No Department/Division assigned for your account. You can only view employees within your assigned scope. Please contact the administrator to set your Hierarchical User Assignment (HUA).',
        code: 'NO_SCOPE_ASSIGNMENT'
      });
    }

    // ENFORCE HIERARCHICAL ACCESS CONTROL
    // Get user's assignment level to determine access restrictions
    const assignment = req.userHierarchicalAssignment || {};
    const userLevel = assignment.assignmentLevel || 'NONE';

    // Declare variables needed for access control
    const assignedRegions = Array.isArray(assignment.regions) ? assignment.regions : [];
    const hasRequestedRegionAccess = region ? assignedRegions.some(r => {
      const rn = (r.Region || r.regionName || r.name || '').trim();
      return rn && (rn.localeCompare(region.trim(), undefined, { sensitivity: 'accent' }) === 0 || new RegExp(`^${region.trim()}$`, 'i').test(rn));
    }) : false;

    // For Division and Department level users, strictly enforce their assigned scope
    // They should NOT be able to see employees outside their division/department
    const isDivisionOrDeptLevel = ['DIVISION', 'DEPARTMENT', 'DIVISION_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'RESPONSIBILITY_CENTER', 'OFFICE'].includes(userLevel);
    if (isDivisionOrDeptLevel) {
      // Override any region parameter - they can only see their assigned scope
      if (region && !hasRequestedRegionAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied: You can only view employees from your assigned ${userLevel.toLowerCase()}`,
          code: 'HIERARCHICAL_ACCESS_VIOLATION'
        });
      }
    }

    // Map filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.Region = condition.region;
          if (condition.department) conditionMapped.Department = condition.department;
          if (condition.division) conditionMapped.Division = condition.division;
          if (condition.status) conditionMapped.Status = condition.status;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      if (filters.status) mapped.Status = filters.status;
      return mapped;
    };

    const dbFilters = mapFiltersToDb(activeFilters);
    // Start with active filters as base
    let query = { ...dbFilters };

    // processBy = "additional access": show employees in scope OR employees the user processed (same logic as getEmployeeStats)
    if (processBy && Object.keys(dbFilters).length > 0) {
      query = {
        $or: [
          dbFilters,
          { processBy: processBy },
          { createdBy: processBy }
        ]
      };
    }

    // Apply StatusOfAppointment filter early if provided
    if (StatusOfAppointment) {
      if (query.$and) {
        query.$and.push({ StatusOfAppointment: StatusOfAppointment });
      } else if (Object.keys(query).length > 0) {
        query = {
          $and: [query, { StatusOfAppointment: StatusOfAppointment }]
        };
      } else {
        query.StatusOfAppointment = StatusOfAppointment;
      }
    }

    // If no active filters and no processBy, require region parameter (except for FULL access users)
    if (!Object.keys(dbFilters).length && !processBy && !region && userLevel !== 'FULL' && userLevel !== 'BUDGET_AND_REVENUE_DIVISION') {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view employees"
      });
    }
    // Allow requested region to override hierarchical Region if user has access to it

    if (region) {
      // For REGION level users, allow region switching within their assigned regions
      if (userLevel === 'REGION') {
        if (query.$or) {
          query.$or = query.$or.map(condition => ({
            ...condition,
            Region: region
          }));
        } else if (!query.Region) {
          // No hierarchical region set, use requested region
          query.Region = region;
        } else if (hasRequestedRegionAccess) {
          // User has access to requested region, override hierarchical Region to match UI selection
          query.Region = region;
        }
      } else if (userLevel === 'DIVISION' || userLevel === 'DEPARTMENT') {
        // For Division/Department level users, they can only see their assigned scope
        // Region parameter is ignored - they stay within their hierarchical constraints
      } else if (userLevel === 'FULL' || userLevel === 'BUDGET_AND_REVENUE_DIVISION') {
        // For FULL access users, do not restrict by region - they can see all employees
        // Region parameter is ignored for full access
      } else {
        // For other levels (NONE), use region parameter if provided
        if (!query.Region) {
          query.Region = region;
        }
      }
    }
    // Add search functionality if provided
    if (search) {
      const searchConditions = {
        $or: [
          { Department: { $regex: search, $options: "i" } },
          { positionTitle: { $regex: search, $options: "i" } },
          { Division: { $regex: search, $options: "i" } },
          { Section: { $regex: search, $options: "i" } },
          { StatusOfAppointment: { $regex: search, $options: "i" } },
          { EmployeeFullName: { $regex: search, $options: "i" } },
          { employeeID: { $regex: search, $options: "i" } },
          { Status: { $regex: search, $options: "i" } },
        ]
      };

      // Combine access conditions with search
      if (query.$or) {
        query = {
          $and: [
            { $or: query.$or },
            searchConditions
          ]
        };
      } else if (Object.keys(dbFilters).length > 0) {
        query = {
          $and: [
            dbFilters,
            searchConditions
          ]
        };
      } else if (region && userLevel !== 'FULL' && userLevel !== 'BUDGET_AND_REVENUE_DIVISION') {
        query = {
          $and: [
            { Region: region },
            searchConditions
          ]
        };
      } else {
        // For FULL access users or when no region is specified, search across all employees
        query = searchConditions;
      }
    }
    // Apply other filters while preserving hierarchical filters
    const filterParams = {
      positionTitle,
      jg,
      charging,
      employeeID,
      EmployeeFullName,
      Department,
      Division,
      Section,
      Status,
    };
    // Remove undefined values
    Object.keys(filterParams).forEach(key => {
      if (filterParams[key] === undefined) {
        delete filterParams[key];
      }
    });
    // Apply text filters if there are any
    if (Object.keys(filterParams).length > 0) {
      const textFilterQuery = {};
      textFilter(textFilterQuery, filterParams);
      if (Object.keys(textFilterQuery).length > 0) {
        if (query.$and) {
          query.$and.push(textFilterQuery);
        } else if (query.$or) {
          query = {
            $and: [
              { $or: query.$or },
              textFilterQuery
            ]
          };
        } else if (Object.keys(dbFilters).length > 0) {
          query = {
            $and: [dbFilters, textFilterQuery]
          };
        } else {
          query = {
            $and: [{ Region: region }, textFilterQuery]
          };
        }
      }
    }
    // Apply number filters
    const numberParams = { sg, step, Rate };
    Object.keys(numberParams).forEach(key => {
      if (numberParams[key] === undefined) {
        delete numberParams[key];
      }
    });
    if (Object.keys(numberParams).length > 0) {
      const numberFilterQuery = {};
      numberFilter(numberFilterQuery, numberParams, operator);
      if (Object.keys(numberFilterQuery).length > 0) {
        if (query.$and) {
          query.$and.push(numberFilterQuery);
        } else if (query.$or) {
          query = {
            $and: [
              { $or: query.$or },
              numberFilterQuery
            ]
          };
        } else if (Object.keys(dbFilters).length > 0) {
          query = {
            $and: [dbFilters, numberFilterQuery]
          };
        } else {
          query = {
            $and: [{ Region: region }, numberFilterQuery]
          };
        }
      }
    }
    // Apply date filters
    const dateParams = { DateOfAppointment, DateOfBirth };
    Object.keys(dateParams).forEach(key => {
      if (dateParams[key] === undefined) {
        delete dateParams[key];
      }
    });
    if (Object.keys(dateParams).length > 0) {
      const dateFilterQuery = {};
      dateFilter(dateFilterQuery, dateParams);
      if (Object.keys(dateFilterQuery).length > 0) {
        if (query.$and) {
          query.$and.push(dateFilterQuery);
        } else if (query.$or) {
          query = {
            $and: [
              { $or: query.$or },
              dateFilterQuery
            ]
          };
        } else if (Object.keys(dbFilters).length > 0) {
          query = {
            $and: [dbFilters, dateFilterQuery]
          };
        } else {
          query = {
            $and: [{ Region: region }, dateFilterQuery]
          };
        }
      }
    }
    // );
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    const pageNum = Math.max(1, Number(page));

    // Handle "All" option - if limit is -1 or very large, don't apply pagination
    const limitNum = limit === -1 || Number(limit) > 10000 ? null : Math.max(1, Number(limit));
    const skip = limitNum ? (pageNum - 1) * limitNum : 0;
    // DIRECT APPROACH: Use the raw MongoDB driver to ensure we're using the correct collection
    const db = mongoose.connection.db;
    const collection = db.collection('employees'); // This is the actual collection name
    // Normalize Region and Department filters for case-insensitive exact match
    const normalizeExact = (v) => {
      if (typeof v === 'string' && v.trim()) return { $regex: new RegExp(`^${v.trim()}$`, 'i') };
      return v;
    };
    if (query.Region && typeof query.Region === 'string') {
      query.Region = normalizeExact(query.Region);
    } else if (!query.Region && region) {
      // Ensure Region gets set when only hierarchicalFilters had CENTRAL OFFICE
      query.Region = normalizeExact(region);
    }
    if (query.Department && typeof query.Department === 'string') {
      query.Department = normalizeExact(query.Department);
    }
    if (query.Division && typeof query.Division === 'string') {
      const d = query.Division.trim();
      if (!d) delete query.Division; // drop empty division filters
      else query.Division = normalizeExact(d);
    }
    // Execute the query
    let queryBuilder = collection.find(query).skip(skip).sort(sortQuery);

    // Only apply limit if not showing all records
    if (limitNum) {
      queryBuilder = queryBuilder.limit(limitNum);
    }

    const employees = await queryBuilder.toArray();
    if (employees.length > 0) {
      }
    // Double-check that all returned employees belong to the requested region (case-insensitive exact)
    const verifiedEmployees = region
      ? employees.filter(emp => {
          const empRegion = (emp.Region || '').trim();
          return empRegion.localeCompare(region.trim(), undefined, { sensitivity: 'accent' }) === 0 ||
                 new RegExp(`^${region.trim()}$`, 'i').test(empRegion);
        })
      : employees;
    if (employees.length !== verifiedEmployees.length) {
      // SECURITY WARNING: Found employees with region mismatch
    }
    // Get total count for pagination
    const totalRecords = await collection.countDocuments(query);
    const response = {
      employees: verifiedEmployees,
      totalPages: limitNum ? Math.ceil(totalRecords / limitNum) : 1,
      currentPage: limitNum ? pageNum : 1,
      totalRecords: totalRecords,
      region,
      queryUsed: query,
      debug: {
        originalEmployeeCount: employees.length,
        verifiedEmployeeCount: verifiedEmployees.length,
        hierarchicalFilters: dbFilters,
        requestedRegion: region,
        note: 'Region/Department/Division are matched case-insensitively and Division omitted when empty.'
      }
    };
    return res.json(response);
  } catch (e) {
    // Error in getAllEmployees
    return res.status(500).json({ 
      error: "Something went wrong.",
      message: e.message,
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};
exports.addEmployee = async (req, res) => {
  try {
    // If fiscal year is not provided in the request, get it from active settings
    if (!req.body.fiscalYear) {
      const Settings = require("../models/Settings");
      const activeSettings = await Settings.findOne({ isActive: true }).lean();
      if (!activeSettings?.fiscalYear) {
        return res.status(400).json({ 
          error: "No active fiscal year found",
          message: "Please set up the fiscal year in settings first"
        });
      }
      req.body.fiscalYear = activeSettings.fiscalYear;
    }
    // Validate Region field
    if (!req.body.Region) {
      return res.status(400).json({
        error: "Region is required",
        message: "Please specify a region for the employee"
      });
    }

    // Add processBy field to track who added the employee
    req.body.processBy = req.user._id;

    const newEmployee = new Employee(req.body);
    await newEmployee.save();
    return res.status(201).json({
      message: "Employee created successfully.",
      employee: newEmployee,
    });
  } catch (error) {
    // Error creating employee
    return res.status(500).json({ error: "Failed to create employee." });
  }
};
exports.editEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Get the existing employee to preserve processBy if not set
    const existingEmployee = await Employee.findById(id);
    if (!existingEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    // Preserve the original processBy if not provided in the update
    if (!req.body.processBy) {
      req.body.processBy = existingEmployee.processBy;
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    return res.json({
      message: "Employee updated successfully.",
      employee: updatedEmployee,
    });
  } catch (error) {
    // Error updating employee
    return res.status(500).json({ error: "Failed to update employee." });
  }
};
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEmployee = await Employee.findByIdAndDelete(id);
    if (!deletedEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    return res.json({ message: "Employee deleted successfully." });
  } catch (error) {
    // Error deleting employee
    return res.status(500).json({ error: "Failed to delete employee." });
  }
};
exports.getPersonnels = async (req, res) => {
  try {
    const { search, region, fiscalYear } = req.query;
    let query = {};
    
    // Add region and fiscal year filters if provided
    if (region) query.region = region;
    if (fiscalYear) query.fiscalYear = fiscalYear;
    
    if (search) {
      query.$or = [
        { EmployeeFullName: { $regex: search, $options: "i" } },
        { employeeFullName: { $regex: search, $options: "i" } },
        { employeeID: { $regex: search, $options: "i" } },
        { employeeNumber: { $regex: search, $options: "i" } },
        { Department: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { positionTitle: { $regex: search, $options: "i" } },
        { PositionTitle: { $regex: search, $options: "i" } },
        { Status: { $regex: search, $options: "i" } },
      ];
    }
    
    let employees = await PersonnelService.find(query).limit(500);
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    const userRoles = req.user?.Roles || [];
    
    // Check if user has special roles that bypass filtering
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));
    
    if (!isSuperAdmin && !isBudgetManager && userIdString) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department;
          const assignedRegion = userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region;
          const assignedDivision = userAssignment.divisionName;
          
          const filteredEmployees = employees.filter(emp => {
            // CASE 1: User assigned at DIVISION level
            if (assignedDivision && userAssignment.assignmentLevel === 'DIVISION') {
              return emp.division === assignedDivision;
            }
            
            // CASE 2: User assigned at DEPARTMENT level
            if (assignedDepartment && (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'OFFICE')) {
              return (emp.Department || emp.department) === assignedDepartment;
            }
            
            // CASE 3: User assigned at REGION level
            if (assignedRegion && userAssignment.assignmentLevel === 'REGION') {
              return emp.region === assignedRegion;
            }
            
            // CASE 4: Full access
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            
            return false;
          });
          
          if (filteredEmployees.length > 0 || userAssignment.assignmentLevel !== 'FULL') {
            employees = filteredEmployees;
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getPersonnels:', err.message);
      }
    }
    
    const formattedEmployees = employees.map((emp) => ({
      _id: emp._id,
      employeeNumber: emp.employeeNumber,
      employeeFullName: emp.EmployeeFullName || emp.employeeFullName || "",
      positionTitle: emp.PositionTitle || emp.positionTitle || "",
      department: emp.Department || emp.department || "",
      status: emp.Status || "Active",
    }));
    return res.json(formattedEmployees);
  } catch (error) {
    console.error('[getPersonnels] Error:', error);
    return res.status(500).json({ error: "Failed to fetch personnel data" });
  }
};
// Get employees eligible for loyalty pay based on years of service
exports.getEligibleForLoyaltyPay = async (req, res) => {
  try {
    // // Get the region and fiscal year from the query parameters
    const { region, fiscalYear: requestedFiscalYear } = req.query;
    
    // If no region provided but hierarchical filters exist, we can proceed
    if (!region && (!req.hierarchicalFilters || Object.keys(req.hierarchicalFilters).length === 0)) {
      return res.status(400).json({ 
        error: "Region parameter is required", 
        message: "Please specify a region to view eligible employees" 
      });
    }
    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};
    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };
    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);
    // Start with hierarchical filters as base
    const baseFilters = { ...dbHierarchicalFilters };
    // // Get active settings to determine the fiscal year
    const Settings = require("../models/Settings");
    const {
      calculateLoyaltyPayYearsOfService,
      getEligibleLoyaltyPayYear
    } = require("../utils/loyaltyPayUtils");
    // If a specific fiscal year was requested, find those settings
    // Otherwise use the active settings
    let settings;
    if (requestedFiscalYear) {
      settings = await Settings.findOne({ fiscalYear: requestedFiscalYear }).lean();
      if (!settings) {
        return res.status(404).json({
          error: "Fiscal year settings not found",
          message: `No settings found for fiscal year ${requestedFiscalYear}`
        });
      }
    } else {
      settings = await Settings.findOne({ isActive: true }).lean();
    }
    if (!settings) {
      return res.status(404).json({
        error: "Settings not found",
        message: "No active settings found in the system"
      });
    }
    // Use fiscal year from settings
    const fiscalYear = parseInt(settings.fiscalYear);
    // // Get cutoff date from settings
    const cutoffDate = settings?.loyaltyPay?.cutoffDate || "06-22";
    // // First try to get data from PersonnelServices model, filtered by hierarchical access
    const personnelQuery = {
      employeeStatus: "Active",
      DateOfAppointment: { $exists: true, $ne: null },
      ...baseFilters // Apply hierarchical filters
    };
    const personnelServices = await PersonnelService.find(personnelQuery).lean();
    // Filter employees based on years of service with June 22 cutoff
    const eligibleEmployees = [];
    for (const employee of personnelServices) {
      if (!employee.DateOfAppointment) continue;
      // Calculate years of service with June 22 cutoff
      const yearsOfService = calculateLoyaltyPayYearsOfService(
        employee.DateOfAppointment,
        fiscalYear.toString(),
        cutoffDate
      );
      // Get the eligible loyalty pay year (milestone) - must be exact match
      const eligibleYear = getEligibleLoyaltyPayYear(yearsOfService);
      // // Only include employees who have reached a milestone year
      if (eligibleYear !== null) {
        // Check if this employee already received loyalty pay for this milestone in this fiscal year
        const LoyaltyPay = require("../models/loyaltyPay");
        const existingRecord = await LoyaltyPay.findOne({
          employeeNumber: employee.employeeNumber,
          yearsInService: eligibleYear,
          fiscalYear: fiscalYear.toString()
        }).lean();
        if (!existingRecord) {
          eligibleEmployees.push({
            ...employee,
            yearsInService: eligibleYear,
            actualYearsOfService: yearsOfService // Include actual years for reference
          });
        } else {
          // Employee already received loyalty pay for this milestone
        }
      }
    }
    // // Format the response
    const formattedEmployees = eligibleEmployees.map(emp => ({
      _id: emp._id,
      employeeNumber: emp.employeeNumber,
      employeeFullName: emp.employeeFullName,
      positionTitle: emp.positionTitle,
      department: emp.department,
      division: emp.division,
      region: emp.region,
      dateOfAppointment: emp.DateOfAppointment,
      yearsInService: emp.yearsInService,
      actualYearsOfService: emp.actualYearsOfService,
      cutoffDate: cutoffDate, // Include cutoff date for reference
      fiscalYear: fiscalYear.toString() // Include fiscal year for reference
    }));
    return res.status(200).json(formattedEmployees);
  } catch (err) {
    // Error getting eligible employees for loyalty pay
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get employees eligible for retirement
// Get employee statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};
    if (hierarchicalFilters.__noScope) {
      return res.status(403).json({
        error: "No scope assigned",
        message: "No Department/Division assigned for your account. Please contact the administrator to set your Hierarchical User Assignment (HUA).",
        code: "NO_SCOPE_ASSIGNMENT"
      });
    }
    const { region, processBy } = req.query;

    // Use hierarchical filters as base, or fall back to region filter
    let baseFilters = { ...hierarchicalFilters };
    if (!Object.keys(hierarchicalFilters).length && region) {
      baseFilters.Region = region;
    }

    // Add processBy condition for additional access control
    let accessConditions = [];
    if (Object.keys(hierarchicalFilters).length > 0) {
      accessConditions.push(hierarchicalFilters);
    }
    if (processBy) {
      accessConditions.push({ processBy: processBy });
    }

    // If we have access conditions, use OR logic
    if (accessConditions.length > 0) {
      baseFilters = { $or: accessConditions };
    }

    if (!Object.keys(baseFilters).length && !processBy) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view employee statistics"
      });
    }
    // DIRECT APPROACH: Use the raw MongoDB driver to ensure we're using the correct collection
    const db = mongoose.connection.db;
    const collection = db.collection('employees'); // This is the actual collection name
    // Normalize for case-insensitive exact matching and omit empty Division
    const norm = (v) => (typeof v === 'string' && v.trim()) ? { $regex: new RegExp(`^${v.trim()}$`, 'i') } : v;
    const filtersCi = {};

    // Handle OR-based filters for processBy access control
    if (baseFilters.$or) {
      filtersCi.$or = baseFilters.$or.map(condition => {
        // Handle nested $and conditions from middleware
        if (condition.$and && Array.isArray(condition.$and)) {
          return {
            $and: condition.$and.map(subCondition => {
              const normalizedSubCondition = {};
              if (subCondition.region) normalizedSubCondition.Region = norm(subCondition.region);
              if (subCondition.department) normalizedSubCondition.Department = norm(subCondition.department);
              if (subCondition.division) {
                const d = subCondition.division.trim();
                if (d) normalizedSubCondition.Division = norm(d);
              }
              return normalizedSubCondition;
            })
          };
        }
        // Handle simple conditions
        const normalizedCondition = {};
        if (condition.region) normalizedCondition.Region = norm(condition.region);
        if (condition.department) normalizedCondition.Department = norm(condition.department);
        if (condition.division) {
          const d = condition.division.trim();
          if (d) normalizedCondition.Division = norm(d);
        }
        if (condition.processBy) normalizedCondition.processBy = condition.processBy;
        return normalizedCondition;
      });
    } else {
      // Handle direct $and conditions from middleware (when no processBy)
      if (baseFilters.$and && Array.isArray(baseFilters.$and)) {
        filtersCi.$and = baseFilters.$and.map(condition => {
          const normalizedCondition = {};
          if (condition.region) normalizedCondition.Region = norm(condition.region);
          if (condition.department) normalizedCondition.Department = norm(condition.department);
          if (condition.division) {
            const d = condition.division.trim();
            if (d) normalizedCondition.Division = norm(d);
          }
          return normalizedCondition;
        });
      } else {
        // Handle simple key-value filters
        if (baseFilters.region) filtersCi.Region = norm(baseFilters.region);
        if (baseFilters.department) filtersCi.Department = norm(baseFilters.department);
        if (baseFilters.division) {
          const d = baseFilters.division.trim();
          if (d) filtersCi.Division = norm(d);
        }
      }
    }

    const departmentFilter = req.query.Department || req.query.department;
    const divisionFilter = req.query.Division || req.query.division;

    const applyScopedFilter = (key, value) => {
      if (!value) return;
      const normalizedValue = norm(value);
      if (!normalizedValue) return;

      if (filtersCi.$or) {
        filtersCi.$or = filtersCi.$or.map(condition => ({
          ...condition,
          [key]: normalizedValue,
        }));
      } else if (filtersCi.$and) {
        filtersCi.$and = filtersCi.$and.map(condition => ({
          ...condition,
          [key]: normalizedValue,
        }));
      } else {
        filtersCi[key] = normalizedValue;
      }
    };

    // Add region filter to all conditions if specified
    if (region) {
      if (filtersCi.$or) {
        filtersCi.$or = filtersCi.$or.map(condition => ({
          ...condition,
          Region: norm(region)
        }));
      } else {
        filtersCi.Region = norm(region);
      }
    }

    applyScopedFilter('Department', departmentFilter);
    applyScopedFilter('Division', divisionFilter);
    // Count total employees with hierarchical filters
    const total = await collection.countDocuments(filtersCi);
    // Derive active/inactive using the same filtersCi + status
    const active = await collection.countDocuments({ 
      ...filtersCi,
      employeeStatus: "Active"
    });
    const inactive = await collection.countDocuments({ 
      ...filtersCi,
      employeeStatus: "Inactive"
    });
    // Get region counts
    const uniqueRegions = await collection.distinct('Region', filtersCi);
    const regionCounts = {};
    for (const r of uniqueRegions) {
      if (r) {
        regionCounts[r] = await collection.countDocuments({ Region: r, ...filtersCi });
      }
    }
    res.status(200).json({
      total,
      active,
      inactive,
      region,
      regionCounts
    });
  } catch (error) {
    // Error in getEmployeeStats
    res.status(500).json({ error: error.message });
  }
};
exports.getEligibleForRetirement = async (req, res) => {
  try {
    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};
    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.Region = condition.region;
          if (condition.department) conditionMapped.Department = condition.department;
          if (condition.division) conditionMapped.Division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      return mapped;
    };
    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);
    // Get active settings to determine the fiscal year
    const Settings = require("../models/Settings");
    const activeSettings = await Settings.findOne({ isActive: true }).lean();
    // Use fiscal year from settings, or fallback to current year
    const fiscalYear = activeSettings?.fiscalYear
      ? parseInt(activeSettings.fiscalYear)
      : new Date().getFullYear();
    const currentDate = new Date();
    // First try to get data from PersonnelServices model with hierarchical filters
    const personnelQuery = {
      employeeStatus: "Active",
      DateOfAppointment: { $exists: true, $ne: null },
      DateOfBirth: { $exists: true, $ne: null },
      ...dbHierarchicalFilters // Apply hierarchical filters
    };
    const personnelServices = await PersonnelService.find(personnelQuery).lean();
    // Filter employees based on age and years of service
    const eligibleEmployees = [];
    for (const employee of personnelServices) {
      if (!employee.DateOfAppointment || !employee.DateOfBirth) continue;
      // Calculate age more accurately
      const birthDate = new Date(employee.DateOfBirth);
      let age = currentDate.getFullYear() - birthDate.getFullYear();
      const monthDiff = currentDate.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < birthDate.getDate())) {
        age--;
      }
      // Calculate years of service more accurately
      const appointmentDate = new Date(employee.DateOfAppointment);
      let yearsOfService = currentDate.getFullYear() - appointmentDate.getFullYear();
      const serviceMonthDiff = currentDate.getMonth() - appointmentDate.getMonth();
      if (serviceMonthDiff < 0 || (serviceMonthDiff === 0 && currentDate.getDate() < appointmentDate.getDate())) {
        yearsOfService--;
      }
      // Check if employee is eligible for compulsory retirement (65 years old)
      const isEligibleForCompulsory = age >= 65;
      // Check if employee is eligible for optional retirement (60-64 years old with at least 15 years of service)
      const isEligibleForOptional = (age >= 60 && age < 65) && yearsOfService >= 15;
      // }, Appointment: ${appointmentDate.toDateString()}`);
      // Include employees who are eligible for either type of retirement
      if (isEligibleForCompulsory || isEligibleForOptional) {
        eligibleEmployees.push({
          ...employee,
          age,
          yearsOfService,
          retirementType: isEligibleForCompulsory ? "Compulsory" : "Optional",
          earnedLeaves: employee.earnedLeaves || 0 // Include earned leaves for terminal leave calculation
        });
      }
    }
    // We now use ONLY PersonnelServices (no EmployeeList fallback)
    // Format the response with proper employee number format
    const formattedEmployees = eligibleEmployees.map(emp => {
      // Get the correct employee number
      let employeeNum = "";
      // Try to get the employee number from various possible fields
      if (emp.employeeNumber) {
        employeeNum = emp.employeeNumber;
      } else if (emp.EmployeeID) {
        employeeNum = emp.EmployeeID;
      } else if (emp.employeeID) {
        employeeNum = emp.employeeID;
      }
      // return {
      const employeeData = {
        _id: emp._id,
        employeeNumber: employeeNum, // This should be a string like "336155"
        employeeFullName: emp.employeeFullName || emp.EmployeeFullName || "",
        positionTitle: emp.positionTitle || emp.PositionTitle || "",
        department: emp.department || emp.Department || "",
        division: emp.division || emp.Division || "",
        region: emp.region || emp.Region || "",
        age: emp.age,
        yearsOfService: emp.yearsOfService,
        retirementType: emp.retirementType,
        earnedLeaves: emp.earnedLeaves || 0 // Include earned leaves for terminal leave calculation
      };
      return employeeData;
    });
    // Log the formatted employees to verify the employee number format
    return res.status(200).json(formattedEmployees);
  } catch (err) {
    // Error getting eligible employees for retirement
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
