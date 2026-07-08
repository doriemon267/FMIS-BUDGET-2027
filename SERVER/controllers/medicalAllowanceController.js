const MedicalAllowance = require("../models/medicalAllowance");
const Employee = require("../models/employee_master");
const Settings = require("../models/Settings");
const { calculateMedicalAllowance, getAllowanceRates } = require("../utils/allowanceUtils");
const PersonnelService = require('../models/PersonnelServices');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { ensurePersonnelRecordEditable } = require('../utils/employeeBenefitSyncUtils');
const { applyTableFilters } = require('../utils/controller_get_process');
const PersonnelServices = PersonnelService;

// Function to sync medical allowance with personnel services
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
      'medical allowance'
    );
    if (personnelService) {
      personnelService.medical = amount;
      personnelService.noOfDependent = noOfDependents; // Update noOfDependent
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
          console.log(`🔄 [Medical] Triggering recalculation for proposal: ${personnelService.proposalId}`);
          await recalculateAndSaveProposalTotals({ proposalId: personnelService.proposalId });
          console.log(`✅ [Medical] Recalculation completed for proposal: ${personnelService.proposalId}`);
        } catch (recalcErr) {
          console.error('❌ [Medical] Error recalculating proposal totals:', recalcErr);
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      "Error syncing medical allowance with personnel services:",
      error
    );
    return false;
  }
}
// Get all medical allowance records with pagination
const getAllMedicalAllowances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy = "updatedAt",
      order = "desc",
      fiscalYear,
    } = req.query;
    // Validate query parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
      return res.status(400).json({
        error: "Invalid pagination parameters",
      });
    }
    const skip = (page - 1) * limit;
    // Build query
    let query = {};
    // Apply dynamic table filters
    applyTableFilters(
      query, 
      req.query, 
      ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'], 
      ['amount', 'noOfDependents'], 
      ['processDate', 'createdAt', 'updatedAt'], 
      ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region']
    );
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
    const totalRecords = await MedicalAllowance.countDocuments(query);
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
    const records = await MedicalAllowance.find(query)
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
    console.error("❌ Error in getAllMedicalAllowances:", err.stack);
    return res.status(500).json({
      error: "Failed to fetch medical allowances",
      details: err.message,
    });
  }
};
// Get a single medical allowance record
const getMedicalAllowance = async (req, res) => {
  try {
    const record = await MedicalAllowance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Medical allowance record not found" });
    }
    return res.status(200).json(record);
  } catch (error) {
    console.error("Error fetching medical allowance record:", error);
    return res.status(500).json({
      error: "Failed to fetch medical allowance record",
      details: error.message,
    });
  }
};
// Create a new medical allowance record
const createMedicalAllowance = async (req, res) => {
  try {
    const {
      employeeId,
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
    // Since /getpersonnels/hiredBeforeJune1988 already filters eligible employees,
    // we skip the Employee lookup and assume the employee is eligible
    const settings = await Settings.findOne({ fiscalYear, isActive: true })
      .populate('compensationSettingsId')
      .lean();
    if (!settings) {
      return res.status(404).json({ error: "Active settings not found for the specified fiscal year" });
    }
    // Get medical allowance rate (use default 200 if not set)
    const rates = getAllowanceRates(settings);
    const medicalAllowanceRate = rates.medicalAllowance;
    // Validate amount (annual calculation: monthly rate * 12)
    const expectedAmount = calculateMedicalAllowance(validDependents, medicalAllowanceRate);
    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} for ${validDependents} dependents`,
      });
    }
    // Check for existing record
    const existingRecord = await MedicalAllowance.findOne({
      employeeNumber,
      fiscalYear,
      budgetType,
    });
    if (existingRecord) {
      return res.status(400).json({
        error: `A medical allowance record already exists for employee ${employeeFullName} (${employeeNumber}) in fiscal year ${fiscalYear} (${budgetType})`,
      });
    }
    const newRecord = new MedicalAllowance({
      employeeId,
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
    await syncWithPersonnelServices(employeeNumber, fiscalYear, amount, validDependents, {
      proposalId,
      workflowRef,
      employeeFullName,
    });
    return res.status(201).json({
      message: "Medical allowance record created successfully",
      data: newRecord,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("❌ Error in createMedicalAllowance:", error.stack);
    return res.status(500).json({
      error: "Failed to create medical allowance record",
      details: error.message,
    });
  }
};
// Update a medical allowance record
const updateMedicalAllowance = async (req, res) => {
  try {
    const {
      employeeId,
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
    // Since /getpersonnels/hiredBeforeJune1988 already filters eligible employees,
    // we skip the Employee lookup and assume the employee is eligible
    const settings = await Settings.findOne({ fiscalYear, isActive: true })
      .populate('compensationSettingsId')
      .lean();
    if (!settings) {
      return res.status(404).json({ error: "Active settings not found for the specified fiscal year" });
    }
    // Get medical allowance rate (use default 200 if not set)
    const rates = getAllowanceRates(settings);
    const medicalAllowanceRate = rates.medicalAllowance;
    // Validate amount (annual calculation: monthly rate * 12)
    const expectedAmount = calculateMedicalAllowance(validDependents, medicalAllowanceRate);
    if (Number(amount) !== expectedAmount) {
      return res.status(400).json({
        error: `Invalid amount. Expected ${expectedAmount} for ${validDependents} dependents`,
      });
    }

    // First, find the medical allowance record to check its status
    const existingRecord = await MedicalAllowance.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ error: "Medical allowance record not found" });
    }

    // Check if the record has been submitted and prevent editing
    const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
    if (submittedStatuses.includes(existingRecord.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit medical allowance record that has been submitted or approved"
      });
    }

    const updatedRecord = await MedicalAllowance.findByIdAndUpdate(
      req.params.id,
      {
        employeeId,
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
      return res.status(404).json({ error: "Medical allowance record not found" });
    }
    await syncWithPersonnelServices(employeeNumber, fiscalYear, amount, validDependents, {
      proposalId,
      workflowRef,
      employeeFullName,
    });
    return res.status(200).json({
      message: "Medical allowance record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error updating medical allowance record:", error);
    return res.status(500).json({
      error: "Failed to update medical allowance record",
      details: error.message,
    });
  }
};
// Delete a medical allowance record
const deleteMedicalAllowance = async (req, res) => {
  try {
    const deletedRecord = await MedicalAllowance.findById(req.params.id);
    if (!deletedRecord) {
      return res.status(404).json({ error: "Medical allowance record not found" });
    }
    const { employeeNumber, fiscalYear, noOfDependents } = deletedRecord;
    await MedicalAllowance.findByIdAndDelete(req.params.id);
    await syncWithPersonnelServices(employeeNumber, fiscalYear, 0, noOfDependents, {
      proposalId: deletedRecord.proposalId,
      workflowRef: deletedRecord.workflowRef,
      employeeFullName: deletedRecord.employeeFullName,
    });
    return res.status(200).json({
      message: "Medical allowance record deleted successfully",
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error deleting medical allowance record:", error);
    return res.status(500).json({
      error: "Failed to delete medical allowance record",
      details: error.message,
    });
  }
};
// Bulk add medical allowances for eligible employees
const bulkAddMedicalAllowances = async (req, res) => {
  try {
    const { processBy, fiscalYear, budgetType } = req.body;
    // Validate required fields
    if (!processBy) {
      return res.status(400).json({ error: "Processed by is required" });
    }
    if (!fiscalYear) {
      return res.status(400).json({ error: "Fiscal year is required" });
    }
    if (!budgetType) {
      return res.status(400).json({ error: "Budget type is required" });
    }
    // Get active settings
    const settings = await Settings.findOne({ fiscalYear, isActive: true })
      .populate('compensationSettingsId')
      .lean();
    if (!settings) {
      return res.status(404).json({ error: "Active settings not found for the specified fiscal year" });
    }
    // Get the medical allowance rate from settings (handles both legacy and new standalone compensation structure)
    const rates = getAllowanceRates(settings);
    const medicalAllowanceRate = rates.medicalAllowance;
    
    if (!medicalAllowanceRate) {
      return res.status(400).json({ error: "Medical allowance rate not found in settings" });
    }
    // Find eligible employees using PersonnelServices (already filtered by hire date)
    const eligibleEmployees = await PersonnelServices.find({
      DateOfAppointment: { $lt: new Date("1988-06-01") },
    }).lean();
    // Check which employees already have medical allowance for this fiscal year
    const existingRecords = await MedicalAllowance.find({
      fiscalYear,
      budgetType,
    });
    const existingEmployeeNumbers = existingRecords.map(record => record.employeeNumber);
    // Filter out employees who already have records
    const employeesToAdd = eligibleEmployees.filter(
      employee => !existingEmployeeNumbers.includes(employee.employeeNumber)
    );
    if (employeesToAdd.length === 0) {
      return res.status(200).json({
        message: "No new eligible employees found for medical allowance",
      });
    }
    // Create medical allowance records for eligible employees (store annual amount)
    const medicalAllowances = employeesToAdd.map(employee => ({
      employeeId: employee._id,
      employeeNumber: employee.employeeNumber || "",
      employeeFullName: employee.employeeFullName || "",
      positionTitle: employee.positionTitle || "",
      department: employee.department || "",
      division: employee.division || "",
      region: employee.region || "",
      noOfDependents: Math.min(employee.noOfDependent || 0, 4), // Use noOfDependent from PersonnelServices
      amount: (employee.noOfDependent || 0) * medicalAllowanceRate * 12,
      processBy,
      processDate: new Date(),
      fiscalYear,
      budgetType,
    }));
    await MedicalAllowance.insertMany(medicalAllowances);
    // Sync with personnel services
    for (const allowance of medicalAllowances) {
      await syncWithPersonnelServices(allowance.employeeNumber, fiscalYear, allowance.amount, allowance.noOfDependents);
    }
    return res.status(201).json({
      message: `Successfully added medical allowances for ${medicalAllowances.length} employees`,
      count: medicalAllowances.length,
    });
  } catch (error) {
    console.error("Error bulk adding medical allowances:", error);
    return res.status(500).json({
      error: "Failed to bulk add medical allowances",
      details: error.message,
    });
  }
};
// Sync all medical allowances
const syncAllMedicalAllowances = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true }).lean();
    if (!activeSettings) {
      return res.status(400).json({ error: "Active settings not found" });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const medicalAllowances = await MedicalAllowance.find({ fiscalYear });
    if (medicalAllowances.length === 0) {
      return res.status(200).json({
        message: "No medical allowances found for the current fiscal year",
      });
    }
    let syncCount = 0;
    for (const ma of medicalAllowances) {
      const success = await syncWithPersonnelServices(
        ma.employeeNumber,
        fiscalYear,
        ma.amount,
        ma.noOfDependents
      );
      if (success) {
        syncCount++;
      }
    }
    return res.status(200).json({
      message: `Successfully synced ${syncCount} medical allowance records`,
      fiscalYear,
    });
  } catch (error) {
    console.error("Error syncing all medical allowances:", error.stack);
    return res.status(500).json({
      error: "Failed to sync medical allowances",
      details: error.message,
    });
  }
};
// Get medical allowance statistics - updated
const getMedicalAllowanceStats = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Build query to filter by fiscal year (same logic as getAllMedicalAllowances)
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
    const totalRecords = await MedicalAllowance.countDocuments(query);
    // Get the sum of all amounts with fiscal year filter
    const aggregationResult = await MedicalAllowance.aggregate([
      {
        $match: query // Apply the same filter as the table
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" }, // Amount is already annual
        }
      }
    ]);
    const totalAmount = aggregationResult.length > 0 ? aggregationResult[0].totalAmount : 0;
    const averageAmount = totalRecords > 0 ? totalAmount / totalRecords : 0;
    // Get unique employees count with fiscal year filter
    const uniqueEmployees = await MedicalAllowance.distinct('employeeNumber', query);
    const result = {
      totalRecords,
      totalAmount,
      averageAmount,
      uniqueEmployees: uniqueEmployees.length
    };
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching medical allowance stats:", error);
    res.status(500).json({ message: "Failed to fetch medical allowance statistics" });
  }
};
// Utility function to validate date
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}
// Explicit exports
module.exports = {
  getAllMedicalAllowances,
  getMedicalAllowance,
  createMedicalAllowance,
  updateMedicalAllowance,
  deleteMedicalAllowance,
  bulkAddMedicalAllowances,
  syncAllMedicalAllowances,
  getMedicalAllowanceStats,
};
// 