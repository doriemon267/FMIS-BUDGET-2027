const mongoose = require("mongoose");
const PersonnelServices = require("../models/PersonnelServices");
const EmployeeMaster = require("../models/EmployeeList");
const MealAllowance = require("../models/mealAllowance");
const Settings = require("../models/Settings");
const Proposal = require('../models/Proposal');
const ProposalEditLog = require('../models/ProposalEditLog');
const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { getActiveSettingsWithCompensation, getCompensationField } = require("../utils/settingsUtils");
const { validateNonNegativeFields, validateNonNegativeInItems, PERSONNEL_NUMERIC_FIELDS } = require('../utils/validateNonNegative');
// Import ChildrenAllowance model safely
const ChildrenAllowance =
  mongoose.models.ChildrenAllowance || require("../models/childrenAllowance");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
  searchFilter,
} = require("../utils/controller_get_process");
const { roundTo2Decimals } = require("../utils/roundCurrency");

// Statuses that prevent Budget Preparer from editing
// Once forwarded to Reviewer or beyond, only return to Draft/Returned to Preparer allows editing
const LOCKED_PERSONNEL_STATUSES = [
  "Forwarded to Reviewer",
  "Forwarded to Approver",
  "Forwarded to Budget Officer",
  "Forwarded to Budget Planning Analyst",
  "Forwarded to Overall Budget Approver",
  "Approver Approved",
  "Officer Approved",
  "Division Submitted",
  "Department Verified",
  "Department Submitted",
  "Region Approved",
  "Office Approved",
  "Finalized",
  "Submitted",
  // Legacy statuses
  "Forwarded to Officer",
  "Under Review by Reviewer",
  "Reviewer Approved",
  "Under Review by Officer",
  "Under Review by Manager",
  "Office",
  "Office Submitted"
];

const parseBooleanQuery = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
};

const normalizeHierarchicalFilters = (filters = {}) => {
  if (!filters || typeof filters !== 'object') return {};
  if (filters.$and || filters.$or) {
    return filters;
  }

  const mapped = {};
  if (filters.region) mapped.region = filters.region;
  if (filters.department) mapped.department = filters.department;
  if (filters.division) mapped.division = filters.division;
  return mapped;
};

