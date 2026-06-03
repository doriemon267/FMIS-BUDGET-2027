const COSPersonnel = require("../models/COSPersonnel");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const { searchFilter, textFilter } = require("../utils/controller_get_process");

/**
 * Filter hierarchical filters to only include relevant fields for COSPersonnel
 * @param {Object} filters - Filters from middleware
 * @returns {Object} - Sanitized filters
 */
const filterHierarchicalFilters = (filters) => {
  if (!filters) return {};
  const allowedFields = ["region", "department", "division"];
  const result = {};

  Object.keys(filters).forEach((key) => {
    if (allowedFields.includes(key)) {
      result[key] = filters[key];
    } else if (key === "$or" || key === "$and") {
      const children = filters[key]
        .map(filterHierarchicalFilters)
        .filter((f) => Object.keys(f).length > 0);
      if (children.length > 0) {
        result[key] = children;
      }
    }
  });

  return result;
};

exports.bulkAddCOSPersonnel = async (req, res) => {
  try {
    console.log('🔍 [COS BULK ADD] ==================== INCOMING REQUEST ====================');
    console.log('🔍 [COS BULK ADD] Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [COS BULK ADD] User:', { id: req.user?.id, roles: req.user?.Roles });
    console.log('🔍 [COS BULK ADD] ================================================================');

    const { statusOfAppointment } = req.body; // Removed region requirement
    
    // Check if user is SUPER_ADMIN
    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('SUPER ADMIN');

    // ⚠️ CRITICAL: Get user's assignment DIRECTLY to ensure proper filtering
    const userId = req.user.id;
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    let userAssignment = null;
    
    if (!isSuperAdmin) {
      userAssignment = await HierarchicalUserAssignment.getUserPermissions(userId);
      if (!userAssignment || userAssignment.assignmentLevel === 'NONE') {
        return res.status(403).json({
          message: 'No organizational assignment found. Cannot perform bulk add.',
          code: 'NO_ORG_ASSIGNMENT'
        });
      }
    }

    // Get hierarchical filters from middleware (as backup)
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};

    // Get the user's ACTUAL assigned organizational units
    // For SUPER_ADMIN: use req.body region without requiring assignment
    const userRegion = isSuperAdmin 
      ? req.body.region 
      : (userAssignment?.regions?.length > 0 
        ? userAssignment.regions[0]?.regionName 
        : (req.body.region || userAssignment?.region));
    const userDepartment = isSuperAdmin
      ? req.body.department
      : (userAssignment?.departments?.length > 0 
        ? userAssignment.departments[0]?.departmentName 
        : (req.body.department || userAssignment?.department));
    const userDivision = isSuperAdmin
      ? req.body.division
      : (userAssignment?.divisions?.length > 0 
        ? userAssignment.divisions[0] 
        : (req.body.division || userAssignment?.division));

    console.log('🔍 [COS BULK ADD] ==================== USER ASSIGNMENT ====================');
    console.log('🔍 [COS BULK ADD] User ID:', userId);
    console.log('🔍 [COS BULK ADD] Is SUPER_ADMIN:', isSuperAdmin);
    console.log('🔍 [COS BULK ADD] Assignment Level:', userAssignment?.assignmentLevel || 'N/A');
    console.log('🔍 [COS BULK ADD] User Region:', userRegion);
    console.log('🔍 [COS BULK ADD] User Department:', userDepartment);
    console.log('🔍 [COS BULK ADD] User Division:', userDivision);
    console.log('🔍 [COS BULK ADD] =================================================================');

    // CRITICAL VALIDATION: Ensure region is specified (from assignment or request body)
    if (!userRegion) {
      console.error('🚨 [COS BULK ADD] USER REGION IS MISSING:', {
        isSuperAdmin,
        userAssignment,
        userRegion,
        requestRegion: req.body.region
      });
      return res.status(400).json({
        error: "No region assignment found",
        message: isSuperAdmin 
          ? "Region must be specified in request body for SUPER_ADMIN"
          : "You must be assigned to a region to perform COS personnel bulk add operations",
        debug: { userRegion, requestRegion: req.body.region, assignmentLevel: userAssignment?.assignmentLevel }
      });
    }

    if (!statusOfAppointment || statusOfAppointment.toUpperCase() !== "COS") {
      console.error('🚨 [COS BULK ADD] INVALID STATUS:', {
        statusOfAppointment,
        requestBody: req.body
      });
      return res.status(400).json({ 
        message: "Missing or invalid required field: statusOfAppointment",
        debug: { received: statusOfAppointment }
      });
    }
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ message: "Active settings not found" });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const budgetType = activeSettings.budgetType;

    // ⚠️ CRITICAL: Build STRICT query using DIRECT user assignment
    // This is the PRIMARY fix - no more middleware filter merging
    let employeeQuery = {
      StatusOfAppointment: { $regex: new RegExp(`^${statusOfAppointment}$`, 'i') }
    };

    // For SUPER_ADMIN: Get ALL employees (no region restriction)
    // For regular users: Apply hierarchical filtering based on assignment
    if (!isSuperAdmin) {
      // Apply hierarchical filtering based on user's DIRECT assignment level
      if (userRegion) {
        employeeQuery.Region = { $regex: new RegExp(`^${userRegion.trim()}$`, 'i') };
      }

      // Only apply department/division filtering if user has assignment
      if (userAssignment) {
        if (['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL', 'DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
          if (userDepartment) {
            employeeQuery.Department = { $regex: new RegExp(`^${userDepartment.trim()}$`, 'i') };
          }
        }

        if (['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
          if (userDivision) {
            employeeQuery.Division = { $regex: new RegExp(`^${userDivision.trim()}$`, 'i') };
            console.log('🔍 [COS BULK ADD] ⚠️⚠️⚠️ DIVISION LEVEL - STRICT FILTER:', userDivision);
          }
        }
      }
    }

    console.log('🔍 [COS BULK ADD] ==================== FINAL QUERY ====================');
    console.log('🔍 [COS BULK ADD] Employee Query:', JSON.stringify(employeeQuery, null, 2));
    console.log('🔍 [COS BULK ADD] Expected Division:', userDivision || 'N/A');
    console.log('🔍 [COS BULK ADD] ================================================================');

    // Only get employees within user's hierarchical scope
    const employees = await EmployeeMaster.find(employeeQuery);

    console.log('🔍 [COS BULK ADD] ==================== QUERY RESULTS ====================');
    console.log('🔍 [COS BULK ADD] Found employees:', employees.length);

    // Extract unique divisions from results for verification
    const divisions = [...new Set(employees.map(emp => emp.Division).filter(Boolean))];
    const departments = [...new Set(employees.map(emp => emp.Department).filter(Boolean))];

    console.log('🔍 [COS BULK ADD] Unique Divisions in results:', divisions);
    console.log('🔍 [COS BULK ADD] Unique Departments in results:', departments);
    console.log('🔍 [COS BULK ADD] ⚠️ EXPECTED DIVISION:', userDivision);
    console.log('🔍 [COS BULK ADD] ⚠️ MATCH:', divisions.length === 1 && divisions[0] === userDivision ? 'YES ✓' : 'NO ✗');
    console.log('🔍 [COS BULK ADD] ================================================================');

    if (employees.length === 0) {
      return res.status(200).json({
        message: `No COS employees found within your access scope (Region: ${userRegion}).`,
        accessLevel: userAssignment?.assignmentLevel || 'UNKNOWN',
        hierarchicalScope: {
          region: userRegion,
          department: userDepartment,
          division: userDivision
        }
      });
    }

    // Duplicate check: same employee + fiscal year = skip (DB has unique index on employeeNumber + fiscalYear).
    // Fetch existing by fiscalYear (+ region) so we don't insert duplicate. Still save workflowRef for per-proposal listing.
    const workflowProposalId = req.body.proposalId || null;
    const fiscalYearNorm = fiscalYear != null ? String(fiscalYear) : undefined;
    const existingQuery = {
      ...(fiscalYearNorm && { fiscalYear: { $in: [fiscalYearNorm, Number(fiscalYear)] } }),
      ...(userRegion && { region: userRegion })
    };
    const existingCOS = await COSPersonnel.find(existingQuery)
      .select('employeeNumber itemNumber positionTitle department division gradelevel_SG employeeFullName').lean();
    const existingByEmployeeNumber = new Map();
    const existingVacantByDetails = new Set();
 existingCOS.forEach((s) => {
  // 1. Update sa Employee Number check
  const empNum = String(s.employeeNumber || '').trim().toUpperCase();
  const isInvalidEmpNum = empNum === '' || empNum === 'VACANT' || empNum === 'TO-BE-FILLED';

  if (s.employeeNumber && !isInvalidEmpNum) {
    existingByEmployeeNumber.set(s.employeeNumber, s);
  }

  if (s.itemNumber && String(s.itemNumber).trim() !== '') {
    existingByEmployeeNumber.set(s.itemNumber.trim(), s);
  }

  // 2. Update sa isVacant logic (Case-insensitive check para sa dalawang terms)
  const fullName = String(s.employeeFullName || '').trim().toUpperCase();
  const isVacant = fullName === 'VACANT' || fullName === 'TO-BE-FILLED';

  if (isVacant) {
    const vacantKey = `${s.positionTitle}|${s.department}|${s.division || ''}|${s.gradelevel_SG || ''}`;
    existingVacantByDetails.add(vacantKey);
  }
});

    const checks = employees.map((employee, idx) => {
      // For non-SUPER_ADMIN: Double-check that employee belongs to user's assigned region
      if (!isSuperAdmin && employee.Region !== userRegion) {
        console.error(`SECURITY WARNING: Employee ${employee.EmployeeFullName} has region ${employee.Region} but user's assigned region is ${userRegion}`);
        return null;
      }

      // Additional validation: Check if Division user is processing employee from their division
      if (!isSuperAdmin && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment?.assignmentLevel) && employee.Division !== userDivision) {
        console.warn(`WORKFLOW WARNING: Division user ${req.user.id} processing employee ${employee.EmployeeFullName} from division ${employee.Division} (user's division: ${userDivision})`);
      }

      const fullName = (employee.EmployeeFullName || '').toString().toUpperCase();

const isVacant = fullName === 'VACANT' || fullName === 'TO-BE-FILLED';
      let isDuplicate = false;
      if (isVacant) {
        if (employee.ItemNumber && employee.ItemNumber.trim() !== '') {
          isDuplicate = existingByEmployeeNumber.has(employee.ItemNumber.trim());
        }
        if (!isDuplicate) {
          const vacantKey = `${employee.PositionTitle}|${employee.Department}|${employee.Division || ''}|${employee.SG?.toString() || ''}`;
          isDuplicate = existingVacantByDetails.has(vacantKey);
        }
      } else {
        const empId = employee.EmployeeID != null ? String(employee.EmployeeID).trim() : '';
        isDuplicate = empId ? existingByEmployeeNumber.has(empId) : false;
        if (!empId) {
          // Non-VACANT without EmployeeID would get synthetic id and couldn't be matched on next run; skip to avoid duplicates
          return null;
        }
      }
      if (isDuplicate) {
        console.log(`Skipping ${isVacant ? 'VACANT position' : 'employee'} ${employee.EmployeeFullName} - already exists for this fiscal year`);
        return null;
      }

      // Check if essential required fields are present (SG and Rate are still required)
      if (!employee.SG || !employee.Rate) {
        return null;
      }

      const monthlySalary = employee.Rate;
      const annualSalary = monthlySalary * 12;
      // Avoid null employeeNumber: unique index would allow only one (null, fiscalYear). Use synthetic id for VACANT/missing.
      let employeeNumber = employee.EmployeeID != null && String(employee.EmployeeID).trim() !== '' ? employee.EmployeeID : null;
      if (employeeNumber == null || (typeof employeeNumber === 'string' && employeeNumber.trim() === '')) {
        const itemNo = (employee.ItemNumber || '').toString().trim();
        const posKey = [employee.PositionTitle, employee.Department, employee.Division].filter(Boolean).join('|');
        employeeNumber = isVacant ? `VACANT-${itemNo || `${posKey}-${idx}`}` : `COS-${itemNo || `${posKey}-${idx}`}`;
      }
      return {
        department: employee.Department,
        region: employee.Region,
        budgetType: budgetType,
        processBy: req.body.processBy,
        processDate: new Date(),
        fiscalYear: fiscalYear,
        positionTitle: employee.PositionTitle,
        itemNumber: employee.ItemNumber || "",
        gradelevel_SG: employee.SG.toString(),
        step: employee.Step || null,
        gradelevel_JG: employee.JG ? employee.JG.toString() : "",
        employeeFullName: employee.EmployeeFullName,
        employeeNumber,
        division: employee.Division,
        statusOfAppointment: employee.StatusOfAppointment,
        monthlySalary: monthlySalary,
        annualSalary: annualSalary,
        createdBy: req.user?.id ? String(req.user.id) : undefined,
        Total: annualSalary,
        ...(workflowProposalId && { workflowRef: workflowProposalId }),
      };
    });
    const cosPersonnelData = checks.filter((record) => record !== null);
    if (cosPersonnelData.length > 0) {
      const addedRecords = await COSPersonnel.insertMany(cosPersonnelData);
      return res.status(200).json({
        addedRecords,
        region: userRegion,
        count: addedRecords.length,
        processedBy: {
          userId: req.user.id,
          userLevel: userAssignment?.assignmentLevel || 'UNKNOWN',
          accessScope: {
            region: userRegion,
            department: userDepartment,
            division: userDivision
          },
          timestamp: new Date()
        },
        message: `${addedRecords.length} COS personnel records added successfully by ${userAssignment?.assignmentLevel || 'Unknown'} level user`
      });
    } else {
      return res.status(200).json({
        message: "No new COS personnel to add.",
        region: userRegion,
        accessLevel: userAssignment?.assignmentLevel || 'UNKNOWN',
        hierarchicalScope: {
          region: userRegion,
          department: userDepartment,
          division: userDivision
        }
      });
    }
  } catch (error) {
    console.error("Error in bulkAddCOSPersonnel:", error);
    return res.status(500).json({ message: error.message });
  }
};
exports.getAllCOSPersonnel = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      employeeFullName,
      statusOfAppointment,
      region, // Add region parameter
    } = req.query;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};

    const dbHierarchicalFilters = filterHierarchicalFilters(hierarchicalFilters);
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const activeSettings = await Settings.findOne({ isActive: true });
    let query = {};

    // Apply hierarchical filters as base
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      query = { ...dbHierarchicalFilters };
    }

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view COS personnel"
      });
    }

    // Add region filter to hierarchical filters
    if (query.$and) {
      query.$and.push({ region: region });
    } else if (Object.keys(query).length > 0) {
      query = {
        $and: [query, { region: region }]
      };
    } else {
      query.region = region;
    }

    // SUPER_ADMIN filtering: Only show COS records they created
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    
    if (isSuperAdmin && userId) {
      const userIdString = String(userId);
      // Add createdBy filter to only show records created by SUPER_ADMIN
      if (query.$and) {
        query.$and.push({ 
          $or: [
            { createdBy: userIdString }, 
            { createdBy: userId }, 
            { userId: userIdString }, 
            { userId: userId }
          ]
        });
      } else if (Object.keys(query).length > 0) {
        query = {
          $and: [
            query, 
            { 
              $or: [
                { createdBy: userIdString }, 
                { createdBy: userId }, 
                { userId: userIdString }, 
                { userId: userId }
              ]
            }
          ]
        };
      } else {
        query = {
          $or: [
            { createdBy: userIdString }, 
            { createdBy: userId }, 
            { userId: userIdString }, 
            { userId: userId }
          ]
        };
      }
    }

    if (activeSettings) {
      query.fiscalYear = activeSettings.fiscalYear;
    }
    if (search) {
      searchFilter(query, search, [
        "positionTitle",
        "employeeFullName",
        "department",
      ]);
    }
    textFilter(query, { employeeFullName });
    if (statusOfAppointment) {
      query.statusOfAppointment = { $regex: new RegExp(`^${statusOfAppointment}$`, 'i') };
    }
    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    const cosPersonnels = await COSPersonnel.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    // Double-check that all returned personnel belong to the specified region
    const verifiedPersonnel = cosPersonnels.filter(person => {
      const psRegion = String(person.region || person.Region || '').toUpperCase().trim();
      const targetRegion = String(region || '').toUpperCase().trim();
      
      if (region && psRegion !== targetRegion) {
        console.error(`SECURITY WARNING: COS personnel ${person.employeeFullName} has region ${person.region} but requested region is ${region}`);
        return false;
      }
      return true;
    });
    const totalRecords = await COSPersonnel.countDocuments(query);

    // Derive workflow level for UI if not present in documents
    const enrichedPersonnel = verifiedPersonnel.map((p) => {
      const obj = p.toObject ? p.toObject() : p;
      const hasDivision = obj.division && String(obj.division).trim() !== "";
      const hasDepartment = obj.department && String(obj.department).trim() !== "";
      // Old structure derivation
      let derivedLevel = "REGION";
      if (hasDivision) derivedLevel = "DIVISION";
      else if (hasDepartment) derivedLevel = "DEPARTMENT";
      // Only set if not already provided
      obj.workflowLevel = obj.workflowLevel || derivedLevel;
      obj.originalLevel = obj.originalLevel || derivedLevel;
      return obj;
    });

    return res.json({
      cosPersonnels: enrichedPersonnel,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
      region,
    });
  } catch (error) {
    console.error("Error in getAllCOSPersonnel:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
};
exports.updateCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    const allowedFields = [
      "employeeFullName",
      "monthlySalary",
      "annualSalary",
      "statusOfAppointment",
      "Total",
    ];

    const filteredUpdateFields = Object.keys(updateFields)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateFields[key];
        return obj;
      }, {});

    const updatedCOSPersonnel = await COSPersonnel.findOneAndUpdate(
      { _id: id, ...sanitizedFilters },
      { $set: filteredUpdateFields },
      { new: true }
    );

    if (!updatedCOSPersonnel) {
      return res.status(404).json({ 
        message: "COS personnel not found or access denied",
        error: "RECORD_NOT_FOUND_OR_ACCESS_DENIED"
      });
    }

    res.status(200).json(updatedCOSPersonnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.deleteCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    const deletedCOSPersonnel = await COSPersonnel.findOneAndDelete({
      _id: id,
      ...sanitizedFilters
    });

    if (!deletedCOSPersonnel) {
      return res.status(404).json({ 
        message: "COS personnel not found or access denied",
        error: "RECORD_NOT_FOUND_OR_ACCESS_DENIED"
      });
    }

    res.status(200).json({ message: "COS personnel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//GET GRAND TOTAL OF THE COS PERSONNEL - COS statusOfAppointment(FOR TOTAL COLUMN)\
exports.getGrandTotalCOS = async (req, res) => {
  try {
    const { region } = req.query;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region) {
      return res.status(400).json({
        error: "Region parameter is required",
        message: "Please specify a region to view COS personnel totals"
      });
    }
    // 1. Try to grab the explicitly active settings
    let activeSettings = await Settings.findOne({ isActive: true }).lean();
    // 2. Fallback: if none is marked active, pick the one with the highest fiscalYear
    if (!activeSettings) {
      activeSettings = await Settings
        .findOne({})
        .sort({ fiscalYear: -1 })   // assumes fiscalYear is numeric or lexically comparable
        .lean();
    }
    // 3. If we still don't have a fiscalYear, error out
    if (!activeSettings || activeSettings.fiscalYear == null) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found."
      });
    }
    const { fiscalYear } = activeSettings;

    // Build query with hierarchical filters
    let query = {
      statusOfAppointment: { $regex: /^COS$/i },
      fiscalYear,
      region,
      ...sanitizedFilters
    };

    // 4. Fetch only COS personnel for that fiscal year AND region with hierarchical access
    const cosPersonnels = await COSPersonnel.find(query).lean();
    // 5. Define exactly which fields to include in the total for COS
    const fieldsToSum = [
      "annualSalary",
    ];
    // 6. Sum only those fields for each record, then grand‐total them
    const grandTotal = cosPersonnels.reduce((acc, curr) => {
      const subtotal = fieldsToSum.reduce(
        (sum, field) => sum + (Number(curr[field]) || 0),
        0
      );
      return acc + subtotal;
    }, 0);
    // 7. Return fiscalYear + grandTotal + region
    return res.json({ fiscalYear, grandTotal, region });
  } catch (error) {
    console.error("Error in getGrandTotalCOS:", error);
    return res
      .status(500)
      .json({ message: "Server error", error });
  }
};

