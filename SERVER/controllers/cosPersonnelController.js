const COSPersonnel = require("../models/COSPersonnel");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const NewProposalWorkflow = require("../models/NewProposalWorkflow");
const MOOE = require("../models/mooeProposals");
const { searchFilter, textFilter } = require("../utils/controller_get_process");
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const {
  COS_PREMIUM_EFFECTIVE_DATE,
  applyCOSPremium,
  isPremiumSelected,
  getCOSVacantKey,
  isVacantCOSEmployee,
  normalizePremiumConfig,
  normalizeCOSKeyPart,
  resolveCOSEmployeeNumber,
  roundCurrency,
  toWorkflowObjectId,
} = require('../utils/cosPremium');

const getUserId = (req) => String(req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId || '');
const getUserName = (req) => [req.user?.FirstName, req.user?.LastName].filter(Boolean).join(' ') || req.user?.name || req.user?.UserName || '';
const normalizeRole = (role) => String(role || '').trim().replace(/\s+/g, '_').toUpperCase();

const getWorkflowPremiumConfig = (workflow) => normalizePremiumConfig({
  enabled: workflow?.cosJoPremium?.enabled ?? false,
  percentage: workflow?.cosJoPremium?.percentage ?? 10,
  selectionMode: workflow?.cosJoPremium?.selectionMode,
  selectedPersonnelIds: workflow?.cosJoPremium?.selectedPersonnelIds,
});

const assertActiveWorkflowAccess = async (req, proposalId, { write = false } = {}) => {
  if (!proposalId) {
    const error = new Error('An active proposal is required for COS/JO premium settings.');
    error.statusCode = 400;
    throw error;
  }
  const canonicalProposalId = toWorkflowObjectId(proposalId);
  const workflow = await NewProposalWorkflow.findById(canonicalProposalId);
  if (!workflow) {
    const error = new Error('Active proposal not found.');
    error.statusCode = 404;
    throw error;
  }

  const activeHeader = req.get?.('X-Workflow-Ref') || req.headers?.['x-workflow-ref'];
  if (write && !activeHeader) {
    const error = new Error('Select this proposal as the active workflow before saving COS/JO changes.');
    error.statusCode = 403;
    throw error;
  }
  if (write && String(activeHeader) !== String(workflow._id)) {
    const error = new Error('The requested proposal does not match the active workflow.');
    error.statusCode = 403;
    throw error;
  }

  const userId = getUserId(req);
  const roles = (req.user?.Roles || req.user?.roles || []).map(normalizeRole);
  const fullAccess = roles.some((role) => [
    'SUPER_ADMIN', 'BUDGET_MANAGER', 'BUDGET_OFFICER',
    'OVERALL_BUDGET_APPROVER', 'BUDGET_ADMIN',
  ].includes(role));
  const roleMatchesAssignment = roles.includes(normalizeRole(workflow.currentAssigneeRole));
  const isOwner = userId && String(workflow.createdBy || '') === userId;
  if (!isOwner && !fullAccess && !roleMatchesAssignment) {
    const error = new Error('You are not authorized to update this proposal.');
    error.statusCode = 403;
    throw error;
  }
  if (write && workflow.isLocked && String(workflow.lockedBy?.userId || '') !== userId) {
    const error = new Error('This proposal is locked by another user.');
    error.statusCode = 423;
    throw error;
  }
  return workflow;
};

const premiumSettingsResponse = (workflow, summary = null) => ({
  proposalId: String(workflow._id),
  enabled: Boolean(workflow.cosJoPremium?.enabled),
  percentage: Number(workflow.cosJoPremium?.percentage ?? 10),
  selectionMode: ['SELECTED', 'EXCLUDED'].includes(workflow.cosJoPremium?.selectionMode)
    ? workflow.cosJoPremium.selectionMode
    : 'ALL',
  selectedPersonnelIds: (workflow.cosJoPremium?.selectedPersonnelIds || []).map(String),
  effectiveDate: workflow.cosJoPremium?.effectiveDate || COS_PREMIUM_EFFECTIVE_DATE,
  eligibility: 'Fiscal year 2026 and later; July 2026 is the policy effectivity marker.',
  calculation: 'Premium = annual salary × percentage; total = annual salary + premium.',
  updatedByName: workflow.cosJoPremium?.updatedByName || '',
  updatedAt: workflow.cosJoPremium?.updatedAt || null,
  ...(summary && { summary }),
});