const recordMatchesFilters = (record, filters = {}) => {
  if (!filters || Object.keys(filters).length === 0) return true;
  if (filters.$and && Array.isArray(filters.$and)) {
    return filters.$and.every((condition) =>
      Object.entries(condition).every(([key, value]) => record[key] === value)
    );
  }
  return Object.entries(filters).every(([key, value]) => {
    if (key === '$or') {
      return Array.isArray(value) && value.some((condition) =>
        Object.entries(condition).every(([innerKey, innerValue]) => record[innerKey] === innerValue)
      );
    }
    return record[key] === value;
  });
};
// Add a function to sync meal allowance data
async function syncMealAllowanceData(employeeNumber, fiscalYear) {
  try {
    // Find the meal allowance record for this employee
    const mealAllowance = await MealAllowance.findOne({
      employeeNumber,
      fiscalYear,
    });
    // Check if employee is permanent (case insensitive)
    const personnel = await PersonnelServices.findOne({
      employeeNumber,
      fiscalYear,
      statusOfAppointment: { $regex: new RegExp("^PERMANENT$", "i") },
    });
    if (mealAllowance) {
      // Get the current settings
      const settings = await Settings.findOne({
        fiscalYear,
        isActive: true,
      }).lean();
      if (settings && settings.meal) {
        const monthlyAmount = mealAllowance.actualDays * settings.meal;
        const annualAmount = monthlyAmount * 12;
        const personnelDoc = await PersonnelServices.findOne({ employeeNumber, fiscalYear });
        if (!personnelDoc) return false;
        await PersonnelServices.updateOne(
          { _id: personnelDoc._id },
          { $set: { meal: annualAmount } }
        );
        const updatedPersonnel = await PersonnelServices.findOne({ _id: personnelDoc._id });
        if (updatedPersonnel) {
          const numericFields = [
            "annualSalary",
            "RATA",
            "PERA",
            "uniformALLOWANCE",
            "productivityIncentive",
            "medical",
            "meal",
            "cashGift",
            "additionalMedical",
            "midyearBonus",
            "yearEndBonus",
            "gsisPremium",
            "philhealthPremium",
            "pagibigPremium",
            "employeeCompensation",
            "subsistenceAllowanceMDS",
            "subsistenceAllowanceST",
            "overtimePay",
            "loyaltyAward",
            "earnedLeaves",
            "retirementBenefits",
            "terminalLeave",
            "courtAppearance",
            "hazardPay",
            "subsistenceAllowance",
            "honoraria",
            "childrenAllowance",
          ];
          const newTotal = roundTo2Decimals(numericFields.reduce(
            (acc, field) => acc + (Number(updatedPersonnel[field]) || 0),
            0
          ));
          await PersonnelServices.updateOne(
            { _id: updatedPersonnel._id },
            { Total: newTotal }
          );
        }
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error syncing meal allowance data:", error);
    return false;
  }
}
// Add a new endpoint to sync all meal allowances
exports.syncAllMealAllowances = async (req, res) => {
  try {
    const activeSettings = await getActiveSettingsWithCompensation();
    if (!activeSettings) {
      return res
        .status(400)
        .json({
          message: "Active settings not found",
          details: "No active settings available",
        });
    }
    const fiscalYear = activeSettings.fiscalYear;
    // Get all meal allowances for the fiscal year
    const mealAllowances = await MealAllowance.find({ fiscalYear });
    if (mealAllowances.length === 0) {
      return res
        .status(200)
        .json({
          message: "No meal allowances found for the current fiscal year",
        });
    }
    let syncCount = 0;
    for (const ma of mealAllowances) {
      const success = await syncMealAllowanceData(
        ma.employeeNumber,
        fiscalYear
      );
      if (success) {
        syncCount++;
      }
    }
    return res.status(200).json({
      message: `Successfully synced ${syncCount} meal allowance records`,
      fiscalYear,
    });
  } catch (error) {
    console.error("Error syncing all meal allowances:", error.stack);
    return res
      .status(500)
      .json({ message: "Server error", details: error.message });
  }
};
exports.getAllPersonnelServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      employeeFullName,
      statusOfAppointment,
      syncMealAllowances = false,
      region, // Add region parameter
      subsidyEligible,
      chargedToIncomeEligible,
      proposalId,
    } = req.query;

    console.log("DEBUG: getAllPersonnelServices called with params:", {
      chargedToIncomeEligible,
      page,
      limit,
      statusOfAppointment,
    });

    // DIAGNOSTIC: Check how many records have chargedToIncomeEligible = true in database
    const chargedToIncomCount = await PersonnelServices.countDocuments({ chargedToIncomeEligible: true });
    console.log("DEBUG: Total records with chargedToIncomeEligible=true in database:", chargedToIncomCount);

    // Get filters from middleware - prioritize submission workflow filters over hierarchical filters
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    
    // Use submission workflow filters if available (they include status filtering), otherwise use hierarchical filters
    const activeFilters = Object.keys(submissionWorkflowFilters).length > 0 ? submissionWorkflowFilters : hierarchicalFilters;

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      // If filters contain complex $and/$or conditions, return them as-is
      // This preserves the status filtering logic from the middleware
      if (filters.$and || filters.$or) {
        return filters;
      }

      // Handle simple key-value filters for backward compatibility
      const mapped = {};
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbFilters = mapFiltersToDb(activeFilters);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const activeSettings = await getActiveSettingsWithCompensation();
    if (!activeSettings) {
      return res
        .status(400)
        .json({
          message: "Active settings not found",
          details: "No active settings available",
        });
    }
    // Set strict fiscal year filter
    let query = {
      fiscalYear: activeSettings.fiscalYear, // Strict fiscal year filter
    };

    // Apply active filters as base
    if (Object.keys(dbFilters).length > 0) {
      if (dbFilters.$and) {
        query = {
          $and: [
            query,
            ...dbFilters.$and
          ]
        };
      } else {
        query = {
          ...query,
          ...dbFilters
        };
      }
    }

    // Only fetch personnel for active fiscal year
    if (search) {
      searchFilter(query, search, [
        "positionTitle",
        "employeeFullName",
        "department",
      ]);
    }
    textFilter(query, { employeeFullName });
    if (statusOfAppointment) {
      query.statusOfAppointment = statusOfAppointment;
    }
    // Note: Submission workflow filters are now included in activeFilters above

    // Add region filter if provided (and not already constrained by hierarchy)
    if (region) {
      if (query.$and) {
        query.$and.push({ region: region });
      } else if (!query.region) {
        query.region = region;
      }
    }

    const subsidyFilter = parseBooleanQuery(subsidyEligible);
    if (subsidyFilter !== null) {
      if (query.$and) {
        query.$and.push({ subsidyEligible: subsidyFilter });
      } else {
        query.subsidyEligible = subsidyFilter;
      }
    }
    
    const chargedToIncomeFilter = parseBooleanQuery(chargedToIncomeEligible);
    console.log("DEBUG: chargedToIncomeFilter parsed value:", chargedToIncomeFilter);
    
    if (chargedToIncomeFilter !== null) {
      if (query.$and) {
        query.$and.push({ chargedToIncomeEligible: chargedToIncomeFilter });
      } else {
        query.chargedToIncomeEligible = chargedToIncomeFilter;
      }
    }
    
    console.log("DEBUG: Final query before find:", JSON.stringify(query, null, 2));
    
    if (proposalId) {
      const proposalScope = [{ workflowRef: proposalId }];

      if (mongoose.Types.ObjectId.isValid(String(proposalId))) {
        proposalScope.push({ proposalId: new mongoose.Types.ObjectId(String(proposalId)) });
      }

      try {
        const legacyProposal = await Proposal.findOne({ workflowRef: proposalId }).select('_id').lean();
        if (legacyProposal?._id) {
          proposalScope.push({ proposalId: legacyProposal._id });
        }
      } catch (scopeErr) {
        console.warn('[getAllPersonnelServices] proposal scope fallback error:', scopeErr.message);
      }

      if (query.$and) {
        query.$and.push({ $or: proposalScope });
      } else {
        query = { $and: [query, { $or: proposalScope }] };
      }
    }

    const sortByField = orderBy || "createdAt";
    const sortOrder = order.toLowerCase() === "desc" ? -1 : 1;
    const sortQuery = { [sortByField]: sortOrder };
    // If syncMealAllowances is true, sync meal allowances before returning results
    if (syncMealAllowances === "true") {
      const mealAllowances = await MealAllowance.find({
        fiscalYear: activeSettings.fiscalYear,
      });
      for (const ma of mealAllowances) {
        await syncMealAllowanceData(
          ma.employeeNumber,
          activeSettings.fiscalYear
        );
      }
    }
    let personnelServices = await PersonnelServices.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sortQuery);
    let totalRecords = await PersonnelServices.countDocuments(query);
    
    console.log("DEBUG: Query results - found", personnelServices.length, "records out of", totalRecords, "total");
    if (chargedToIncomeFilter !== null) {
      console.log("DEBUG: Charged to income filter was applied, looking for chargedToIncomeEligible =", chargedToIncomeFilter);
    }
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
    const userIdString = userId ? String(userId) : undefined;
    const userRoles = req.user?.Roles || [];
    
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));
    
    // SUPER_ADMIN must filter by the region parameter passed from frontend (from employee page)
    // BUDGET_MANAGER sees ALL records (no filtering)
    // Other users are filtered by their organizational assignment
    if (!proposalId && isSuperAdmin && region) {
      // SUPER_ADMIN: Filter by the region parameter (selected on employee page)
      const filteredPersonnel = personnelServices.filter(ps => ps.region === region);
      personnelServices = filteredPersonnel;
      totalRecords = filteredPersonnel.length;
    } else if (!proposalId && !isSuperAdmin && !isBudgetManager && userIdString) {
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
          
          const filteredPersonnel = personnelServices.filter(ps => {
            if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
              return ps.division === assignedDivision;
            }
            if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
              return (ps.department || ps.Department) === assignedDepartment;
            }
            if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
              return ps.region === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });
          
          if (filteredPersonnel.length > 0 || userAssignment.assignmentLevel !== 'FULL') {
            personnelServices = filteredPersonnel;
            totalRecords = filteredPersonnel.length;
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getAllPersonnelServices:', err.message);
      }
    }
    
    // Recalculate fields: use stored values when present, else fallback to activeSettings (annual = monthly * 12 where applicable)
    personnelServices = personnelServices.map((personnel) => {
      const recalculatedSubsistenceAllowance = personnel.subsistenceAllowance ?? 0;
      const recalculatedSubsistenceAllowanceMDS =
        personnel.subsistenceAllowanceMDS || 0;
      const recalculatedSubsistenceAllowanceST =
        personnel.subsistenceAllowanceST || 0;
      const recalculatedLoyaltyAward = personnel.loyaltyAward || 0;
      const recalculatedOvertimePay = personnel.overtimePay || 0;
      const recalculatedAnnualSalary = (personnel.monthlySalary || 0) * 12;
      const recalculatedRATA = personnel.RATA ?? 0;
      const recalculatedPERA = (personnel.PERA != null && personnel.PERA !== 0)
        ? personnel.PERA
        : (activeSettings.PERA || 0) * 12;
      const recalculatedUniform = (personnel.uniformALLOWANCE != null && personnel.uniformALLOWANCE !== 0)
        ? personnel.uniformALLOWANCE
        : (activeSettings.uniformAllowance || 0) ;
      const recalculatedProductivityIncentive = (personnel.productivityIncentive != null && personnel.productivityIncentive !== 0)
        ? personnel.productivityIncentive
        : (activeSettings.productivityIncentive || 0);
      const recalculatedMedical = personnel.medical ?? 0;
      const recalculatedMeal = personnel.meal ?? 0;
      const recalculatedChildrenAllowance = personnel.childrenAllowance ?? 0;
      const recalculatedMidyearBonus = personnel.midyearBonus || personnel.monthlySalary || 0;
      const recalculatedCashGift = (personnel.cashGift != null && personnel.cashGift !== 0)
        ? personnel.cashGift
        : (activeSettings.cashGift || 0);
      const recalculatedAdditionalMedical =(personnel.additionalMedical != null && personnel.additionalMedical !== 0)
        ? personnel.additionalMedical
        : (activeSettings.additionalMedical || 0);
      const recalculatedYearEndBonus = personnel.yearEndBonus ?? 0;
      const recalculatedCourtAppearanceAmount = personnel.courtAppearance || 0;
      const recalculatedGsis = (personnel.gsisPremium != null && personnel.gsisPremium !== 0)
        ? personnel.gsisPremium
        : recalculatedAnnualSalary * (activeSettings.gsisPremium || 0);
      const isPermanent = String(personnel.statusOfAppointment || "").toUpperCase() === "PERMANENT";
      const recalculatedProvidentFund = isPermanent
        ? ((personnel.providentFund != null && personnel.providentFund !== 0)
            ? personnel.providentFund
            : recalculatedAnnualSalary * (activeSettings.providentFund || 0))
        : 0;
      // Calculate PhilHealth premium for 2025 per Circular 2019-0009
      let monthlyPhilhealthPremium;
      const monthlySalary = personnel.monthlySalary;
      if (monthlySalary <= 10000) {
        monthlyPhilhealthPremium = 500; // Fixed minimum for 2025
      } else if (monthlySalary >= 100000) {
        monthlyPhilhealthPremium = 5000; // Fixed maximum for 2025
      } else {
        monthlyPhilhealthPremium = monthlySalary * 0.05; // 5% rate for 2025
      }
      const recalculatedPhilhealth = (personnel.philhealthPremium != null && personnel.philhealthPremium !== 0)
        ? personnel.philhealthPremium
        : (monthlyPhilhealthPremium * 12) / 2;
      const recalculatedPagibig = (personnel.pagibigPremium != null && personnel.pagibigPremium !== 0)
        ? personnel.pagibigPremium
        : (activeSettings.pagibigPremium || 0) * 12;
      const recalculatedEmpComp = (personnel.employeeCompensation != null && personnel.employeeCompensation !== 0)
        ? personnel.employeeCompensation
        : (activeSettings.employeeCompensation || 0) * 12;
      const recalculatedTerminalLeave = personnel.terminalLeave || 0;
      const recalculatedearnedLeaves = personnel.earnedLeaves || 0;
      const recalculatedTotal =
        recalculatedAnnualSalary +
        recalculatedSubsistenceAllowance +
        recalculatedSubsistenceAllowanceMDS +
        recalculatedSubsistenceAllowanceST +
        recalculatedLoyaltyAward +
        recalculatedOvertimePay +
        recalculatedRATA +
        recalculatedPERA +
        recalculatedUniform +
        recalculatedProductivityIncentive +
        recalculatedMedical +
        recalculatedMeal +
        recalculatedChildrenAllowance +
        recalculatedCashGift +
        recalculatedAdditionalMedical +
        recalculatedMidyearBonus +
        recalculatedYearEndBonus +
        recalculatedCourtAppearanceAmount +
        recalculatedGsis +
        recalculatedProvidentFund +
        recalculatedPhilhealth +
        recalculatedPagibig +
        recalculatedearnedLeaves +
        recalculatedTerminalLeave +
        recalculatedEmpComp;
      return {
        ...personnel.toObject(),
        annualSalary: recalculatedAnnualSalary,
        subsistenceAllowance: recalculatedSubsistenceAllowance,
        subsistenceAllowanceMDS: recalculatedSubsistenceAllowanceMDS,
        subsistenceAllowanceST: recalculatedSubsistenceAllowanceST,
        loyaltyAward: recalculatedLoyaltyAward,
        overtimePay: recalculatedOvertimePay,
        RATA: recalculatedRATA,
        PERA: recalculatedPERA,
        uniformALLOWANCE: recalculatedUniform,
        productivityIncentive: recalculatedProductivityIncentive,
        medical: recalculatedMedical,
        meal: recalculatedMeal,
        childrenAllowance: recalculatedChildrenAllowance,
        cashGift: recalculatedCashGift,
        additionalMedical:recalculatedAdditionalMedical,
        midyearBonus: recalculatedMidyearBonus,
        yearEndBonus: recalculatedYearEndBonus,
        courtAppearance: recalculatedCourtAppearanceAmount,
        gsisPremium: recalculatedGsis,
        providentFund: recalculatedProvidentFund,
        philhealthPremium: recalculatedPhilhealth,
        pagibigPremium: recalculatedPagibig,
        employeeCompensation: recalculatedEmpComp,
        terminalLeave: recalculatedTerminalLeave,
        earnedLeaves: recalculatedearnedLeaves,
        Total: roundTo2Decimals(recalculatedTotal),
      };
    });
    return res.json({
      personnelServices,
      totalPages: Math.ceil(totalRecords / limitNum),
      currentPage: pageNum,
      totalRecords,
    });
  } catch (error) {
    console.error("Error in getAllPersonnelServices:", error.stack);
    return res
      .status(500)
      .json({ message: "Server error", details: error.message });
  }
};
// New endpoint to fetch PersonnelServices records by employeeNumber and fiscalYear
exports.getPersonnelServices = async (req, res) => {
  try {
    const { employeeNumber, fiscalYear } = req.query;
    if (!employeeNumber || !fiscalYear) {
      return res.status(400).json({
        message:
          "Missing required query parameters: employeeNumber and fiscalYear are required",
      });
    }
    const personnelServices = await PersonnelServices.find({
      employeeNumber,
      fiscalYear,
    }).lean();
    return res.status(200).json({
      personnelServices,
    });
  } catch (error) {
    console.error("Error fetching personnel services:", error.stack);
    return res.status(500).json({
      message: "Server error",
      details: error.message,
    });
  }
};
exports.bulkAddPersonnelServices = async (req, res) => {
  try {
    const { statusOfAppointment, RATA, region } = req.body;

    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.some((r) => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));

    // ⚠️ CRITICAL: Get user's assignment DIRECTLY to ensure proper filtering
    const userId = req.user.id;
    let userAssignment = null;
    if (!isSuperAdmin) {
      const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
      userAssignment = await HierarchicalUserAssignment.getUserPermissions(userId);

      if (!userAssignment || ['NONE', 'NO_ACCESS'].includes(userAssignment.assignmentLevel)) {
        return res.status(403).json({
          message: 'No organizational assignment found. Cannot perform bulk add.',
          code: 'NO_ORG_ASSIGNMENT'
        });
      }
    }

    // Get hierarchical filters from middleware (as backup)
    const hierarchicalFilters = req.hierarchicalFilters || {};
    // Get submission workflow data for correct org attribution
    const workflowData = req.submissionWorkflowData || {};
    // CRITICAL: Extract proposalId to link personnel services to specific proposal
    const workflowProposalId = req.body.proposalId || workflowData.proposalId; // NewProposalWorkflow _id
    
    // Check workflow status - prevent adding to locked proposals
    if (workflowProposalId) {
      const NewProposalWorkflow = require('../models/NewProposalWorkflow');
      const workflow = await NewProposalWorkflow.findById(workflowProposalId).select('status');
      if (workflow && LOCKED_PERSONNEL_STATUSES.includes(workflow.status)) {
        return res.status(403).json({
          error: "Cannot add entries",
          message: `Cannot add personnel services to proposal in '${workflow.status}' status. Only 'Draft' or 'Returned to Preparer' proposals can have new entries added.`
        });
      }
    }
    
    let legacyProposalPS = null;
    if (workflowProposalId) {
      legacyProposalPS = await Proposal.findOne({ workflowRef: workflowProposalId }).select('_id');
      if (!legacyProposalPS) {
        console.warn('[bulkAddPersonnelServices] No legacy Proposal found for workflowRef:', workflowProposalId);
        // FALLBACK: Try to infer legacy proposal from org keys (same as Income controller)
        try {
          const Settings = require('../models/Settings');
          const activeSettings = await Settings.findOne({ isActive: true });
          const inferQuery = {
            fiscalYear: activeSettings?.fiscalYear ? String(activeSettings.fiscalYear) : req.body.fiscalYear,
            budgetType: activeSettings?.budgetType || req.body.budgetType,
            region: workflowData.region || req.body.region
          };
          Object.keys(inferQuery).forEach(k => inferQuery[k] === undefined && delete inferQuery[k]);
          const inferredLegacy = await Proposal.findOne(inferQuery).select('_id');
          if (inferredLegacy) {
            legacyProposalPS = inferredLegacy;
            console.warn('[bulkAddPersonnelServices] Inferred legacy Proposal linkage:', legacyProposalPS._id);
          } else {
            console.warn('[bulkAddPersonnelServices] Inference failed; PS entries will remain unlinked');
          }
        } catch (infErr) {
          console.warn('[bulkAddPersonnelServices] Inference error:', infErr.message);
        }
      }
    } else {
      console.warn('[bulkAddPersonnelServices] Missing workflow proposalId; PS entries will not aggregate');
      // FALLBACK: Try to infer if we have enough org info
      try {
        const Settings = require('../models/Settings');
        const activeSettings = await Settings.findOne({ isActive: true });
        const inferQuery = {
          fiscalYear: activeSettings?.fiscalYear ? String(activeSettings.fiscalYear) : req.body.fiscalYear,
          budgetType: activeSettings?.budgetType || req.body.budgetType,
          region: workflowData.region || req.body.region
        };
        Object.keys(inferQuery).forEach(k => inferQuery[k] === undefined && delete inferQuery[k]);
        if (Object.keys(inferQuery).length > 0) {
          const inferredLegacy = await Proposal.findOne(inferQuery).select('_id');
          if (inferredLegacy) {
            legacyProposalPS = inferredLegacy;
            console.warn('[bulkAddPersonnelServices] Inferred legacy Proposal from org keys:', legacyProposalPS._id);
          }
        }
      } catch (infErr) {
        console.warn('[bulkAddPersonnelServices] Org-key inference error:', infErr.message);
      }
    }
    const userLevel = isSuperAdmin
      ? (workflowData.userLevel || 'REGION')
      : (userAssignment.assignmentLevel || workflowData.userLevel);
    
    // Get the user's ACTUAL assigned organizational units
    const userRegion = isSuperAdmin
      ? (req.body.region || workflowData.region)
      : (userAssignment.regions?.[0]?.regionName || workflowData.region || req.body.region);
    const userDepartment = isSuperAdmin
      ? (req.body.department || workflowData.department)
      : (userAssignment.departments?.[0]?.departmentName || workflowData.department || req.body.department);
    const userDivision = isSuperAdmin
      ? (req.body.division || workflowData.division)
      : (userAssignment.divisions?.[0] || workflowData.division || req.body.division);

    if (isSuperAdmin && !userRegion) {
      return res.status(400).json({
        message: 'Region is required for SUPER_ADMIN bulk add.',
        code: 'REGION_REQUIRED'
      });
    }
    
    const ownerRegion = userRegion;
    const ownerDepartment = userDepartment;
    const ownerDivision = userLevel === 'DEPARTMENT' ? null : userDivision;

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          // Map lowercase to database field names (uppercase first letter)
          if (condition.region) conditionMapped.Region = condition.region;
          if (condition.department) conditionMapped.Department = condition.department;
          if (condition.division) conditionMapped.Division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      // Map lowercase to database field names (uppercase first letter)
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      return mapped;
    };

    console.log('🔍 [BULK ADD] ==================== USER ASSIGNMENT ====================');
    console.log('🔍 [BULK ADD] User ID:', userId);
    console.log('🔍 [BULK ADD] Is SUPER_ADMIN:', isSuperAdmin);
    console.log('🔍 [BULK ADD] Assignment Level:', userAssignment?.assignmentLevel || userLevel);
    console.log('🔍 [BULK ADD] Assigned Region:', userRegion);
    console.log('🔍 [BULK ADD] Assigned Department:', userDepartment);
    console.log('🔍 [BULK ADD] Assigned Division:', userDivision);
    console.log('🔍 [BULK ADD] =================================================================');

    const bodyNonNeg = validateNonNegativeFields(req.body, PERSONNEL_NUMERIC_FIELDS);
    if (!bodyNonNeg.valid) {
      return res.status(400).json({ message: bodyNonNeg.message });
    }
    if (!statusOfAppointment || !RATA) {
      return res
        .status(400)
        .json({
          message:
            "Missing required fields: statusOfAppointment and RATA are required",
        });
    }
    const activeSettings = await getActiveSettingsWithCompensation();
    if (!activeSettings) {
      return res
        .status(400)
        .json({
          message: "Active settings not found",
          details: "No active settings available",
        });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const budgetType = activeSettings.budgetType;

    // ⚠️ CRITICAL: Build STRICT query using DIRECT user assignment
    // This is the PRIMARY fix - no more middleware filter merging
    let employeeQuery = {
      StatusOfAppointment: statusOfAppointment,
      fiscalYear: fiscalYear
    };

    // Include both Active and Inactive employees to ensure VACANT positions are included
    // VACANT positions may be marked as Inactive but should still be available for bulk add
    let statusConditions = [
      { employeeStatus: "Active" },
      { employeeStatus: "Inactive", EmployeeFullName: { $regex: /^VACANT$/i } }
    ];

    // Apply hierarchical filtering based on user's DIRECT assignment level
    if (userRegion) {
      statusConditions.forEach(condition => {
        condition.Region = userRegion;
      });
    }

    if (!isSuperAdmin && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL', 'DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
      if (userDepartment) {
        statusConditions.forEach(condition => {
          condition.Department = userDepartment;
        });
      }
    }

    if (!isSuperAdmin && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
      if (userDivision) {
        statusConditions.forEach(condition => {
          condition.Division = userDivision;
        });
        console.log('🔍 [BULK ADD] ⚠️⚠️⚠️ DIVISION LEVEL - STRICT FILTER:', userDivision);
      }
    }

    employeeQuery.$or = statusConditions;

    console.log('🔍 [BULK ADD] ==================== FINAL QUERY ====================');
    console.log('🔍 [BULK ADD] Employee Query:', JSON.stringify(employeeQuery, null, 2));
    console.log('🔍 [BULK ADD] Expected Division:', userDivision || 'N/A');
    console.log('🔍 [BULK ADD] ================================================================');

    // Fetch only Active employees within user's hierarchical scope
    // This will now respect the Division (Responsibility Center) or Department (Office) filters
    const employees = await EmployeeMaster.find(employeeQuery);
    
    console.log('🔍 [BULK ADD] ==================== QUERY RESULTS ====================');
    console.log('🔍 [BULK ADD] Found employees:', employees.length);
    
    // Extract unique divisions from results for verification
    const divisions = [...new Set(employees.map(emp => emp.Division).filter(Boolean))];
    const departments = [...new Set(employees.map(emp => emp.Department).filter(Boolean))];
    
    console.log('🔍 [BULK ADD] Unique Divisions in results:', divisions);
    console.log('🔍 [BULK ADD] Unique Departments in results:', departments);
    console.log('🔍 [BULK ADD] ⚠️ EXPECTED DIVISION:', userDivision);
    console.log('🔍 [BULK ADD] ⚠️ MATCH:', divisions.length === 1 && divisions[0] === userDivision ? 'YES ✓' : 'NO ✗');
    console.log('🔍 [BULK ADD] ================================================================');
    
    // Log how many employees were found
    console.log(`🔍 [BULK ADD] Found ${employees.length} employee(s) matching criteria`);
    
    // Log sample of divisions found (for debugging)
    if (employees.length > 0) {
      const divisions = [...new Set(employees.map(e => e.Division))];
      console.log(`🔍 [BULK ADD] Unique Divisions found:`, divisions);
      const departments = [...new Set(employees.map(e => e.Department))];
      console.log(`🔍 [BULK ADD] Unique Departments found:`, departments);
    }
    
    // Check if no employees found
    if (employees.length === 0) {
      const scopeInfo = userLevel === 'DIVISION' 
        ? `Division/Responsibility Center: ${ownerDivision}` 
        : userLevel === 'DEPARTMENT' 
        ? `Department/Office: ${ownerDepartment}` 
        : `Region: ${ownerRegion}`;
      
      return res.status(200).json({
        added: [],
        duplicates: [],
        message: `No active ${statusOfAppointment} employees found in your assigned scope (${scopeInfo}) for fiscal year ${fiscalYear}. Please verify that employees are properly assigned to your Office/Responsibility Center in the Employee Master List.`
      });
    }
    const personnelServicesData = [];
    const duplicates = [];

    // 🚀 Fetch existing personnel for duplicate check.
    // When workflowProposalId is set: scope by that proposal. Otherwise use fiscalYear only (no region) so we catch all duplicates in the fiscal year.
    const fiscalYearNorm = fiscalYear != null ? String(fiscalYear) : undefined;
    const existingQuery = {
      ...(fiscalYearNorm && { fiscalYear: { $in: [fiscalYearNorm, Number(fiscalYear)] } }),
      ...(workflowProposalId ? { workflowRef: workflowProposalId } : {})
    };
    const existingServices = await PersonnelServices.find(existingQuery)
      .select('employeeNumber itemNumber positionTitle department division section gradelevel_SG statusOfAppointment employeeFullName').lean();

    // Build lookup maps; use normalized keys so we don't miss duplicates (e.g. string coercion, trim).
    const existingByEmployeeNumber = new Map();
    const existingVacantByDetails = new Set();
    const existingByItemNumber = new Map();

    existingServices.forEach(s => {
      const empNum = s.employeeNumber != null ? String(s.employeeNumber).trim() : '';
      if (empNum && empNum !== 'VACANT') {
        existingByEmployeeNumber.set(empNum, s);
      }
      const itemNum = s.itemNumber != null ? String(s.itemNumber).trim() : '';
      if (itemNum) {
        existingByItemNumber.set(itemNum, s);
      }
      const isVacant = s.employeeFullName && String(s.employeeFullName).toUpperCase() === 'VACANT';
      if (isVacant) {
        const vacantKey = `${s.positionTitle}|${s.department}|${s.division || ''}|${s.section || ''}|${s.gradelevel_SG || ''}`;
        existingVacantByDetails.add(vacantKey);
      }
    });

    for (const employee of employees) {
      let existingPersonnelService = null;
      const isVacant = employee.EmployeeFullName && String(employee.EmployeeFullName).toUpperCase().trim() === 'VACANT';

      if (isVacant) {
        if (employee.ItemNumber && String(employee.ItemNumber).trim() !== '') {
          existingPersonnelService = existingByItemNumber.get(String(employee.ItemNumber).trim());
        }
        if (!existingPersonnelService) {
          const vacantKey = `${employee.PositionTitle}|${employee.Department}|${employee.Division || ''}|${employee.Section || ''}|${employee.SG?.toString() || ''}`;
          if (existingVacantByDetails.has(vacantKey)) existingPersonnelService = true;
        }
      } else {
        const lookupKey = employee.EmployeeID != null ? String(employee.EmployeeID).trim() : '';
        if (lookupKey) {
          existingPersonnelService = existingByEmployeeNumber.get(lookupKey);
        }
        if (!existingPersonnelService && employee.ItemNumber && String(employee.ItemNumber).trim() !== '') {
          existingPersonnelService = existingByItemNumber.get(String(employee.ItemNumber).trim());
        }
      }
      
      if (existingPersonnelService) {
        const identifier = isVacant 
          ? `${employee.PositionTitle} (${employee.Department})`
          : `${employee.EmployeeFullName} (${employee.EmployeeID})`;
        
        console.log(`Skipping ${isVacant ? 'VACANT position' : 'employee'} ${identifier} - already exists in fiscal year ${fiscalYear}`);
        duplicates.push({
          employeeNumber: employee.EmployeeID || 'VACANT',
          employeeName: employee.EmployeeFullName,
          positionTitle: employee.PositionTitle,
          department: employee.Department,
          division: employee.Division,
          existingStatus: existingPersonnelService && typeof existingPersonnelService === 'object' ? existingPersonnelService.statusOfAppointment : undefined,
          existingId: existingPersonnelService && typeof existingPersonnelService === 'object' ? existingPersonnelService._id : undefined,
          isVacant: isVacant
        });
        continue;
      }
      const monthlySalary = employee.Rate || 0;
      const annualSalary = monthlySalary * 12;
      const gradeLevelSG = employee.SG?.toString() || "";
      const statusAppointment = employee.StatusOfAppointment;
      const rataAmount =
        RATA.find((item) => item.grade === gradeLevelSG)?.amount || 0;
      // Calculate PhilHealth premium for 2025 per Circular 2019-0009
      let monthlyPhilhealthPremium;
      if (monthlySalary <= 10000) {
        monthlyPhilhealthPremium = 500; // Fixed minimum for 2025
      } else if (monthlySalary >= 100000) {
        monthlyPhilhealthPremium = 5000; // Fixed maximum for 2025
      } else {
        monthlyPhilhealthPremium = monthlySalary * 0.05; // 5% rate for 2025
      }
      const orgLevelFromUser =
        userLevel === 'DIVISION'
          ? 'DIVISION'
          : userLevel === 'DEPARTMENT'
            ? 'DEPARTMENT'
            : userLevel === 'REGION'
              ? 'REGION'
              : null;
      const resolvedOriginalLevel =
        workflowData.originalLevel || orgLevelFromUser || 'REGION';
      const resolvedWorkflowLevel =
        workflowData.workflowLevel || workflowData.originalLevel || orgLevelFromUser || 'BUDGET PREPARER';

      let personnelService = {
        processBy: req.body.processBy || "Unknown",
        processDate: new Date(),
        fiscalYear: fiscalYear,
        budgetType: budgetType,
        itemNumber: employee.ItemNumber || "",
        positionTitle: employee.PositionTitle || "",
        gradelevel_SG: gradeLevelSG,
        step: employee.Step || 0,
        gradelevel_JG: employee.JG || "",
        employeeFullName: employee.EmployeeFullName || "",
        employeeNumber: employee.EmployeeID || "",
        DateOfAppointment: employee.DateOfAppointment || null,
        DateOfBirth: employee.DateOfBirth || null,
        // CRITICAL: Use the employee's ORIGINAL Department/Division/Section from db.employees
        // DO NOT replace with user's assignment - that's only for filtering!
        department: employee.Department || "",
        division: employee.Division || "",
        section: employee.Section || "",
        unit: employee.Unit || "",
        // Use the employee's ORIGINAL Region from db.employees
        region: employee.Region || "",
        statusOfAppointment: statusAppointment,
        employeeStatus: employee.employeeStatus,
        monthlySalary: monthlySalary,
        noOfDependent: req.body.noOfDependent || 0,
        hazardPay: req.body.hazardPay || 0,
        subsistenceAllowance: req.body.subsistenceAllowance || 0,
        honoraria: req.body.honoraria || 0,
        childrenAllowance: req.body.childrenAllowance || 0,
        annualSalary: annualSalary,
        RATA: rataAmount * 12,
        PERA: (req.body.PERA || activeSettings.PERA || 0) * 12,
        uniformALLOWANCE: (activeSettings.uniformAllowance || 0),
        productivityIncentive: (activeSettings.productivityIncentive || 0),
        medical: 0, // Only set via /medicalAllowance page for personnel who qualify
        meal: 0,
        cashGift: (activeSettings.cashGift || 0),
        // Additional Medical: default to 0 if not configured in active settings
        additionalMedical: (activeSettings.additionalMedical || 0),
        midyearBonus: monthlySalary,
        yearEndBonus: monthlySalary,
        gsisPremium: annualSalary * (activeSettings.gsisPremium || 0),
        // Provident Fund: percentage of annual salary for PERMANENT only
        providentFund: statusAppointment === "PERMANENT"
          ? annualSalary * (activeSettings.providentFund || 0)
          : 0,
        philhealthPremium: (monthlyPhilhealthPremium * 12) / 2,
        pagibigPremium: (activeSettings.pagibigPremium || 0) * 12,
        employeeCompensation: (activeSettings.employeeCompensation || 0) * 12,
        subsistenceAllowanceMDS: 0,
        subsistenceAllowanceST: 0,
        overtimePay: 0,
        loyaltyAward: 0,
        earnedLeaves: monthlySalary * 30 * (activeSettings.earnedLeaves || 0), // Assuming 12 months of leaves for each employee
        retirementBenefits: 0,
        terminalLeave: 0,
        courtAppearance: 0,
        Total: 0,
        // Submission workflow tagging - tracks WHO processed this record, NOT the employee's org assignment
        originalLevel: resolvedOriginalLevel,
        workflowLevel: resolvedWorkflowLevel,
        status: req.body.status || 'Draft',
        // Track the user's assignment for workflow purposes (NOT the employee's org)
        processorRegion: ownerRegion || null,
        processorDepartment: ownerDepartment || null,
        processorDivision: ownerDivision || null,
        // CRITICAL: Link to specific proposal to prevent cross-proposal data mixing
        ...(legacyProposalPS?._id && { proposalId: legacyProposalPS._id }),
        ...(workflowProposalId && { workflowRef: workflowProposalId }),
        // Track who created this record for SUPER_ADMIN visibility filtering
        createdBy: req.user?.id ? String(req.user.id) : undefined
      };
      if (statusAppointment === "COS") {
        personnelService = {
          ...personnelService,
          RATA: 0,
          PERA: 0,
          uniformALLOWANCE: 0,
          productivityIncentive: 0,
          additionalMedical:0,
          medical: 0,
          meal: 0,
          cashGift: 0,
          midyearBonus: 0,
          yearEndBonus: 0,
          gsisPremium: 0,
          providentFund: 0,
          philhealthPremium: 0,
          pagibigPremium: 0,
          employeeCompensation: 0,
          loyaltyAward: 0,
          earnedLeaves: 0,
          retirementBenefits: 0,
          terminalLeave: 0,
          Total: annualSalary,
        };
      } else {
        const numericFields = [
          "annualSalary",
          "RATA",
          "PERA",
          "uniformALLOWANCE",
          "productivityIncentive",
          "medical",
          "meal",
          "cashGift",
          "midyearBonus",
          "yearEndBonus",
          "gsisPremium",
          "providentFund",
          "philhealthPremium",
          "pagibigPremium",
          "employeeCompensation",
          "subsistenceAllowanceMDS",
          "subsistenceAllowanceST",
          "overtimePay",
          "loyaltyAward",
          "earnedLeaves",
          "retirementBenefits",
          "terminalLeave",
          "courtAppearance",
          "hazardPay",
          "subsistenceAllowance",
          "additionalMedical",
          "honoraria",
          "childrenAllowance",
        ];
        personnelService.Total = roundTo2Decimals(numericFields.reduce(
          (acc, field) => acc + (Number(personnelService[field]) || 0),
          0
        ));
      }
      personnelServicesData.push(personnelService);
    }
      if (personnelServicesData.length > 0) {
      const addedPersonnelServices = await PersonnelServices.insertMany(
        personnelServicesData
      );
        // Direct recompute for linked legacy proposal
        if (legacyProposalPS?._id) {
          try {
            const proposalDoc = await Proposal.findById(legacyProposalPS._id);
            await proposalDoc?.recomputeTotals();
          } catch (e) {
            console.warn('[bulkAddPersonnelServices] recomputeTotals failed', e.message);
          }
        }
      // Non-blocking: trigger Proposal totals recalculation for affected proposals using first added item's keys
      try {
        const first = addedPersonnelServices[0] || {};
        const keys = {
          fiscalYear: first.fiscalYear,
          budgetType: first.budgetType,
          region: first.region,
          processBy: first.processBy
        };
        if (keys.fiscalYear && keys.region) {
          const strictQuery = {
            fiscalYear: keys.fiscalYear,
            budgetType: keys.budgetType,
            region: keys.region,
            ...(keys.processBy ? { processBy: keys.processBy } : {})
          };
          let proposals = await Proposal.find(strictQuery).select('_id').lean();
          if (!proposals.length) {
            const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
            proposals = await Proposal.find(relaxedQuery).select('_id').lean();
          }
          if (proposals.length) {
            await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
            console.log(`🔄 [PS] Recalculated totals for ${proposals.length} proposal(s)`, keys);
          }
        }
      } catch (recErr) {
        console.warn('⚠️ [PS] Proposal totals recalculation skipped:', recErr?.message);
      }
      res.status(200).json({
        added: addedPersonnelServices,
        duplicates: duplicates,
        message: `Successfully added ${addedPersonnelServices.length} personnel services. ${duplicates.length} duplicates were skipped.`
      });
    } else {
      res.status(200).json({ 
        added: [],
        duplicates: duplicates,
        message: `No new personnel services to add. ${duplicates.length} duplicates were found.` 
      });
    }
  } catch (error) {
    console.error("Error in bulkAddPersonnelServices:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.updatePersonnelService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

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

    const allowedFields = [
      "employeeFullName",
      "noOfDependent",
      "hazardPay",
      "subsistenceAllowance",
      "honoraria",
      "childrenAllowance",
      "Total",
      "subsidyAmount",
      "subsidyEligible",
      "subsidyNotes",
    ];
    const filteredUpdateFields = Object.keys(updateFields)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateFields[key];
        return obj;
      }, {});
    if (filteredUpdateFields.noOfDependent !== undefined) {
      filteredUpdateFields.childrenAllowance =
        filteredUpdateFields.noOfDependent * 30 * 12;
    }
    const nonNeg = validateNonNegativeFields(filteredUpdateFields, PERSONNEL_NUMERIC_FIELDS);
    if (!nonNeg.valid) {
      return res.status(400).json({ message: nonNeg.message });
    }
    // First, find the personnel service record to check access
    const personnelServices = await PersonnelServices.findById(id);
    if (!personnelServices) {
      return res
        .status(404)
        .json({
          message: "Personnel service not found",
          details: "No record found for the given ID",
        });
    }

    // Check if the record has been submitted and prevent editing
    if (LOCKED_PERSONNEL_STATUSES.includes(personnelServices.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit personnel service record that has been submitted or approved"
      });
    }

    // Check if user has access to this record based on hierarchical filters
    let hasAccess = true;
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        hasAccess = dbHierarchicalFilters.$and.every(condition => {
          return Object.entries(condition).every(([key, value]) => {
            return personnelServices[key] === value;
          });
        });
      } else {
        hasAccess = Object.entries(dbHierarchicalFilters).every(([key, value]) => {
          return personnelServices[key] === value;
        });
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to update this personnel service record"
      });
    }

    const updatedPersonnelService = await PersonnelServices.findByIdAndUpdate(
      id,
      { $set: filteredUpdateFields },
      { new: true }
    );
    if (!updatedPersonnelService) {
      return res
        .status(404)
        .json({
          message: "Personnel service not found",
          details: "No record found for the given ID",
        });
    }
    const numericFields = [
      "annualSalary",
      "RATA",
      "PERA",
      "uniformALLOWANCE",
      "productivityIncentive",
      "medical",
      "meal",
      "cashGift",
      "midyearBonus",
      "yearEndBonus",
      "gsisPremium",
      "philhealthPremium",
      "pagibigPremium",
      "employeeCompensation",
      "subsistenceAllowanceMDS",
      "subsistenceAllowanceST",
      "overtimePay",
      "loyaltyAward",
      "earnedLeaves",
      "retirementBenefits",
      "terminalLeave",
      "courtAppearance",
      "hazardPay",
      "subsistenceAllowance",
      "additionalMedical",
      "honoraria",
      "childrenAllowance",
    ];
    updatedPersonnelService.Total = roundTo2Decimals(numericFields.reduce(
      (acc, field) => acc + (Number(updatedPersonnelService[field]) || 0),
      0
    ));
    await updatedPersonnelService.save();
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: updatedPersonnelService?.fiscalYear,
        budgetType: updatedPersonnelService?.budgetType,
        region: updatedPersonnelService?.region,
        processBy: updatedPersonnelService?.processBy
      };
      if (keys.fiscalYear && keys.region) {
        const strictQuery = {
          fiscalYear: keys.fiscalYear,
          budgetType: keys.budgetType,
          region: keys.region,
          ...(keys.processBy ? { processBy: keys.processBy } : {})
        };
        let proposals = await Proposal.find(strictQuery).select('_id').lean();
        if (!proposals.length) {
          const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
          proposals = await Proposal.find(relaxedQuery).select('_id').lean();
        }
        if (proposals.length) {
          await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
          console.log(`🔄 [PS] Recalculated totals for ${proposals.length} proposal(s)`, keys);
        }
      }
    } catch (recErr) {
      console.warn('⚠️ [PS] Proposal totals recalculation skipped:', recErr?.message);
    }
    res.status(200).json(updatedPersonnelService);
  } catch (error) {
    console.error("Error in updatePersonnelService:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getAllPerServices = async (req, res) => {
  try {
    const { fiscalYear, region, subsidyEligible } = req.query;
    // Get active settings to determine fiscal year if not provided
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ 
        message: "Active settings not found", 
        details: "No active settings available" 
      });
    }
    // Build query based on hierarchical access
    let query = {
      fiscalYear: fiscalYear || activeSettings.fiscalYear
    };
    // Apply submission workflow filters from middleware
    if (req.submissionWorkflowFilters) {
      Object.assign(query, req.submissionWorkflowFilters);
    }
    
    // Apply hierarchical filters
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    
    // Fallback region filter if provided and not already constrained
    if (region && !query.region && (!query.$and || !query.$and.some(condition => condition.region))) {
      query.region = region;
    }

    const subsidyFilter = parseBooleanQuery(subsidyEligible);
    if (subsidyFilter !== null) {
      if (query.$and) {
        query.$and.push({ subsidyEligible: subsidyFilter });
      } else {
        query.subsidyEligible = subsidyFilter;
      }
    }
    
  const personnelServices = await PersonnelServices.find(query);
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel services:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getGrandTotalPermanent = async (req, res) => {
  try {
    let activeSettings = await getActiveSettingsWithCompensation();
    if (!activeSettings) {
      activeSettings = await Settings.findOne({})
        .sort({ fiscalYear: -1 })
        .lean();
    }
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active or recent settings available",
      });
    }
    const { fiscalYear } = activeSettings;
    // Get region from query parameters
    const { region, search, employeeFullName, orderBy, order = 'asc' } = req.query;
    // Build query criteria - match list endpoint: exclude charged-to-income
    const query = {
      statusOfAppointment: "PERMANENT",
      fiscalYear,
      chargedToIncomeEligible: false, // Same as table list - exclude charged-to-income
    };
    // Align totals with table filters
    if (search) {
      searchFilter(query, search, [
        "positionTitle",
        "employeeFullName",
        "department",
      ]);
    }
    textFilter(query, { employeeFullName });
    // Merge hierarchical read filters if present (ensure totals match visible table scope)
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Add region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }
    // Use stored Total (same as table rows) - ensures top TOTAL row and bottom TOTAL match
    const personnelServices = await PersonnelServices.find(query).lean();
    const grandTotal = personnelServices.reduce((acc, p) => acc + (Number(p.Total) || 0), 0);

    return res.json({ fiscalYear, grandTotal: roundTo2Decimals(grandTotal) });
  } catch (error) {
    console.error("Error in getGrandTotalPermanent:", error.stack);
    return res
      .status(500)
      .json({ message: "Server error", details: error.message });
  }
};
exports.getGrandTotalCasual = async (req, res) => {
  try {
    let activeSettings = await getActiveSettingsWithCompensation();
    if (!activeSettings) {
      activeSettings = await Settings.findOne({})
        .sort({ fiscalYear: -1 })
        .lean();
    }
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active or recent settings available",
      });
    }
    const { fiscalYear } = activeSettings;
    // Get region from query parameters
    const { region, search, employeeFullName, orderBy, order = 'asc' } = req.query;
    // Build query criteria
    const query = {
      statusOfAppointment: "CASUAL",
      fiscalYear,
      chargedToIncomeEligible: false, // Same as table list - exclude charged-to-income
    };
    // Align totals with table filters
    if (search) {
      searchFilter(query, search, [
        "positionTitle",
        "employeeFullName",
        "department",
      ]);
    }
    textFilter(query, { employeeFullName });
    // Merge hierarchical read filters if present (ensure totals match visible table scope)
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Add region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }
    // Use stored Total (same as table rows) - ensures top TOTAL row and bottom TOTAL match
    const personnelServices = await PersonnelServices.find(query).lean();
    const grandTotal = personnelServices.reduce((acc, p) => acc + (Number(p.Total) || 0), 0);
    return res.json({ fiscalYear, grandTotal: roundTo2Decimals(grandTotal) });
  } catch (error) {
    console.error("Error in getGrandTotalCasual:", error.stack);
    return res
      .status(500)
      .json({ message: "Server error", details: error.message });
  }
};
exports.deleteAllPersonnelss = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active settings available",
      });
    }
    const { fiscalYear } = activeSettings;
    await PersonnelServices.deleteMany({ fiscalYear });
    res.status(200).json({
      message: `All personnel services for fiscal year ${fiscalYear} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting personnel services:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getGrandTotal = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active settings available",
      });
    }
    const { fiscalYear } = activeSettings;
    // Get region from query parameters
    const { region } = req.query;
    // Build match criteria
    const matchCriteria = { fiscalYear };
    // Add region filter if provided
    if (region) {
      matchCriteria.region = region;
    }
    const grandTotal = await PersonnelServices.aggregate([
      { $match: matchCriteria },
      { $group: { _id: null, grandTotal: { $sum: "$Total" } } },
      { $project: { _id: 0, grandTotal: 1 } },
    ]);
    const raw = grandTotal[0] || { grandTotal: 0 };
    res.status(200).json({ grandTotal: roundTo2Decimals(raw.grandTotal || 0) });
  } catch (error) {
    console.error("Error fetching grand total:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getPersonnelHiredBeforeJune1988 = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active settings available",
      });
    }
    const { fiscalYear } = activeSettings;
    // Get region from query parameters, user context, or headers
    const region =
      req.query.region || req.user?.Region || req.headers["x-region"];
    // Build filter object
    const filter = {
      fiscalYear,
      DateOfAppointment: { $lt: new Date("1988-06-01"), $ne: null },
    };
    // Add region filter if provided
    if (region) {
      filter.region = region;
    }
    const personnel = await PersonnelServices.find(filter);
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getPersonnelHiredBeforeJune1988 = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings || !activeSettings.fiscalYear) {
      return res.status(400).json({
        message: "Active settings with a fiscalYear not found",
        details: "No active settings available",
      });
    }
    const { fiscalYear } = activeSettings;

    // Load user's hierarchical assignment for access control
    const userId = req.user.id;
    let userAssignment = null;
    try {
      userAssignment = await HierarchicalUserAssignment.getUserPermissions(userId);
    } catch (error) {
      console.warn('Could not load hierarchical assignment for user:', userId, error.message);
    }

    // Get region from query parameters (for backward compatibility)
    const requestedRegion = req.query.region;

    // Build base filter object
    const filter = {
      fiscalYear,
      DateOfAppointment: { $lt: new Date("1988-06-01"), $ne: null },
    };

    // Apply hierarchical access control
    if (userAssignment) {
      switch (userAssignment.assignmentLevel) {
        case 'DIVISION':
          // Division users can only access their specific division data
          if (userAssignment.divisions && userAssignment.divisions.length > 0) {
            filter.$and = filter.$and || [];
            filter.$and.push(
              { region: userAssignment.regions[0]?.regionName },
              { department: userAssignment.departments[0]?.departmentName },
              { division: userAssignment.divisions[0] }
            );
          }
          break;
        case 'DEPARTMENT':
          // Department users can access all divisions within their department
          if (userAssignment.departments && userAssignment.departments.length > 0) {
            filter.$and = filter.$and || [];
            filter.$and.push(
              { region: userAssignment.regions[0]?.regionName },
              { department: userAssignment.departments[0]?.departmentName }
            );
          }
          break;
        case 'REGION':
          // Region users can access all departments and divisions within their region
          if (userAssignment.regions && userAssignment.regions.length > 0) {
            filter.region = userAssignment.regions[0]?.regionName;
          }
          break;
        case 'FULL':
          // Full access users can access everything, but if they have specific region assignments,
          // they should still be filtered to those regions
          if (userAssignment.regions && userAssignment.regions.length > 0) {
            filter.region = { $in: userAssignment.regions.map(r => r.regionName) };
          }
          // If no specific regions assigned, allow access to all
          break;
        default:
          // No assignment found, restrict to user's region if available
          const userRegion = req.user?.Region;
          if (userRegion) {
            filter.region = userRegion;
          }
          break;
      }
    } else {
      // Fallback: use user's region if no hierarchical assignment
      const userRegion = req.user?.Region || req.headers["x-region"];
      if (userRegion) {
        filter.region = userRegion;
      }
    }

    // If a specific region was requested in query params, intersect with hierarchical access
    if (requestedRegion) {
      if (filter.region) {
        // If we already have a region filter, ensure the requested region is allowed
        if (filter.region.$in) {
          // Multiple regions allowed - check if requested region is in the list
          if (!filter.region.$in.includes(requestedRegion)) {
            return res.status(403).json({
              message: "Access denied",
              details: `You do not have access to region: ${requestedRegion}`
            });
          }
        } else if (filter.region !== requestedRegion) {
          // Single region filter - check if it matches
          return res.status(403).json({
            message: "Access denied",
            details: `You do not have access to region: ${requestedRegion}`
          });
        }
      } else {
        // No hierarchical restriction, but requested region specified
        filter.region = requestedRegion;
      }
    }

    const personnel = await PersonnelServices.find(filter);
    res.status(200).json(personnel);
  } catch (error) {
    console.error("Error fetching personnel:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};

exports.bulkUpdatePersonnelService = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and must not be empty" });
    }
    const nonNeg = validateNonNegativeInItems(items, PERSONNEL_NUMERIC_FIELDS);
    if (!nonNeg.valid) {
      return res.status(400).json({ message: nonNeg.message });
    }
    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    const workflowData = req.submissionWorkflowData || {};

    const updates = [];

    for (const item of items) {
      if (!item._id) {
        return res.status(400).json({ message: "Each item must have an _id field" });
      }

      const existingPersonnel = await PersonnelServices.findById(item._id);
      if (!existingPersonnel) {
        return res.status(404).json({ message: `Personnel entry with ID ${item._id} not found` });
      }

      updates.push(
        PersonnelServices.findByIdAndUpdate(
          item._id,
          {
            Total: item.Total !== undefined ? item.Total : (item.amount !== undefined ? item.amount : existingPersonnel.Total),
            amount: item.amount !== undefined ? item.amount : (item.Total !== undefined ? item.Total : existingPersonnel.amount),
            ...(setFY ? { fiscalYear: setFY } : {}),
            ...(setBT ? { budgetType: setBT } : {}),
            region: item.region !== undefined ? item.region : (workflowData.region || existingPersonnel.region),
            department: item.department !== undefined ? item.department : (workflowData.department || existingPersonnel.department),
            division: item.division !== undefined ? item.division : (workflowData.division || existingPersonnel.division),
            processBy: item.processBy !== undefined ? item.processBy : (req.user?.userName || req.user?.id || existingPersonnel.processBy),
            processDate: item.processDate !== undefined ? item.processDate : new Date(),
            status: item.status !== undefined ? item.status : (workflowData.status || existingPersonnel.status),
            ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
            ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
          },
          { new: true }
        )
      );
    }

    const updatedItems = await Promise.all(updates);

    try {
      const proposalIds = new Set();
      for (const item of updatedItems) {
        if (item.proposalId) {
          proposalIds.add(item.proposalId);
        }
        if (item.workflowRef) {
          proposalIds.add(item.workflowRef);
        }
      }

      if (proposalIds.size > 0) {
        for (const proposalId of proposalIds) {
          await recalculateAndSaveProposalTotals({ proposalId });
        }
      }
    } catch (error) {
      console.error("Error recalculating proposal totals:", error);
    }

    try {
      const originalItemMap = new Map();
      items.forEach(item => {
        originalItemMap.set(item._id.toString(), item);
      });

      for (const updatedItem of updatedItems) {
        const originalItem = originalItemMap.get(updatedItem._id.toString());
        if (originalItem && updatedItem.proposalId) {
          const changes = [];
          
          const amountField = 'Total';
          if (originalItem[amountField] !== undefined && updatedItem[amountField] !== originalItem[amountField]) {
            changes.push({
              field: amountField,
              oldValue: originalItem[amountField],
              newValue: updatedItem[amountField],
              valueType: 'number'
            });
          }

          if (originalItem.amount !== undefined && updatedItem.amount !== originalItem.amount) {
            changes.push({
              field: 'amount',
              oldValue: originalItem.amount,
              newValue: updatedItem.amount,
              valueType: 'number'
            });
          }

          if (changes.length > 0) {
            await ProposalEditLog.logChange({
              proposalId: updatedItem.proposalId,
              workflowRef: updatedItem.workflowRef,
              fiscalYear: updatedItem.fiscalYear,
              budgetType: updatedItem.budgetType,
              region: updatedItem.region,
              department: updatedItem.department,
              division: updatedItem.division,
              changeType: 'BULK_EDIT',
              entityType: 'PersonnelServices',
              entityId: updatedItem._id,
              changedBy: {
                userId: req.user?.id || 'SYSTEM',
                userName: req.user?.userName || 'SYSTEM',
                email: req.user?.email,
                role: req.user?.Roles?.join(', ') || 'SYSTEM'
              },
              changes,
              summary: `Updated ${changes.length} field(s) in Personnel Services entry`,
              ipAddress: req.ip,
              userAgent: req.get('user-agent')
            });
          }
        }
      }
    } catch (error) {
      console.error("Error logging personnel changes:", error);
    }

    res.status(200).json({
      message: "Personnel entries updated successfully",
      updatedCount: updatedItems.length,
      items: updatedItems
    });
  } catch (error) {
    console.error("Error updating personnel entries:", error);
    res.status(500).json({ message: "Failed to update personnel entries" });
  }
};

exports.bulkSetPersonnelSubsidy = async (req, res) => {
  try {
    const {
      items = [],
      defaultAmount = 0,
      subsidyEligible = true,
      notes,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Items array is required to update subsidy",
      });
    }
    const subsidyNonNeg = validateNonNegativeInItems(
      items.map(p => ({ subsidyAmount: p.subsidyAmount ?? p.amount })),
      ['subsidyAmount']
    );
    if (!subsidyNonNeg.valid) {
      return res.status(400).json({ message: subsidyNonNeg.message });
    }
    const hierarchicalFilters = normalizeHierarchicalFilters(req.hierarchicalFilters);
    const results = {
      updated: [],
      skipped: [],
    };

    for (const payload of items) {
      const targetId = payload?._id || payload?.id;
      if (!targetId) {
        results.skipped.push({ reason: "Missing _id", payload });
        continue;
      }

      const record = await PersonnelServices.findById(targetId);
      if (!record) {
        results.skipped.push({ reason: "Record not found", id: targetId });
        continue;
      }

      if (!recordMatchesFilters(record, hierarchicalFilters)) {
        results.skipped.push({ reason: "Access denied", id: targetId });
        continue;
      }

      if (LOCKED_PERSONNEL_STATUSES.includes(record.status)) {
        results.skipped.push({ reason: "Locked status", id: targetId, status: record.status });
        continue;
      }

      const resolvedAmount = Number(payload.subsidyAmount ?? payload.amount ?? defaultAmount ?? record.subsidyAmount ?? 0);
      const normalizedAmount = Number.isFinite(resolvedAmount) && resolvedAmount > 0 ? resolvedAmount : 0;
      const resolvedNotes = payload.subsidyNotes ?? notes ?? record.subsidyNotes ?? null;

      const updateDocument = subsidyEligible
        ? {
            subsidyEligible: true,
            subsidyAmount: normalizedAmount,
            subsidyNotes: resolvedNotes,
            subsidyTaggedBy: req.user?.userName || req.user?.email || req.user?.id || "SYSTEM",
            subsidyTaggedAt: new Date(),
          }
        : {
            subsidyEligible: false,
            subsidyAmount: 0,
            subsidyNotes: null,
            subsidyTaggedBy: null,
            subsidyTaggedAt: null,
          };

      const updated = await PersonnelServices.findByIdAndUpdate(
        targetId,
        { $set: updateDocument },
        { new: true }
      );

      if (updated) {
        results.updated.push(updated);
      } else {
        results.skipped.push({ reason: "Update failed", id: targetId });
      }
    }

    // Recalculate budget totals for all affected proposals
    try {
      const proposalIds = new Set();
      for (const item of results.updated) {
        if (item.proposalId) {
          proposalIds.add(item.proposalId.toString());
        }
        if (item.workflowRef) {
          proposalIds.add(item.workflowRef.toString());
        }
      }

      if (proposalIds.size > 0) {
        for (const proposalId of proposalIds) {
          await recalculateAndSaveProposalTotals({ proposalId });
        }
      }
    } catch (recalcError) {
      console.error("ERROR: Failed to recalculate budget totals:", recalcError);
      // Don't fail the response, just log the error
    }

    return res.status(200).json({
      message: subsidyEligible
        ? `${results.updated.length} personnel tagged for subsidy`
        : `${results.updated.length} personnel subsidy tags removed`,
      updatedCount: results.updated.length,
      updated: results.updated,
      skipped: results.skipped,
    });
  } catch (error) {
    console.error("Error updating personnel subsidy flags:", error);
    return res.status(500).json({ message: "Failed to update personnel subsidy" });
  }
};

// Charged to Income handler (for Permanent and Casual employees)
exports.bulkSetPersonnelChargedToIncome = async (req, res) => {
  try {
    const {
      items = [],
      defaultAmount = 0,
      chargedToIncomeEligible = true,
      notes,
    } = req.body || {};

    console.log("DEBUG: bulkSetPersonnelChargedToIncome called with:", {
      itemsCount: items.length,
      items,
      chargedToIncomeEligible,
      defaultAmount,
    });

    if (!Array.isArray(items) || items.length === 0) {
      console.log("DEBUG: Items array validation failed");
      return res.status(400).json({
        message: "Items array is required to update charged to income",
      });
    }
    const chargedNonNeg = validateNonNegativeInItems(
      items.map(p => ({
        chargedToIncomeAmount: p.chargedToIncomeAmount,
        chargedToIncomeSubsidyAmount: p.chargedToIncomeSubsidyAmount
      })),
      ['chargedToIncomeAmount', 'chargedToIncomeSubsidyAmount']
    );
    if (!chargedNonNeg.valid) {
      return res.status(400).json({ message: chargedNonNeg.message });
    }
    const hierarchicalFilters = normalizeHierarchicalFilters(req.hierarchicalFilters);
    console.log("DEBUG: hierarchicalFilters:", hierarchicalFilters);
    
    const results = {
      updated: [],
      skipped: [],
    };

    for (const payload of items) {
      const targetId = payload?._id || payload?.id;
      console.log("DEBUG: Processing item with id:", targetId);
      
      if (!targetId) {
        results.skipped.push({ reason: "Missing _id", payload });
        continue;
      }

      const record = await PersonnelServices.findById(targetId);
      if (!record) {
        console.log("DEBUG: Record not found for id:", targetId);
        results.skipped.push({ reason: "Record not found", id: targetId });
        continue;
      }

      console.log("DEBUG: Record found:", {
        _id: record._id,
        proposalId: record.proposalId,
        workflowRef: record.workflowRef,
        name: record.name
      }); 

      if (!recordMatchesFilters(record, hierarchicalFilters)) {
        console.log("DEBUG: Access denied for record:", targetId);
        results.skipped.push({ reason: "Access denied", id: targetId });
        continue;
      }

      if (LOCKED_PERSONNEL_STATUSES.includes(record.status)) {
        console.log("DEBUG: Record has locked status:", record.status);
        results.skipped.push({ reason: "Locked status", id: targetId, status: record.status });
        continue;
      }

      console.log("DEBUG: Updating record, chargedToIncomeEligible:", chargedToIncomeEligible);

      // CRITICAL: When chargedToIncomeEligible is true and no amount is provided, default to the full record.Total
      // This ensures that "Select All" + "Charge to Income" marks 100% of salary, not 0%
      let resolvedAmount = 0;
      if (chargedToIncomeEligible) {
        // When marking as charged-to-income, prefer the provided amount, then fallback to full total
        const providedAmount = Number(payload.chargedToIncomeAmount ?? defaultAmount ?? null);
        if (Number.isFinite(providedAmount) && providedAmount > 0) {
          resolvedAmount = providedAmount;
        } else {
          // No amount provided - use the full salary total
          resolvedAmount = Number(record.Total || record.total || 0);
        }
      } else {
        // When unmarking, use zero
        resolvedAmount = 0;
      }
      
      const normalizedAmount = Number.isFinite(resolvedAmount) && resolvedAmount > 0 ? resolvedAmount : 0;
      const resolvedNotes = payload.chargedToIncomeNotes ?? notes ?? record.chargedToIncomeNotes ?? null;
      
      console.log("DEBUG: Amount resolution for record:", {
        id: targetId,
        payloadAmount: payload.chargedToIncomeAmount,
        defaultAmount,
        recordTotal: record.Total || record.total,
        resolvedAmount,
        normalizedAmount,
        chargedToIncomeEligible
      });
      
      // CRITICAL: When marking as charged to income, capture the subsidy amount so it can be deducted from PROJECTED SUBSIDY
      const chargedToIncomeSubsidyAmount = chargedToIncomeEligible ? (record.subsidyAmount || 0) : 0;

      const updateDocument = chargedToIncomeEligible
        ? {
            chargedToIncomeEligible: true,
            chargedToIncomeAmount: normalizedAmount,
            chargedToIncomeNotes: resolvedNotes,
            chargedToIncomeTaggedBy: req.user?.userName || req.user?.email || req.user?.id || "SYSTEM",
            chargedToIncomeTaggedAt: new Date(),
            chargedToIncomeSubsidyAmount: chargedToIncomeSubsidyAmount,  // ADDED: Store subsidy to deduct from PROJECTED SUBSIDY
          }
        : {
            chargedToIncomeEligible: false,
            chargedToIncomeAmount: 0,
            chargedToIncomeNotes: null,
            chargedToIncomeTaggedBy: null,
            chargedToIncomeTaggedAt: null,
            chargedToIncomeSubsidyAmount: 0,  // ADDED: Clear subsidy when unmarking
          };

      console.log("DEBUG: updateDocument:", updateDocument);

      const updated = await PersonnelServices.findByIdAndUpdate(
        targetId,
        { $set: updateDocument },
        { new: true }
      );

      console.log("DEBUG: Update result:", updated ? "Success" : "Failed");
      if (updated) {
        console.log("DEBUG: Updated record chargedToIncomeEligible:", updated.chargedToIncomeEligible);
        console.log("DEBUG: Updated record fields:", {
          _id: updated._id,
          chargedToIncomeEligible: updated.chargedToIncomeEligible,
          chargedToIncomeAmount: updated.chargedToIncomeAmount,
          chargedToIncomeTaggedAt: updated.chargedToIncomeTaggedAt,
        });
      } else {
        console.log("DEBUG: Updated was null/undefined");
      }

      if (updated) {
        results.updated.push(updated);
      } else {
        results.skipped.push({ reason: "Update failed", id: targetId });
      }
    }

    console.log("DEBUG: Final results:", {
      updatedCount: results.updated.length,
      skippedCount: results.skipped.length,
      skipped: results.skipped,
    });

    // Recalculate budget totals for all affected proposals
    try {
      if (results.updated.length === 0) {
        console.log("DEBUG: No records updated, skipping recalculation");
      } else {
        // Extract organization keys from the first updated record
        const firstRecord = results.updated[0];
        const keys = {
          fiscalYear: firstRecord.fiscalYear,
          budgetType: firstRecord.budgetType,
          region: firstRecord.region,
          processBy: firstRecord.processBy,
          department: firstRecord.department,
          division: firstRecord.division,
          originalDepartment: firstRecord.originalDepartment,
          originalDivision: firstRecord.originalDivision
        };
        
        console.log("DEBUG: Recalculating using org keys:", {
          fiscalYear: keys.fiscalYear,
          budgetType: keys.budgetType,
          region: keys.region,
          department: keys.department
        });
        
        await recalculateAndSaveProposalTotals({ keys });
        console.log("DEBUG: Budget recalculation completed successfully");
      }
    } catch (recalcError) {
      console.error("ERROR: Failed to recalculate budget totals:", {
        message: recalcError?.message,
        stack: recalcError?.stack,
        fullError: recalcError
      });
      // Don't fail the response, just log the error
    }

    const responsePayload = {
      message: chargedToIncomeEligible
        ? `${results.updated.length} personnel charged to income`
        : `${results.updated.length} personnel charged to income tags removed`,
      updatedCount: results.updated.length,
      updated: results.updated,
      skipped: results.skipped,
    };
    
    console.log("DEBUG: Response being sent, updatedCount:", responsePayload.updatedCount);
    console.log("DEBUG: Updated items count in response:", responsePayload.updated.length);

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error updating personnel charged to income flags:", error);
    return res.status(500).json({ message: "Failed to update personnel charged to income" });
  }
};

// DEBUG: Simple endpoint to check if chargedToIncomeEligible records exist
exports.debugCheckChargedToIncome = async (req, res) => {
  try {
    console.log("\n=== DEBUG: Checking chargedToIncomeEligible records ===");
    
    // Raw count
    const count = await PersonnelServices.countDocuments({ chargedToIncomeEligible: true });
    console.log(`Total records with chargedToIncomeEligible=true: ${count}`);
    
    // Get sample records
    const records = await PersonnelServices.find({ chargedToIncomeEligible: true }).limit(5);
    console.log(`Sample records found:`, records.map(r => ({
      _id: r._id,
      employeeName: r.employeeName,
      statusOfAppointment: r.statusOfAppointment,
      chargedToIncomeEligible: r.chargedToIncomeEligible,
      chargedToIncomeAmount: r.chargedToIncomeAmount,
      chargedToIncomeTaggedAt: r.chargedToIncomeTaggedAt
    })));
    
    return res.json({
      success: true,
      totalCount: count,
      sampleRecords: records
    });
  } catch (error) {
    console.error("Error in debugCheckChargedToIncome:", error);
    return res.status(500).json({ message: "Debug check failed", error: error.message });
  }
};

/**
 * List all personnel records marked as charged-to-income (optional: by fiscalYear, region).
 * GET /personnelServices/charged-to-income/list?fiscalYear=2027&region=...
 */
exports.listChargedToIncome = async (req, res) => {
  try {
    const { fiscalYear, region, proposalId } = req.query;
    let query = { chargedToIncomeEligible: true };
    if (fiscalYear) query.fiscalYear = String(fiscalYear).trim();
    if (region) query.region = region;

    if (proposalId) {
      const proposalScope = [{ workflowRef: proposalId }];

      if (mongoose.Types.ObjectId.isValid(String(proposalId))) {
        proposalScope.push({ proposalId: new mongoose.Types.ObjectId(String(proposalId)) });
      }

      try {
        const legacyProposal = await Proposal.findOne({ workflowRef: proposalId }).select('_id').lean();
        if (legacyProposal?._id) {
          proposalScope.push({ proposalId: legacyProposal._id });
        }
      } catch (scopeErr) {
        console.warn('[listChargedToIncome] proposal scope fallback error:', scopeErr.message);
      }

      query = { $and: [query, { $or: proposalScope }] };
    }

    const records = await PersonnelServices.find(query)
      .select('_id employeeFullName employeeNumber positionTitle department division region fiscalYear Total chargedToIncomeAmount chargedToIncomeTaggedAt')
      .lean();

    const totalAmount = records.reduce((sum, r) => sum + (Number(r.chargedToIncomeAmount) || Number(r.Total) || 0), 0);

    return res.json({
      success: true,
      count: records.length,
      totalAmount: roundTo2Decimals(totalAmount),
      records,
    });
  } catch (error) {
    console.error("Error in listChargedToIncome:", error);
    return res.status(500).json({ message: "Failed to list charged-to-income records", error: error.message });
  }
};

/**
 * Reset all personnel in scope from charged-to-income (set chargedToIncomeEligible = false).
 * POST /personnelServices/charged-to-income/reset
 * Body: { fiscalYear, region? }
 */
exports.resetChargedToIncome = async (req, res) => {
  try {
    const { fiscalYear, region, proposalId } = req.body || {};
    let query = { chargedToIncomeEligible: true };
    if (fiscalYear) query.fiscalYear = String(fiscalYear).trim();
    if (region) query.region = region;

    if (proposalId) {
      const proposalScope = [{ workflowRef: proposalId }];

      if (mongoose.Types.ObjectId.isValid(String(proposalId))) {
        proposalScope.push({ proposalId: new mongoose.Types.ObjectId(String(proposalId)) });
      }

      try {
        const legacyProposal = await Proposal.findOne({ workflowRef: proposalId }).select('_id').lean();
        if (legacyProposal?._id) {
          proposalScope.push({ proposalId: legacyProposal._id });
        }
      } catch (scopeErr) {
        console.warn('[resetChargedToIncome] proposal scope fallback error:', scopeErr.message);
      }

      query = { $and: [query, { $or: proposalScope }] };
    }

    const result = await PersonnelServices.updateMany(query, {
      $set: {
        chargedToIncomeEligible: false,
        chargedToIncomeAmount: 0,
        chargedToIncomeNotes: null,
        chargedToIncomeTaggedBy: null,
        chargedToIncomeTaggedAt: null,
        chargedToIncomeSubsidyAmount: 0,
      },
    });

    const recalculateAndSaveProposalTotals = require('../utils/recalculateProposalTotals').recalculateAndSaveProposalTotals;
    if (result.modifiedCount > 0) {
      try {
        if (proposalId) {
          await recalculateAndSaveProposalTotals({ proposalId });
        } else {
          const keys = { fiscalYear: query.fiscalYear, region: query.region };
          await recalculateAndSaveProposalTotals({ keys });
        }
      } catch (e) {
        console.warn("Recalc proposal totals after reset:", e.message);
      }
    }

    return res.json({
      success: true,
      message: `${result.modifiedCount} record(s) reset from charged-to-income`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    });
  } catch (error) {
    console.error("Error in resetChargedToIncome:", error);
    return res.status(500).json({ message: "Failed to reset charged-to-income", error: error.message });
  }
};

module.exports = {
  getAllPersonnelServices: exports.getAllPersonnelServices,
  bulkAddPersonnelServices: exports.bulkAddPersonnelServices,
  getAllPerServices: exports.getAllPerServices,
  updatePersonnelService: exports.updatePersonnelService,
  bulkUpdatePersonnelService: exports.bulkUpdatePersonnelService,
  getGrandTotalPermanent: exports.getGrandTotalPermanent,
  getGrandTotalCasual: exports.getGrandTotalCasual,
  deleteAllPersonnelss: exports.deleteAllPersonnelss,
  getGrandTotal: exports.getGrandTotal,
  getPersonnelHiredBeforeJune1988: exports.getPersonnelHiredBeforeJune1988,
  syncAllMealAllowances: exports.syncAllMealAllowances,
  getPersonnelServices: exports.getPersonnelServices,
  PersonnelServices: require("../models/PersonnelServices"),
  bulkSetPersonnelSubsidy: exports.bulkSetPersonnelSubsidy,
  bulkSetPersonnelChargedToIncome: exports.bulkSetPersonnelChargedToIncome,
  debugCheckChargedToIncome: exports.debugCheckChargedToIncome,
  listChargedToIncome: exports.listChargedToIncome,
  resetChargedToIncome: exports.resetChargedToIncome,
};
