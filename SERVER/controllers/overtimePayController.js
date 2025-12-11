// controllers/overtimePayController.js
const OvertimePay       = require("../models/overtimePay");
const Settings          = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");
const PersonnelServices = require('../models/PersonnelServices');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
/**
 * Helper: compute total overtime for an employee in a fiscal year
 */
async function computeTotalOvertime(employeeFullName, fiscalYear) {
  const result = await OvertimePay.aggregate([
    { $match: { employeeFullName, fiscalYear } },
    { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
  ]);
  return result[0]?.totalAmount || 0;
}
/**
 * Compute overtime amount using settings
 */
const computeOvertimeAmount = (
  weekdayHours,
  weekendHours,
  monthlySalary,
  weekdayMultiplier,
  weekendMultiplier
) => {
  // Ensure all inputs are valid numbers
  const wd = Math.max(0, Number(weekdayHours) || 0);
  const we = Math.max(0, Number(weekendHours) || 0);
  const salary = Number(monthlySalary) || 0;
  
  // Use default multipliers if not provided
  const wdMult = Number(weekdayMultiplier) || 1.25;
  const weMult = Number(weekendMultiplier) || 1.5;
  
  console.log('📊 computeOvertimeAmount inputs:', {
    weekdayHours: wd,
    weekendHours: we,
    monthlySalary: salary,
    weekdayMultiplier: wdMult,
    weekendMultiplier: weMult,
    receivedMultipliers: { weekdayMultiplier, weekendMultiplier }
  });
  
  // If salary is invalid or zero, return 0
  if (!salary || isNaN(salary)) {
    console.log('❌ Invalid salary, returning 0');
    return 0;
  }
  
  const dailyRate = salary / 22;
  const hourlyRate = dailyRate / 8;
  const result = (
    wd * hourlyRate * wdMult +
    we * hourlyRate * weMult
  );
  
  console.log('✅ Calculation details:', {
    dailyRate,
    hourlyRate,
    weekdayComponent: wd * hourlyRate * wdMult,
    weekendComponent: we * hourlyRate * weMult,
    result
  });
  
  // Ensure result is a valid number
  return isNaN(result) ? 0 : result;
};
/**
 * Check if overtime exceeds 50% of annual salary
 */
async function checkOvertimeLimit(employeeFullName, fiscalYear, monthlySalary, newAmount) {
  // Get total existing overtime (excluding current addition)
  const existingTotal = await computeTotalOvertime(employeeFullName, fiscalYear);
  // Calculate annual salary and 50% limit
  const annualSalary = monthlySalary * 12;
  const maxAllowedOvertime = annualSalary * 0.5;
  // Check if new total would exceed limit
  return {
    willExceed: (existingTotal + newAmount) > maxAllowedOvertime,
    maxAllowed: maxAllowedOvertime,
    currentTotal: existingTotal,
    newTotal: existingTotal + newAmount
  };
}
exports.createOvertimePay = async (req, res) => {
  try {
    console.log('📨 Received request body:', JSON.stringify(req.body, null, 2));
    
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      weekdayHours,
      weekendHours,
      processBy,
      processDate,
      fiscalYear,
      monthlySalary,
      budgetType,
      region,
      department, // Add department field from middleware
      division,   // Add division field from middleware
      status,     // Add status field from middleware
      originalLevel, // Add originalLevel field from middleware
    } = req.body;

    console.log('📋 Extracted values:', { monthlySalary, weekdayHours, weekendHours, employeeFullName });

    // --- VALIDATION: Check required fields
    if (!employeeFullName) {
      return res.status(400).json({
        message: "Employee full name is required"
      });
    }
    if (!fiscalYear) {
      return res.status(400).json({
        message: "Fiscal year is required"
      });
    }
    
    // CRITICAL: Validate that monthlySalary is a valid positive number
    const validMonthlySalary = Number(monthlySalary);
    console.log('💰 Salary validation:', { received: monthlySalary, asNumber: validMonthlySalary, isNaN: isNaN(validMonthlySalary) });
    
    if (!validMonthlySalary || isNaN(validMonthlySalary) || validMonthlySalary <= 0) {
      console.error('❌ Invalid monthlySalary received:', { monthlySalary, validMonthlySalary });
      return res.status(400).json({
        message: "Valid monthly salary is required. Received: " + monthlySalary,
        code: "INVALID_SALARY"
      });
    }

    // --- NEW: Prevent adding if personnel status is Submitted or Approved
    const existingPerson = await PersonnelServices.findOne({ employeeFullName, fiscalYear });
    if (existingPerson && ["Submitted", "Approved"].includes(existingPerson.status)) {
      return res.status(400).json({
        message: `Hindi pwedeng magdagdag ng overtime para sa personnel na may status na ${existingPerson.status}.`
      });
    }
    // 1) Get active settings
    const settings = await Settings.findOne({ isActive: true }).lean();
    if (!settings) {
      return res.status(404).json({
        message:
          "Walang active settings na nahanap para sa fiscal year na ito.",
      });
    }
    
    // Get compensation settings for overtime multipliers
    let weekdayMultiplier = 1.25; // default
    let weekendMultiplier = 1.5;  // default
    
    if (settings.compensationSettingsId) {
      const compensationSettings = await CompensationSettings.findById(settings.compensationSettingsId).lean();
      if (compensationSettings) {
        weekdayMultiplier = compensationSettings.weekdayMultiplier || 1.25;
        weekendMultiplier = compensationSettings.weekendMultiplier || 1.5;
      }
    }
    
    console.log('⚙️ Settings fetched:', {
      weekdayMultiplier,
      weekendMultiplier,
      settingsId: settings._id,
      compensationSettingsId: settings.compensationSettingsId
    });
    // 2) Compute amount
    const amount = computeOvertimeAmount(
      weekdayHours,
      weekendHours,
      validMonthlySalary,
      weekdayMultiplier,
      weekendMultiplier
    );
    
    console.log('💾 Amount computed and about to save:', {
      amount,
      weekdayHours,
      weekendHours,
      monthlySalary: validMonthlySalary,
      weekdayMultiplier,
      weekendMultiplier
    });
    
    // NEW: Check if overtime exceeds 50% of annual salary
    const limitCheck = await checkOvertimeLimit(employeeFullName, fiscalYear, validMonthlySalary, amount);
    if (limitCheck.willExceed) {
      return res.status(400).json({
        message: `Not exceed to 50% the annual salary and overtime. Current: ₱${limitCheck.currentTotal.toLocaleString()}, New Total: ₱${limitCheck.newTotal.toLocaleString()}, Max Allowed: ₱${limitCheck.maxAllowed.toLocaleString()}`
      });
    }
    // 3) Save new OvertimePay record
    const overtime = new OvertimePay({
      employeeNumber,
      employeeFullName,
      positionTitle,
      weekdayHours,
      weekendHours,
      amount,
      monthlySalary: validMonthlySalary,
      fiscalYear,
      processBy,
      processDate,
      budgetType,
      region, // Add region field
      department, // Add department field from middleware
      division,   // Add division field from middleware
      status,     // Add status field from middleware
      originalLevel, // Add originalLevel field from middleware
    });
    await overtime.save();
    // 4) Sync combined overtime to PersonnelServices
    const totalOvertime = await computeTotalOvertime(employeeFullName, fiscalYear);
    const person = await PersonnelServices.findOne({ employeeFullName, fiscalYear });
    if (person) {
      person.overtimePay = totalOvertime;
      await person.save();
      
      // Trigger recalculation of proposal totals
      if (person.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: person.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res.status(201).json({
      message: "Overtime record saved and PersonnelServices updated",
      data: overtime,
    });
  } catch (error) {
    console.error("❌ Error sa createOvertimePay:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
// controllers/overtimePayController.js
exports.updateOvertimePay = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      weekdayHours,
      weekendHours,
      monthlySalary,
      processBy,
      processDate,
      budgetType,
      region,
    } = req.body;
    // 1) Fetch the existing overtime record so we have its name & FY
    const record = await OvertimePay.findById(id);
    if (!record) {
      return res.status(404).json({ message: "Overtime record not found." });
    }
    // 2) Prevent updating if personnel is already Submitted/Approved
    const personRec = await PersonnelServices.findOne({
      employeeFullName: record.employeeFullName,
      fiscalYear: record.fiscalYear,
    });
    if (personRec && ["Submitted", "Approved"].includes(personRec.status)) {
      return res.status(400).json({
        message: `Hindi pwedeng i-update ang overtime para sa personnel na may status na ${personRec.status}.`
      });
    }
    // 3) Compute new amount
    const settings = await Settings.findOne({ isActive: true }).lean();
    if (!settings) {
      return res.status(400).json({
        message: "Walang active settings para sa fiscal year na ito.",
      });
    }
    const { weekdayMultiplier, weekendMultiplier } = settings;
    const amount = computeOvertimeAmount(
      weekdayHours,
      weekendHours,
      monthlySalary,
      weekdayMultiplier,
      weekendMultiplier
    );
    // NEW: Check if overtime exceeds 50% of annual salary (excluding current record)
    // First subtract current record amount from total
    const currentTotal = await computeTotalOvertime(record.employeeFullName, record.fiscalYear);
    const adjustedTotal = currentTotal - record.amount;
    const limitCheck = {
      willExceed: (adjustedTotal + amount) > (monthlySalary * 12 * 0.5),
      maxAllowed: monthlySalary * 12 * 0.5,
      currentTotal: adjustedTotal,
      newTotal: adjustedTotal + amount
    };
    if (limitCheck.willExceed) {
      return res.status(400).json({
        message: `Hindi pwedeng lumampas sa 50% ng annual salary ang overtime. Current: ₱${limitCheck.currentTotal.toLocaleString()}, New Total: ₱${limitCheck.newTotal.toLocaleString()}, Max Allowed: ₱${limitCheck.maxAllowed.toLocaleString()}`
      });
    }
    // 4) Apply only the changed fields
    record.weekdayHours  = weekdayHours;
    record.weekendHours  = weekendHours;
    record.monthlySalary = monthlySalary;
    record.amount        = amount;
    record.processBy     = processBy;
    record.processDate   = processDate;
    record.budgetType    = budgetType;
    // Update region if provided
    if (region) {
      record.region = region;
    }
    await record.save();
    // 5) Sync back to PersonnelServices
    const totalOvertime = await computeTotalOvertime(
      record.employeeFullName,
      record.fiscalYear
    );
    const person = await PersonnelServices.findOne({
      employeeFullName: record.employeeFullName,
      fiscalYear: record.fiscalYear,
    });
    if (person) {
      person.overtimePay = totalOvertime;
      // **Recalculate the overall Total** (sum of all numeric fields)
      person.Total = Object.values(person.toObject()).reduce(
        (sum, v) => (typeof v === "number" ? sum + v : sum),
        0
      );
      await person.save();
      
      // Trigger recalculation of proposal totals
      if (person.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: person.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res.status(200).json(record);
  } catch (error) {
    console.error("❌ Error sa updateOvertimePay:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
exports.deleteOvertimePay = async (req, res) => {
  try {
    const { id } = req.params;
    const toDelete = await OvertimePay.findById(id);
    if (!toDelete) {
      return res.status(404).json({ message: "Overtime record not found." });
    }
    await OvertimePay.findByIdAndDelete(id);
    // 4) Sync combined overtime after deletion
    const totalOvertime = await computeTotalOvertime(
      toDelete.employeeFullName,
      toDelete.fiscalYear
    );
    const person = await PersonnelServices.findOne({
      employeeFullName: toDelete.employeeFullName,
      fiscalYear: toDelete.fiscalYear,
    });
    if (person) {
      person.overtimePay = totalOvertime;
      person.Total = Object.values(person.toObject()).reduce(
        (sum, v) => (typeof v === "number" ? sum + v : sum),
        0
      );
      await person.save();
      
      // Trigger recalculation of proposal totals
      if (person.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: person.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res
      .status(200)
      .json({ message: "Overtime record deleted and synced." });
  } catch (error) {
    console.error("❌ Error sa deleteOvertimePay:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getAllOvertimePays = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      fiscalYear,
      budgetType,
      region,
    } = req.query;
    let query = {};
    // Search filter
    if (search) {
      query.$or = [
        { employeeFullName: { $regex: search, $options: "i" } },
        { positionTitle:    { $regex: search, $options: "i" } },
        { processBy:        { $regex: search, $options: "i" } },
        { fiscalYear:       { $regex: search, $options: "i" } },
      ];
      const n = !isNaN(Number(search)) ? Number(search) : null;
      if (n !== null) {
        query.$or.push(
          { weekdayHours: n },
          { weekendHours: n }
        );
      }
    }
    // Fiscal year filter
    if (!fiscalYear) {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (!active) {
        return res.status(400).json({ message: "Active settings not found." });
      }
      query.fiscalYear = active.fiscalYear;
    } else {
      query.fiscalYear = fiscalYear;
    }
    // Budget type filter
    if (budgetType) {
      query.budgetType = budgetType;
    }
    // Region filter
    if (region) {
      query.region = region;
    }
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      console.log('🔧 APPLYING MIDDLEWARE FILTERS:', JSON.stringify(submissionWorkflowFilters, null, 2));
      // Use the filters from the submission workflow middleware
      // These already include the proper status checks for Department/Region levels
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        // Simple key-value filters
        Object.assign(query, submissionWorkflowFilters);
      }
      console.log('🎯 FINAL DATABASE QUERY:', JSON.stringify(query, null, 2));
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
        const userLevel = req.user.level;
        const userRegion = req.user.region;
        const userDepartment = req.user.department;
        const userDivision = req.user.division;

        let filterCriteria = {};

        if (userLevel === "Division") {
          filterCriteria.division = userDivision;
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Department") {
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Region") {
          filterCriteria.region = userRegion;
        }

        Object.assign(query, filterCriteria);
      }
    }
    const sort = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
    const skip = (Number(page) - 1) * Number(limit);
    const [results, total] = await Promise.all([
      OvertimePay.find(query).lean().skip(skip).limit(+limit).sort(sort),
      OvertimePay.countDocuments(query),
    ]);
    return res.json({
      data:         results,
      totalPages:   Math.ceil(total / limit),
      currentPage:  Number(page),
      totalRecords: total,
    });
  } catch (err) {
    console.error("❌ Error sa getAllOvertimePays:", err);
    return res.status(500).json({ error: err.message || "Something went wrong." });
  }
};
exports.getSumOfOvertimeAmount = async (req, res) => {
  try {
    const { region } = req.query;
    const active = await Settings.findOne({ isActive: true }).lean();
    if (!active) {
      return res
        .status(400)
        .json({ message: "Walang active settings na nahanap." });
    }
    const fiscalYear = active.fiscalYear;
    // Build match criteria with optional region filter
    const matchCriteria = { fiscalYear };
    if (region) {
      matchCriteria.region = region;
    }
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      // Use the filters from the submission workflow middleware
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        Object.assign(matchCriteria, submissionWorkflowFilters);
      } else {
        // Simple key-value filters
        Object.assign(matchCriteria, submissionWorkflowFilters);
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
        const userLevel = req.user.level;
        const userRegion = req.user.region;
        const userDepartment = req.user.department;
        const userDivision = req.user.division;

        let filterCriteria = {};

        if (userLevel === "Division") {
          filterCriteria.division = userDivision;
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Department") {
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Region") {
          filterCriteria.region = userRegion;
        }

        Object.assign(matchCriteria, filterCriteria);
      }
    }
    const result = await OvertimePay.aggregate([
      { $match: matchCriteria },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount = result[0]?.totalAmount || 0;
    return res.json({ totalAmount });
  } catch (err) {
    console.error("❌ Error sa getSumOfOvertimeAmount:", err);
    return res
      .status(500)
      .json({ error: "Nabigo sa pag-calculate ng total overtime amount." });
  }
};
// Get overtime data grouped by region
exports.getOvertimeByRegion = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Use active fiscal year if not provided
    let activeFiscalYear = fiscalYear;
    if (!activeFiscalYear) {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (!active) {
        return res.status(400).json({ message: "Walang active settings na nahanap." });
      }
      activeFiscalYear = active.fiscalYear;
    }
    // Build match criteria
    const matchCriteria = { fiscalYear: activeFiscalYear };
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      // Use the filters from the submission workflow middleware
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        Object.assign(matchCriteria, submissionWorkflowFilters);
      } else {
        // Simple key-value filters
        Object.assign(matchCriteria, submissionWorkflowFilters);
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
        const userLevel = req.user.level;
        const userRegion = req.user.region;
        const userDepartment = req.user.department;
        const userDivision = req.user.division;

        let filterCriteria = {};

        if (userLevel === "Division") {
          filterCriteria.division = userDivision;
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Department") {
          filterCriteria.department = userDepartment;
          filterCriteria.region = userRegion;
        } else if (userLevel === "Region") {
          filterCriteria.region = userRegion;
        }

        Object.assign(matchCriteria, filterCriteria);
      }
    }
    // Aggregate overtime data by region
    const result = await OvertimePay.aggregate([
      { $match: matchCriteria },
      { 
        $group: { 
          _id: "$region", 
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          weekdayHours: { $sum: "$weekdayHours" },
          weekendHours: { $sum: "$weekendHours" }
        } 
      },
      {
        $project: {
          region: "$_id",
          totalAmount: 1,
          count: 1,
          weekdayHours: 1,
          weekendHours: 1,
          _id: 0
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);
    // Handle null/undefined regions by replacing with "Unassigned"
    const formattedResult = result.map(item => ({
      ...item,
      region: item.region || "Unassigned"
    }));
    return res.json(formattedResult);
  } catch (err) {
    console.error("❌ Error sa getOvertimeByRegion:", err);
    return res
      .status(500)
      .json({ error: "Nabigo sa pag-retrieve ng overtime data by region." });
  }
};