const summarizeCOSRows = (rows = []) => rows.reduce((summary, row) => {
  summary.rowCount += 1;
  summary.baseAnnualAmount = roundCurrency(summary.baseAnnualAmount + (Number(row.annualSalary) || 0));
  summary.premiumAmount = roundCurrency(summary.premiumAmount + (Number(row.premiumAmount) || 0));
  summary.total = roundCurrency(summary.total + (Number(row.Total) || 0));
  return summary;
}, { rowCount: 0, baseAnnualAmount: 0, premiumAmount: 0, total: 0 });

const syncCOSGrandTotalToMOOE = async (workflowRef, grandTotal, session = null) => {
  if (!workflowRef) return;
  await MOOE.updateMany(
    { workflowRef, uacsCode: '5-02-99-990-3' },
    [{
      $set: {
        subsidy: roundCurrency(grandTotal),
        amount: { $add: [{ $convert: { input: { $ifNull: ['$income', 0] }, to: 'double', onError: 0, onNull: 0 } }, roundCurrency(grandTotal)] },
        lastActionDate: new Date(),
      },
    }],
    session ? { session } : undefined
  );
};

const refreshProposalTotals = async (workflowRef) => {
  if (!workflowRef) return null;
  try {
    return await recalculateAndSaveProposalTotals({ workflowRef });
  } catch (error) {
    console.warn('[COS PREMIUM] Proposal totals recalculation skipped:', error.message);
    return null;
  }
};

