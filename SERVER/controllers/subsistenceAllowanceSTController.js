// controllers/subsistenceAllowanceSTController.js

const SubsistenceAllowanceST = require("../models/subsistenceAllowanceST");
const Settings               = require("../models/Settings");
const PersonnelServices      = require("../models/personnelServices");  // :contentReference[oaicite:0]{index=0}&#8203;:contentReference[oaicite:1]{index=1}

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
    const person = await PersonnelServices.findOne({ employeeNumber, fiscalYear: usedFY });
    if (person) {
      person.subsistenceAllowanceST = combinedST;
      await person.save();
    }

    return res.status(201).json({ message: "Record created and synced.", data: record });
  } catch (err) {
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
    const person = await PersonnelServices.findOne({ employeeNumber: updated.employeeNumber, fiscalYear: usedFY });
    if (person) {
      person.subsistenceAllowanceST = combinedST;
      await person.save();
    }

    return res.status(200).json(updated);
  } catch (err) {
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
    const person = await PersonnelServices.findOne({ employeeNumber: toDelete.employeeNumber, fiscalYear: toDelete.fiscalYear });
    if (person) {
      person.subsistenceAllowanceST = combinedST;
      await person.save();
    }

    return res.status(200).json({ message: "Deleted and synced successfully." });
  } catch (err) {
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