// Get COS Personnel by Parameters (for proposal workflow)
exports.getCOSByParams = async (req, res) => {
  try {
    const { proposalId, region } = req.query;
    const query = {};

    // If proposalId is provided, filter by workflowRef (NewProposalWorkflow _id) so list is per-proposal
    if (proposalId) {
      query.workflowRef = proposalId;
    }

    // Apply region filter if provided
    if (region) {
      query.region = region;
    }

    // Apply hierarchical filters from middleware
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);
    if (Object.keys(sanitizedFilters).length > 0) {
      Object.assign(query, sanitizedFilters);
    }

    // Get active settings for fiscal year
    const Settings = require('../models/Settings');
    const activeSettings = await Settings.findOne({ isActive: true });
    if (activeSettings) {
      query.fiscalYear = activeSettings.fiscalYear;
    }

    // Fetch COS personnel
    const COSPersonnel = require('../models/COSPersonnel');
    let cosList = await COSPersonnel.find(query).lean();

    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    const userRoles = req.user?.Roles || [];

    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_OFFICER', 'BUDGET OFFICER'].includes(r));

    // SUPER_ADMIN must filter by the region parameter passed from frontend
    // BUDGET_MANAGER sees ALL records (no filtering)
    // Other users are filtered by their organizational assignment
    if (isSuperAdmin && region) {
      // SUPER_ADMIN: Filter by the region parameter AND by createdBy (self-created records only)
      const userIdString = userId ? String(userId) : undefined;
      const filteredCosList = cosList.filter(cos => {
        const cosRegionMatch = cos.region === region;
        const createdByMatch = userIdString && (
          String(cos.createdBy || cos.userId || '') === userIdString ||
          String(cos.userId || '') === userIdString
        );
        return cosRegionMatch && createdByMatch;
      });
      if (filteredCosList.length > 0) {
        cosList = filteredCosList;
      }
    } else if (!isSuperAdmin && !isBudgetManager && userIdString) {
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

          const filteredCosList = cosList.filter(cos => {
            if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
              return cos.division === assignedDivision;
            }
            if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
              return (cos.department || cos.Department) === assignedDepartment;
            }
            if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
              return cos.region === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });

          if (filteredCosList.length > 0 || userAssignment.assignmentLevel !== 'FULL') {
            cosList = filteredCosList;
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getCOSByParams:', err.message);
      }
    }

    res.status(200).json(cosList);
  } catch (error) {
    console.error("Error fetching COS personnel by params:", error);
    res.status(500).json({ message: "Failed to fetch COS data" });
  }
};