const reapplyPremiumToWorkflow = async (workflow, config, session = null) => {
  const rows = await COSPersonnel.find({ workflowRef: workflow._id }).session(session || null);
  const operations = rows.map((row) => ({
    updateOne: {
      filter: { _id: row._id, workflowRef: workflow._id },
      update: { $set: applyCOSPremium(row, isPremiumSelected(row, config) ? config : { ...config, enabled: false }) },
    },
  }));
  if (operations.length > 0) await COSPersonnel.bulkWrite(operations, session ? { session } : undefined);
  const recalculatedRows = rows.map((row) => ({
    ...row.toObject(),
    ...applyCOSPremium(row, isPremiumSelected(row, config) ? config : { ...config, enabled: false }),
  }));
  const summary = summarizeCOSRows(recalculatedRows);
  await syncCOSGrandTotalToMOOE(workflow._id, summary.total, session);
  return summary;
};

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

    // Duplicate checks mirror the proposal-aware compound unique index. The
    // same employee may appear in a different proposal for the same FY.
    const workflowProposalId = req.body.proposalId || null;
    const workflow = await assertActiveWorkflowAccess(req, workflowProposalId, { write: true });
    const premiumConfig = getWorkflowPremiumConfig(workflow);
    const fiscalYearNorm = fiscalYear != null ? String(fiscalYear) : undefined;
    const existingQuery = {
      workflowRef: workflow._id,
      ...(fiscalYearNorm && { fiscalYear: { $in: [fiscalYearNorm, Number(fiscalYear)] } })
    };
    const existingCOS = await COSPersonnel.find(existingQuery)
      .select('employeeNumber itemNumber positionTitle department division gradelevel_SG employeeFullName').lean();
    const existingByEmployeeNumber = new Map();
    const existingVacantByDetails = new Set();
    existingCOS.forEach((row) => {
      const employeeNumber = normalizeCOSKeyPart(row.employeeNumber);
      if (employeeNumber && !['VACANT', 'TO-BE-FILLED'].includes(employeeNumber)) {
        existingByEmployeeNumber.set(employeeNumber, row);
      }

      if (isVacantCOSEmployee(row)) {
        const itemNumber = normalizeCOSKeyPart(row.itemNumber);
        if (itemNumber) {
          // Cover both canonical and legacy VACANT identifiers.
          existingByEmployeeNumber.set(itemNumber, row);
          existingByEmployeeNumber.set(`VACANT-${itemNumber}`, row);
        }
        existingVacantByDetails.add(getCOSVacantKey(row));
      }
    });

    const checks = employees.map((employee) => {
      // For non-SUPER_ADMIN: Double-check that employee belongs to user's assigned region
      if (!isSuperAdmin && employee.Region !== userRegion) {
        console.error(`SECURITY WARNING: Employee ${employee.EmployeeFullName} has region ${employee.Region} but user's assigned region is ${userRegion}`);
        return null;
      }

      // Additional validation: Check if Division user is processing employee from their division
      if (!isSuperAdmin && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment?.assignmentLevel) && employee.Division !== userDivision) {
        console.warn(`WORKFLOW WARNING: Division user ${req.user.id} processing employee ${employee.EmployeeFullName} from division ${employee.Division} (user's division: ${userDivision})`);
      }

      const isVacant = isVacantCOSEmployee(employee);
      const employeeNumber = resolveCOSEmployeeNumber(employee);
      if (!employeeNumber) return null;

      const vacantKey = isVacant ? getCOSVacantKey(employee) : '';
      const isDuplicate = existingByEmployeeNumber.has(employeeNumber)
        || (isVacant && existingVacantByDetails.has(vacantKey));
      if (isDuplicate) {
        console.log(`Skipping ${isVacant ? 'VACANT position' : 'employee'} ${employee.EmployeeFullName} - already exists in this proposal for fiscal year ${fiscalYear}`);
        return null;
      }

      // Check if essential required fields are present (SG and Rate are still required)
      if (!employee.SG || !employee.Rate) {
        return null;
      }

      const monthlySalary = employee.Rate;
      const annualSalary = monthlySalary * 12;
      // Reserve the key immediately so duplicate EmployeeMaster rows in this
      // same upload batch are skipped before insertMany reaches MongoDB.
      existingByEmployeeNumber.set(employeeNumber, employee);
      if (isVacant) existingVacantByDetails.add(vacantKey);
      const premiumFields = applyCOSPremium({ monthlySalary, annualSalary, fiscalYear },
        premiumConfig.selectionMode === 'SELECTED' ? { ...premiumConfig, enabled: false } : premiumConfig);
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
        monthlySalary: premiumFields.monthlySalary,
        annualSalary: premiumFields.annualSalary,
        createdBy: req.user?.id ? String(req.user.id) : undefined,
        baseAnnualAmount: premiumFields.baseAnnualAmount,
        premiumEnabled: premiumFields.premiumEnabled,
        premiumRate: premiumFields.premiumRate,
        premiumEffectiveDate: premiumFields.premiumEffectiveDate,
        premiumAmount: premiumFields.premiumAmount,
        Total: premiumFields.Total,
        workflowRef: workflow._id,
      };
    });
    const cosPersonnelData = checks.filter((record) => record !== null);
    if (cosPersonnelData.length > 0) {
      const addedRecords = await COSPersonnel.insertMany(cosPersonnelData);
      if (workflow) {
        const summary = summarizeCOSRows(await COSPersonnel.find({ workflowRef: workflow._id }).lean());
        await syncCOSGrandTotalToMOOE(workflow._id, summary.total);
        await refreshProposalTotals(workflow._id);
      }
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
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    if (error?.code === 11000) {
      const writeError = error?.writeErrors?.find((entry) => entry?.err?.code === 11000 || entry?.code === 11000);
      const duplicateKey = error?.keyValue || writeError?.err?.keyValue || writeError?.keyValue || {};
      const duplicateRow = writeError?.err?.op || writeError?.op || {};
      const duplicateEmployee = duplicateKey.employeeNumber || duplicateRow.employeeNumber || "An employee";
      const duplicateFiscalYear = duplicateKey.fiscalYear || duplicateRow.fiscalYear || req.body?.fiscalYear || "the selected fiscal year";
      return res.status(409).json({
        message: `${duplicateEmployee} already exists in this COS/JO proposal for fiscal year ${duplicateFiscalYear}. Refresh the list and try again.`
      });
    }
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
      proposalId,
      fiscalYear,
      operator = "=",
      ...dynamicFilters
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

    if (proposalId) query.workflowRef = toWorkflowObjectId(proposalId);
    if (fiscalYear || activeSettings?.fiscalYear) query.fiscalYear = fiscalYear || activeSettings.fiscalYear;
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

    // Apply dynamic column filters
    if (dynamicFilters && typeof dynamicFilters === 'object') {
      Object.keys(dynamicFilters).forEach(key => {
        const val = dynamicFilters[key];
        if (val !== undefined && val !== "") {
          if (!isNaN(Number(val))) {
            const numericValue = Number(val);
            switch (operator) {
              case "<": query[key] = { $lt: numericValue }; break;
              case ">": query[key] = { $gt: numericValue }; break;
              case ">=": query[key] = { $gte: numericValue }; break;
              case "<=": query[key] = { $lte: numericValue }; break;
              default: query[key] = numericValue;
            }
          } else if (val === "true" || val === "false") {
            query[key] = val === "true";
          } else {
            query[key] = { $regex: val, $options: "i" };
          }
        }
      });
    }

    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    
    let cosPersonnels = await COSPersonnel.find(query)
      .sort(sortQuery)
      .lean();
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

    const grandTotals = {};
    enrichedPersonnel.forEach(ps => {
      ['monthlySalary', 'annualSalary', 'baseAnnualAmount', 'premiumAmount', 'Total'].forEach(field => {
        grandTotals[field] = (grandTotals[field] || 0) + (Number(ps[field]) || 0);
      });
    });

    const paginatedPersonnel = enrichedPersonnel.slice(skip, skip + limitNum);

    return res.json({
      cosPersonnels: paginatedPersonnel,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
      region,
      grandTotals
    });
  } catch (error) {
    console.error("Error in getAllCOSPersonnel:", error);
    return res.status(error.statusCode || 500).json({ message: error.message || "Something went wrong." });
  }
};
exports.updateCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    const existing = await COSPersonnel.findOne({ _id: id, ...sanitizedFilters });
    if (!existing) {
      return res.status(404).json({
        message: "COS personnel not found or access denied",
        error: "RECORD_NOT_FOUND_OR_ACCESS_DENIED"
      });
    }

    const workflow = await assertActiveWorkflowAccess(req, existing.workflowRef, { write: true });
    const premiumConfig = getWorkflowPremiumConfig(workflow);
    const allowedFields = ["employeeFullName", "monthlySalary", "annualSalary", "statusOfAppointment"];

    const filteredUpdateFields = Object.keys(updateFields)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateFields[key];
        return obj;
      }, {});

    if (filteredUpdateFields.monthlySalary !== undefined && (!Number.isFinite(Number(filteredUpdateFields.monthlySalary)) || Number(filteredUpdateFields.monthlySalary) < 0)) {
      return res.status(400).json({ message: 'Monthly salary must be a non-negative number.' });
    }
    if (filteredUpdateFields.annualSalary !== undefined && (!Number.isFinite(Number(filteredUpdateFields.annualSalary)) || Number(filteredUpdateFields.annualSalary) < 0)) {
      return res.status(400).json({ message: 'Annual salary must be a non-negative number.' });
    }

    const premiumFields = applyCOSPremium(
      { ...existing.toObject(), ...filteredUpdateFields },
      isPremiumSelected(existing, premiumConfig) ? premiumConfig : { ...premiumConfig, enabled: false },
      { monthlySalaryChanged: filteredUpdateFields.monthlySalary !== undefined }
    );
    Object.assign(filteredUpdateFields, premiumFields);

    const updatedCOSPersonnel = await COSPersonnel.findOneAndUpdate(
      { _id: id, workflowRef: workflow._id, ...sanitizedFilters },
      { $set: filteredUpdateFields },
      { new: true }
    );

    if (!updatedCOSPersonnel) {
      return res.status(404).json({ 
        message: "COS personnel not found or access denied",
        error: "RECORD_NOT_FOUND_OR_ACCESS_DENIED"
      });
    }

    const summary = summarizeCOSRows(await COSPersonnel.find({ workflowRef: workflow._id }).lean());
    await syncCOSGrandTotalToMOOE(workflow._id, summary.total);
    await refreshProposalTotals(workflow._id);
    res.status(200).json({ personnel: updatedCOSPersonnel, summary });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
