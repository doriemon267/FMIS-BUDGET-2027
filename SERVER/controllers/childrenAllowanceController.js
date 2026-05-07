const ChildrenAllowance = require("../models/childrenAllowance");
const Settings = require("../models/Settings");
const PersonnelService = require('../models/PersonnelServices');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { ensurePersonnelRecordEditable } = require('../utils/employeeBenefitSyncUtils');
const { getAllowanceRates } = require("../utils/allowanceUtils");
const PersonnelServices = PersonnelService;

// Function to sync children allowance with personnel services
async function syncWithPersonnelServices(employeeNumber, fiscalYear, amount, noOfDependents, options = {}) {
  try {
    const personnelService = await ensurePersonnelRecordEditable(
      {
        employeeNumber,
        fiscalYear,
        proposalId: options.proposalId,
        workflowRef: options.workflowRef,
        employeeFullName: options.employeeFullName,
      },
      'children allowance'
    );
    if (personnelService) {
      personnelService.childrenAllowance = amount; // Update childrenAllowance field
      personnelService.noOfDependent = noOfDependents; // Update noOfDependent field
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
        "honoraria",
        "childrenAllowance",
      ];
      personnelService.Total = numericFields.reduce(
        (acc, field) => acc + (Number(personnelService[field]) || 0),
        0
      );
      await personnelService.save();
      
      // Trigger recalculation of proposal totals
      if (personnelService.proposalId) {
        try {
          console.log(`🔄 [Children] Triggering recalculation for proposal: ${personnelService.proposalId}`);
          await recalculateAndSaveProposalTotals({ proposalId: personnelService.proposalId });
          console.log(`✅ [Children] Recalculation completed for proposal: ${personnelService.proposalId}`);
        } catch (recalcErr) {
          console.error('❌ [Children] Error recalculating proposal totals:', recalcErr);
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      "Error syncing children allowance with personnel services:",
      error
    );
    return false;
  }
}
// Get all children allowance records with pagination
const getAllChildrenAllowances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = "updatedAt",
      order = "desc",
      fiscalYear,
    } = req.query;
    
    // Get filters from middleware - prioritize submission workflow filters over hierarchical filters
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    
    // Use submission workflow filters if available (they include status filtering), otherwise use hierarchical filters
    const activeFilters = Object.keys(submissionWorkflowFilters).length > 0 ? submissionWorkflowFilters : hierarchicalFilters;
    
    // Map filters to database field names
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
      if (filters.status) mapped.status = filters.status;
      return mapped;
    };
    
    const dbFilters = mapFiltersToDb(activeFilters);
    // Validate query parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res.status(400).json({
        error: "Invalid pagination parameters",
      });
    }
    const skip = (page - 1) * limit;
    // Build query
    let query = {};
    
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
    if (search) {
      query.$or = [
        { employeeFullName: { $regex: search, $options: "i" } },
        { employeeNumber: { $regex: search, $options: "i" } },
        { positionTitle: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { division: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
      ];
    }
    // Add fiscalYear to query if provided
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    } else {
      // Use active fiscal year from settings if not provided
      const settings = await Settings.findOne({ isActive: true }).lean();
      if (!settings) {
        return res.status(404).json({
          error: "Active settings not found",
        });
      }
      query.fiscalYear = settings.fiscalYear;
    }
    // Count total records
    const totalRecords = await ChildrenAllowance.countDocuments(query);
    // Validate sort parameters
    const validSortFields = [
      "employeeNumber",
      "employeeFullName",
      "positionTitle",
      "department",
      "division",
      "region",
      "noOfDependents",
      "amount",
      "updatedAt",
      "createdAt",
    ];
    if (!validSortFields.includes(orderBy)) {
      return res.status(400).json({
        error: `Invalid sort field. Must be one of: ${validSortFields.join(", ")}`,
      });
    }
    if (!["asc", "desc"].includes(order)) {
      return res.status(400).json({
        error: "Invalid sort order. Must be 'asc' or 'desc'",
      });
    }
    // Build sort options
    const sortOptions = { [orderBy]: order === "asc" ? 1 : -1 };
    // Fetch records
    const records = await ChildrenAllowance.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    // Log success
    return res.status(200).json({
      data: records,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("❌ Error in getAllChildrenAllowances:", err.stack);
    return res.status(500).json({
      error: "Failed to fetch children allowances",
      details: err.message,
    });
  }
};
// Get a single children allowance record
const getChildrenAllowance = async (req, res) => {
  try {
    const record = await ChildrenAllowance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Children allowance record not found" });
    }
    return res.status(200).json(record);
  } catch (error) {
    console.error("Error fetching children allowance record:", error);
    return res.status(500).json({
      error: "Failed to fetch children allowance record",
      details: error.message,
    });
  }
};
// Create a new children allowance record
const createChildrenAllowance = async (req, res) => {
  try {
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      proposalId,
      workflowRef,
      noOfDependents,
      amount,
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;
    // Validate required fields
    if (!employeeNumber) {
      return res.status(400).json({ error: "Employee number is required" });
    }
    if (!employeeFullName) {
      return res.status(400).json({ error: "Employee name is required" });
    }
    if (noOfDependents === undefined || noOfDependents === null) {
      return res.status(400).json({ error: "Number of dependents is required" });
    }
    if (!fiscalYear) {
      return res.status(400).json({ error: "Fiscal year is required" });
    }
    if (!budgetType) {
      return res.status(400).json({ error: "Budget type is required" });
    }
    if (!processBy) {
      return res.status(400).json({ error: "Processed by is required" });
    }
    if (!processDate) {
      return res.status(400).json({ error: "Process date is required" });
    }
    // Validate number of dependents
    const validDependents = Math.min(4, Math.max(0, Number(noOfDependents) || 0));
    if (validDependents !== Number(noOfDependents)) {
      return res.status(400).json({
        error: "Number of dependents must be between 0 and 4",
      });
    }
    // Validate processDate
    if (!isValidDate(processDate)) {
      return res.status(400).json({ error: "Invalid process date" });
    }
    // Fetch settings
    const settings = await Settings.findOne({ fiscalYear, isActive: true })
      .populate('compensationSettingsId')
      .lean();
      
    if (!settings) {
      return res.status(404).json({ error: "Active settings not found for the specified fiscal year" });
    }
    
    // Get rates from settings (handles both legacy and new standalone compensation structure)
    const rates = getAllowanceRates(settings);
    const childrenAllowanceRate = rates.childrenAllowance;
    
    if (!childrenAllowanceRate) {
      return res.status(400).json({ error: "Children allowance rate not found in settings" });
    }
    
    // Validate amount (annual calculation: monthly rate * 12)
    const expectedAmount = validDependents * childrenAllowanceRate * 12;
    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} for ${validDependents} dependents`,
      });
    }
    // Check for existing record
    const existingRecord = await ChildrenAllowance.findOne({
      employeeNumber,
      fiscalYear,
      budgetType,
    });
    if (existingRecord) {
      return res.status(400).json({
        error: `A children allowance record already exists for employee ${employeeFullName} (${employeeNumber}) in fiscal year ${fiscalYear} (${budgetType})`,
      });
    }
    const newRecord = new ChildrenAllowance({
      employeeNumber,
      employeeFullName,
      positionTitle: positionTitle || "",
      department: department || "",
      division: division || "",
      region: region || "",
      noOfDependents: validDependents,
      amount,
      processBy,
      processDate: new Date(processDate),
      fiscalYear,
      budgetType,
    });
    await newRecord.save();
    // Sync with PersonnelServices, including noOfDependent
    await syncWithPersonnelServices(employeeNumber, fiscalYear, amount, validDependents, {
      proposalId,
      workflowRef,
      employeeFullName,
    });
    return res.status(201).json({
      message: "Children allowance record created successfully",
      data: newRecord,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("❌ Error in createChildrenAllowance:", error.stack);
    return res.status(500).json({
      error: "Failed to create children allowance record",
      details: error.message,
    });
  }
};
// Update a children allowance record
const updateChildrenAllowance = async (req, res) => {
  try {
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      proposalId,
      workflowRef,
      noOfDependents,
      amount,
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;
    // Validate required fields
    if (!employeeNumber) {
      return res.status(400).json({ error: "Employee number is required" });
    }
    if (!employeeFullName) {
      return res.status(400).json({ error: "Employee name is required" });
    }
    if (noOfDependents === undefined || noOfDependents === null) {
      return res.status(400).json({ error: "Number of dependents is required" });
    }
    if (!fiscalYear) {
      return res.status(400).json({ error: "Fiscal year is required" });
    }
    if (!budgetType) {
      return res.status(400).json({ error: "Budget type is required" });
    }
    if (!processBy) {
      return res.status(400).json({ error: "Processed by is required" });
    }
    if (!processDate) {
      return res.status(400).json({ error: "Process date is required" });
    }
    // Validate number of dependents
    const validDependents = Math.min(4, Math.max(0, Number(noOfDependents) || 0));
    if (validDependents !== Number(noOfDependents)) {
      return res.status(400).json({
        error: "Number of dependents must be between 0 and 4",
      });
    }
    // Validate processDate
    if (!isValidDate(processDate)) {
      return res.status(400).json({ error: "Invalid process date" });
    }
    // Fetch settings
    const settings = await Settings.findOne({ fiscalYear, isActive: true })
      .populate('compensationSettingsId')
      .lean();
      
    if (!settings) {
      return res.status(404).json({ error: "Active settings not found for the specified fiscal year" });
    }
    
    // Get rates from settings (handles both legacy and new standalone compensation structure)
    const rates = getAllowanceRates(settings);
    const childrenAllowanceRate = rates.childrenAllowance;
    
    if (!childrenAllowanceRate) {
      return res.status(400).json({ error: "Children allowance rate not found in settings" });
    }
    
    // Validate amount (annual calculation: monthly rate * 12)
    const expectedAmount = validDependents * childrenAllowanceRate * 12;
    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} for ${validDependents} dependents`,
      });
    }

    // First, find the children allowance record to check its status
    const existingRecord = await ChildrenAllowance.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Children allowance record not found" });
    }

    // Check if the record has been submitted and prevent editing
    const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
    if (submittedStatuses.includes(existingRecord.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit children allowance record that has been submitted or approved"
      });
    }

    const updatedRecord = await ChildrenAllowance.findByIdAndUpdate(
      req.params.id,
      {
        employeeNumber,
        employeeFullName,
        positionTitle: positionTitle || "",
        department: department || "",
        division: division || "",
        region: region || "",
        noOfDependents: validDependents,
        amount,
        processBy,
        processDate: new Date(processDate),
        fiscalYear,
        budgetType,
      },
      { new: true }
    );
    if (!updatedRecord) {
      return res.status(404).json({ error: "Children allowance record not found" });
    }
    // Sync with PersonnelServices, including noOfDependent
    await syncWithPersonnelServices(employeeNumber, fiscalYear, amount, validDependents, {
      proposalId,
      workflowRef,
      employeeFullName,
    });
    return res.status(200).json({
      message: "Children allowance record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating children allowance record:", error);
    return res.status(500).json({
      error: "Failed to update children allowance record",
      details: error.message,
    });
  }
};
// Delete a children allowance record
const deleteChildrenAllowance = async (req, res) => {
  try {
    const deletedRecord = await ChildrenAllowance.findById(req.params.id);
    if (!deletedRecord) {
      return res.status(404).json({ error: "Children allowance record not found" });
    }
    const { employeeNumber, fiscalYear, noOfDependents } = deletedRecord;
    await ChildrenAllowance.findByIdAndDelete(req.params.id);
    // Sync with PersonnelServices, setting amount to 0 but keeping noOfDependent
    await syncWithPersonnelServices(employeeNumber, fiscalYear, 0, noOfDependents, {
      proposalId: deletedRecord.proposalId,
      workflowRef: deletedRecord.workflowRef,
      employeeFullName: deletedRecord.employeeFullName,
    });
    return res.status(200).json({
      message: "Children allowance record deleted successfully",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting children allowance record:", error);
    return res.status(500).json({
      error: "Failed to delete children allowance record",
      details: error.message,
    });
  }
};
// Sync all children allowances
const syncAllChildrenAllowances = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true }).lean();
    if (!activeSettings) {
      return res.status(400).json({ error: "Active settings not found" });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const childrenAllowances = await ChildrenAllowance.find({ fiscalYear });
    if (childrenAllowances.length === 0) {
      return res.status(200).json({
        message: "No children allowances found for the current fiscal year",
      });
    }
    let syncCount = 0;
    for (const ca of childrenAllowances) {
      const success = await syncWithPersonnelServices(
        ca.employeeNumber,
        fiscalYear,
        ca.amount,
        ca.noOfDependents
      );
      if (success) {
        syncCount++;
      }
    }
    return res.status(200).json({
      message: `Successfully synced ${syncCount} children allowance records`,
      fiscalYear,
    });
  } catch (error) {
    console.error("Error syncing all children allowances:", error.stack);
    return res.status(500).json({
      error: "Failed to sync children allowances",
      details: error.message,
    });
  }
};
// Get children allowance statistics
const getChildrenAllowanceStats = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Build query to filter by fiscal year (same logic as getAllChildrenAllowances)
    let query = {};
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    } else {
      // Use active fiscal year from settings if not provided
      const settings = await Settings.findOne({ isActive: true }).lean();
      if (!settings) {
        return res.status(404).json({
          error: "Active settings not found",
        });
      }
      query.fiscalYear = settings.fiscalYear;
    }
    const totalRecords = await ChildrenAllowance.countDocuments(query);
    // Get the sum of all amounts and total dependents with fiscal year filter
    const aggregationResult = await ChildrenAllowance.aggregate([
      {
        $match: query // Apply the same filter as the table
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalDependents: { $sum: "$noOfDependents" },
        }
      }
    ]);
    const totalAmount = aggregationResult.length > 0 ? aggregationResult[0].totalAmount : 0;
    const totalDependents = aggregationResult.length > 0 ? aggregationResult[0].totalDependents : 0;
    // Get unique employees count with fiscal year filter
    const uniqueEmployees = await ChildrenAllowance.distinct('employeeNumber', query);
    const result = {
      totalRecords,
      totalAmount,
      totalDependents,
      uniqueEmployees: uniqueEmployees.length
    };
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching children allowance stats:", error);
    res.status(500).json({ message: "Failed to fetch children allowance statistics" });
  }
};
// Utility function to validate date
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}
// Explicit exports
module.exports = {
  getAllChildrenAllowances,
  getChildrenAllowance,
  createChildrenAllowance,
  updateChildrenAllowance,
  deleteChildrenAllowance,
  syncAllChildrenAllowances,
  getChildrenAllowanceStats,
};
// 