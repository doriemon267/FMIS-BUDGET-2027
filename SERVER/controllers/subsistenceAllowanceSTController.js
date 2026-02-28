// controllers/subsistenceAllowanceSTController.js
const SubsistenceAllowanceST = require("../models/subsistenceAllowanceST");
const Settings               = require("../models/Settings");
const PersonnelService = require('../models/PersonnelServices');  // :contentReference[oaicite:0]{index=0}&#8203;:contentReference[oaicite:1]{index=1}
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { ensurePersonnelRecordEditable } = require('../utils/employeeBenefitSyncUtils');
const PersonnelServices = PersonnelService;
/**
 * Helper: compute combined ST (sum of all ST entries) for an employee in a fiscal year
 */
async function computeCombinedST(employeeNumber, fiscalYear) {
  const result = await SubsistenceAllowanceST.aggregate([
    { $match: { employeeNumber, fiscalYear } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return result[0]?.total || 0;
}
/**
 * Create a new Subsistence Allowance ST record,
 * then immediately synchronize combined ST to PersonnelServices
 */
exports.createSubsistenceST = async (req, res) => {
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
      monthlySalary,
      actualExposureDays,
      riskLevel,
      fiscalYear,   // optional
      budgetType,   // optional
      processBy,
      processDate,
    } = req.body;
    // 1) Get active settings (or by fiscalYear if provided)
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.subsistenceAllowanceSTRates) {
      return res.status(400).json({ message: "Active settings with ST rates not found." });
    }
    // 2) Determine percentage based on risk level and exposure days
    const rates = settings.subsistenceAllowanceSTRates;
    let pct = 0;
    if (riskLevel === "High") {
      pct = actualExposureDays >= 15
        ? rates.highRisk.fifteenOrMoreDays
        : actualExposureDays >= 8
          ? rates.highRisk.eightToFourteenDays
          : rates.highRisk.lessThanEightDays;
    } else {
      pct = actualExposureDays >= 15
        ? rates.lowRisk.fifteenOrMoreDays
        : actualExposureDays >= 8
          ? rates.lowRisk.eightToFourteenDays
          : rates.lowRisk.lessThanEightDays;
    }
    // 3) Compute amount and determine fiscalYear to use
    const amount = monthlySalary * pct;
    const usedFY = fiscalYear || settings.fiscalYear;
    // 4) Save new ST record
    const record = new SubsistenceAllowanceST({
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      monthlySalary,
      actualExposureDays,
      riskLevel,
      amount,
      fiscalYear: usedFY,
      budgetType: budgetType || settings.budgetType,
      processBy,
      processDate,
    });
    await record.save();
    // 5) Compute combined ST & sync to PersonnelServices
    const combinedST = await computeCombinedST(employeeNumber, usedFY);
    const person = await ensurePersonnelRecordEditable(
      { employeeNumber, employeeFullName, fiscalYear: usedFY, proposalId, workflowRef },
      'subsistence allowance ST'
    );
    if (person) {
      person.subsistenceAllowanceST = combinedST;
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
    return res.status(201).json({ message: "Record created and synced.", data: record });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("❌ Error in createSubsistenceST:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Fetch paginated SubsistenceAllowanceST records
 */
exports.getAllSubsistenceST = async (req, res) => {
  try {
    const { fiscalYear, page = 1, limit = 10, search, orderBy, order = "asc" } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { employeeFullName: { $regex: search, $options: "i" } },
        { positionTitle:    { $regex: search, $options: "i" } },
        { department:       { $regex: search, $options: "i" } },
        { division:         { $regex: search, $options: "i" } },
        { region:           { $regex: search, $options: "i" } },
      ];
    }
    let fy = fiscalYear;
    if (!fy) {
      const activeSettings = await Settings.findOne({ isActive: true }).lean();
      if (!activeSettings) {
        return res.status(400).json({ message: "Active settings not found." });
      }
      fy = activeSettings.fiscalYear;
    }
    query.fiscalYear = fy;
    // Apply hierarchical filtering based on user assignment
    if (req.user && req.user.assignment) {
      const userAssignment = req.user.assignment;
      const userLevel = req.user.level;
      const userRegion = req.user.region;
      const userDepartment = req.user.department;
      const userDivision = req.user.division;

      // Build filter based on user level
      let filterCriteria = {};

      if (userLevel === "Division") {
        // Division level: Can see their own division data
        filterCriteria.division = userDivision;
        filterCriteria.department = userDepartment;
        filterCriteria.region = userRegion;
      } else if (userLevel === "Department") {
        // Department level: Can see all divisions under their department
        // But only if the data is submitted/approved
        filterCriteria.department = userDepartment;
        filterCriteria.region = userRegion;
        // Add status filter for department level
        filterCriteria.$or = [
          { status: "Submitted" },
          { status: "Approved" },
          { status: { $exists: false } } // For backward compatibility
        ];
      } else if (userLevel === "Region") {
        // Region level: Can see all departments under their region
        // But only if the data is submitted/approved
        filterCriteria.region = userRegion;
        // Add status filter for region level
        filterCriteria.$or = [
          { status: "Submitted" },
          { status: "Approved" },
          { status: { $exists: false } } // For backward compatibility
        ];
      }

      // Apply the hierarchical filter to the query
      query = { ...query, ...filterCriteria };
    }
    const sort = { [orderBy || "createdAt"]: order.toLowerCase() === "desc" ? -1 : 1 };
    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      SubsistenceAllowanceST.find(query).lean().skip(skip).limit(Number(limit)).sort(sort),
      SubsistenceAllowanceST.countDocuments(query),
    ]);
    return res.status(200).json({
      data: records,
      totalPages:  Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalRecords: total,
    });
  } catch (err) {
    console.error("❌ Error in getAllSubsistenceST:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Update an existing ST record, then sync combined ST
 */
exports.updateSubsistenceST = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      proposalId,
      workflowRef,
      monthlySalary,
      actualExposureDays,
      riskLevel,
      fiscalYear,
      budgetType,
      processBy,
      processDate,
    } = req.body;
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.subsistenceAllowanceSTRates) {
      return res.status(400).json({ message: "Active settings with ST rates not found." });
    }
    const rates = settings.subsistenceAllowanceSTRates;
    let pct = riskLevel === "High"
      ? actualExposureDays >= 15
        ? rates.highRisk.fifteenOrMoreDays
        : actualExposureDays >= 8
          ? rates.highRisk.eightToFourteenDays
          : rates.highRisk.lessThanEightDays
      : actualExposureDays >= 15
        ? rates.lowRisk.fifteenOrMoreDays
        : actualExposureDays >= 8
          ? rates.lowRisk.eightToFourteenDays
          : rates.lowRisk.lessThanEightDays;
    const amount = monthlySalary * pct;
    const usedFY = fiscalYear || settings.fiscalYear;
    const updated = await SubsistenceAllowanceST.findByIdAndUpdate(
      id,
      {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        monthlySalary,
        actualExposureDays,
        riskLevel,
        amount,
        fiscalYear: usedFY,
        budgetType: budgetType || settings.budgetType,
        processBy,
        processDate,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    const combinedST = await computeCombinedST(updated.employeeNumber, usedFY);
    const person = await ensurePersonnelRecordEditable(
      {
        employeeNumber: updated.employeeNumber,
        employeeFullName: updated.employeeFullName,
        fiscalYear: usedFY,
        proposalId,
        workflowRef,
      },
      'subsistence allowance ST'
    );
    if (person) {
      person.subsistenceAllowanceST = combinedST;
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
    return res.status(200).json(updated);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("❌ Error in updateSubsistenceST:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Delete an ST record, then clear & recompute combined ST
 */
exports.deleteSubsistenceST = async (req, res) => {
  try {
    const { id } = req.params;
    const toDelete = await SubsistenceAllowanceST.findById(id);
    if (!toDelete) return res.status(404).json({ message: "Record not found." });
    await SubsistenceAllowanceST.findByIdAndDelete(id);
    const combinedST = await computeCombinedST(toDelete.employeeNumber, toDelete.fiscalYear);
    const person = await ensurePersonnelRecordEditable(
      {
        employeeNumber: toDelete.employeeNumber,
        employeeFullName: toDelete.employeeFullName,
        fiscalYear: toDelete.fiscalYear,
        proposalId: toDelete.proposalId,
        workflowRef: toDelete.workflowRef,
      },
      'subsistence allowance ST'
    );
    if (person) {
      person.subsistenceAllowanceST = combinedST;
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
    return res.status(200).json({ message: "Deleted and synced successfully." });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("❌ Error in deleteSubsistenceST:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Get sum of all ST amounts for the active fiscal year
 */
exports.getSumOfSubsistenceST = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true }).lean();
    if (!activeSettings) {
      return res.status(400).json({ message: "Active settings not found." });
    }
    const fiscalYear = activeSettings.fiscalYear;
    const result = await SubsistenceAllowanceST.aggregate([
      { $match: { fiscalYear } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount = result[0]?.totalAmount || 0;
    return res.status(200).json({ totalAmount });
  } catch (err) {
    console.error("❌ Error in getSumOfSubsistenceST:", err);
    return res.status(500).json({ message: "Failed to calculate total ST amount.", error: err.message });
  }
};