exports.deleteCOSPersonnel = async (req, res) => {
  try {
    const { id } = req.params;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    const existing = await COSPersonnel.findOne({
      _id: id,
      ...sanitizedFilters
    });

    if (!existing) {
      return res.status(404).json({ 
        message: "COS personnel not found or access denied",
        error: "RECORD_NOT_FOUND_OR_ACCESS_DENIED"
      });
    }

    const workflow = await assertActiveWorkflowAccess(req, existing.workflowRef, { write: true });
    await COSPersonnel.deleteOne({ _id: existing._id, workflowRef: workflow._id });
    const summary = summarizeCOSRows(await COSPersonnel.find({ workflowRef: workflow._id }).lean());
    await syncCOSGrandTotalToMOOE(workflow._id, summary.total);
    await refreshProposalTotals(workflow._id);

    res.status(200).json({ message: "COS personnel deleted successfully", summary });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
//GET GRAND TOTAL OF THE COS PERSONNEL - COS statusOfAppointment(FOR TOTAL COLUMN)\
exports.getGrandTotalCOS = async (req, res) => {
  try {
    const { region, proposalId, fiscalYear: requestedFiscalYear } = req.query;

    // Prefer submission workflow filters; fallback to hierarchical
    const hierarchicalFilters = req.submissionWorkflowFilters || req.hierarchicalFilters || {};
    const sanitizedFilters = filterHierarchicalFilters(hierarchicalFilters);

    // CRITICAL SECURITY CHECK: Ensure region is provided
    if (!region && !proposalId) {
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
    if (!requestedFiscalYear && (!activeSettings || activeSettings.fiscalYear == null)) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found."
      });
    }
    const fiscalYear = requestedFiscalYear || activeSettings.fiscalYear;

    // Build query with hierarchical filters
    let query = {
      statusOfAppointment: { $regex: /^COS$/i },
      fiscalYear,
      ...sanitizedFilters
    };
    if (region) query.region = region;
    if (proposalId) query.workflowRef = toWorkflowObjectId(proposalId);

    // 4. Fetch only COS personnel for that fiscal year AND region with hierarchical access
    const cosPersonnels = await COSPersonnel.find(query).lean();
    const grandTotal = roundCurrency(cosPersonnels.reduce((acc, curr) => acc + (Number(curr.Total) || 0), 0));
    // 7. Return fiscalYear + grandTotal + region
    return res.json({ fiscalYear, grandTotal, region, proposalId: proposalId || null });
  } catch (error) {
    console.error("Error in getGrandTotalCOS:", error);
    return res
      .status(error.statusCode || 500)
      .json({ message: "Server error", error });
  }
};

