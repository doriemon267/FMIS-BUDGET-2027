const mongoose = require("mongoose");
const Employee = require("../models/EmployeeList");
const PersonnelServices = require("../models/personnelServices");
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
    } = req.query;
    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};
    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      return mapped;
    };
    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);
    // Start with hierarchical filters as base
    let query = { ...dbHierarchicalFilters };
    // If no hierarchical filters, require region parameter
    if (!Object.keys(dbHierarchicalFilters).length && !region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view employees"
      });
    }
    // Allow requested region to override hierarchical Region if user has access to it
    const assignment = req.userHierarchicalAssignment || {};
    const assignedRegions = Array.isArray(assignment.regions) ? assignment.regions : [];
    const hasRequestedRegionAccess = region ? assignedRegions.some(r => {
      const rn = (r.Region || r.regionName || r.name || '').trim();
      return rn && (rn.localeCompare(region.trim(), undefined, { sensitivity: 'accent' }) === 0 || new RegExp(`^${region.trim()}$`, 'i').test(rn));
    }) : false;
    if (region) {
      if (!dbHierarchicalFilters.Region) {
        // No hierarchical region set, use requested region
        query.Region = region;
      } else if (hasRequestedRegionAccess) {
        // User has access to requested region, override hierarchical Region to match UI selection
        query.Region = region;
        } else {
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
      // Combine hierarchical filters with search
      if (Object.keys(dbHierarchicalFilters).length > 0) {
        query = {
          $and: [
            dbHierarchicalFilters,
            searchConditions
          ]
        };
      } else {
        query = {
          $and: [
            { Region: region },
            searchConditions
          ]
        };
      }
    }
    // Apply other filters while preserving hierarchical filters
    const filterParams = {
      positionTitle,
      StatusOfAppointment,
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
        } else if (Object.keys(dbHierarchicalFilters).length > 0) {
          query = {
            $and: [dbHierarchicalFilters, textFilterQuery]
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
        } else if (Object.keys(dbHierarchicalFilters).length > 0) {
          query = {
            $and: [dbHierarchicalFilters, numberFilterQuery]
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
        } else if (Object.keys(dbHierarchicalFilters).length > 0) {
          query = {
            $and: [dbHierarchicalFilters, dateFilterQuery]
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
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
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
    const employees = await collection.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery)
      .toArray();
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
      console.error(`SECURITY WARNING: Found ${employees.length - verifiedEmployees.length} employees with region mismatch relative to requested '${region}'`);
    }
    // Get total count for pagination
    const totalRecords = await collection.countDocuments(query);
    const response = {
      employees: verifiedEmployees,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords: totalRecords,
      region,
      queryUsed: query,
      debug: {
        originalEmployeeCount: employees.length,
        verifiedEmployeeCount: verifiedEmployees.length,
        hierarchicalFilters: dbHierarchicalFilters,
        requestedRegion: region,
        note: 'Region/Department/Division are matched case-insensitively and Division omitted when empty.'
      }
    };
    return res.json(response);
  } catch (e) {
    console.error('❌ Error in getAllEmployees:', e);
    console.error('Error stack:', e.stack);
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
    const newEmployee = new Employee(req.body);
    await newEmployee.save();
    return res.status(201).json({
      message: "Employee created successfully.",
      employee: newEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to create employee." });
  }
};
exports.editEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedEmployee = await Employee.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedEmployee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    return res.json({
      message: "Employee updated successfully.",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error(error);
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
    console.error(error);
    return res.status(500).json({ error: "Failed to delete employee." });
  }
};
exports.getPersonnels = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
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
    const employees = await PersonnelServices.find(query).limit(20);
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
    console.error("Error in getPersonnels:", error);
    return res.status(500).json({ error: "Failed to fetch personnel data" });
  }
};
// Get employees eligible for loyalty pay based on years of service
exports.getEligibleForLoyaltyPay = async (req, res) => {
  try {
    // // Get the region and fiscal year from the query parameters
    const { region, fiscalYear: requestedFiscalYear } = req.query;
    if (!region) {
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
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
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
    const personnelServices = await PersonnelServices.find(personnelQuery).lean();
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
    console.error("Error getting eligible employees for loyalty pay:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
// Get employees eligible for retirement
// Get employee statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};
    const { region } = req.query;
    // Use hierarchical filters as base, or fall back to region filter
    let baseFilters = { ...hierarchicalFilters };
    if (!Object.keys(hierarchicalFilters).length && region) {
      baseFilters.Region = region;
    }
    if (!Object.keys(baseFilters).length) {
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
    if (baseFilters.region) filtersCi.Region = norm(baseFilters.region);
    if (baseFilters.department) filtersCi.Department = norm(baseFilters.department);
    if (baseFilters.division) {
      const d = baseFilters.division.trim();
      if (d) filtersCi.Division = norm(d);
    }
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
    console.error("Error in getEmployeeStats:", error);
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
    const personnelServices = await PersonnelServices.find(personnelQuery).lean();
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
    console.error("Error getting eligible employees for retirement:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