exports.getCOSPremiumSettings = async (req, res) => {
  try {
    const workflow = await assertActiveWorkflowAccess(req, req.query.proposalId);
    return res.status(200).json(premiumSettingsResponse(workflow));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.updateCOSPremiumSettings = async (req, res) => {
  try {
    const workflow = await assertActiveWorkflowAccess(req, req.params.proposalId, { write: true });
    if (typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({ message: 'Premium enabled must be true or false.' });
    }

    if (['SELECTED', 'EXCLUDED'].includes(req.body.selectionMode) && (!Array.isArray(req.body.selectedPersonnelIds) || req.body.selectedPersonnelIds.length === 0)) {
      return res.status(400).json({ message: 'Select at least one COS/JO personnel for the selected premium coverage.' });
    }

    const config = normalizePremiumConfig({
      enabled: req.body.enabled,
      percentage: req.body.percentage,
      selectionMode: req.body.selectionMode,
      selectedPersonnelIds: req.body.selectedPersonnelIds,
    });
    const updatedWorkflow = await NewProposalWorkflow.findByIdAndUpdate(
      workflow._id,
      {
        $set: {
          cosJoPremium: {
            ...config,
            updatedBy: getUserId(req),
            updatedByName: getUserName(req),
            updatedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );

    // The proposal configuration is the source of truth. Reapplying it is
    // deterministic and proposal-scoped, so a retry safely repairs a partial
    // infrastructure failure without duplicating premium amounts.
    const summary = await reapplyPremiumToWorkflow(updatedWorkflow, config);
    await refreshProposalTotals(updatedWorkflow._id);
    return res.status(200).json(premiumSettingsResponse(updatedWorkflow, summary));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Get COS Personnel by Parameters (for proposal workflow)
exports.getCOSByParams = async (req, res) => {
  try {
    const { proposalId, region, fiscalYear } = req.query;
    const query = {};

    // If proposalId is provided, filter by workflowRef (NewProposalWorkflow _id) so list is per-proposal
    if (proposalId) {
      query.workflowRef = toWorkflowObjectId(proposalId);
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
    if (fiscalYear || activeSettings) {
      query.fiscalYear = fiscalYear || activeSettings.fiscalYear;
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
    res.status(error.statusCode || 500).json({ message: error.message || "Failed to fetch COS data" });
  }
};
