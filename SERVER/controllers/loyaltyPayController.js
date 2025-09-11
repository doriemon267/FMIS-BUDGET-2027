// controllers/loyaltyPayController.js
const LoyaltyPay        = require("../models/loyaltyPay");
const Settings          = require("../models/Settings");
const PersonnelServices = require("../models/personnelServices");
const {
  calculateLoyaltyPayYearsOfService,
  isEligibleForLoyaltyPay,
  getEligibleLoyaltyPayYear,
  calculateLoyaltyPayAmount
} = require("../utils/loyaltyPayUtils");
/**
 * Helper: compute total loyalty pay for an employee in a fiscal year
 */
async function computeTotalLoyalty(employeeFullName, fiscalYear) {
  const result = await LoyaltyPay.aggregate([
    { $match: { employeeFullName, fiscalYear } },
    { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
  ]);
  return result[0]?.totalAmount || 0;
}
/**
 * Create a new Loyalty Pay record,
 * then immediately sync combined loyaltyAward in PersonnelServices.
 */
exports.createLoyaltyPay = async (req, res) => {
  try {
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      yearsInService,
      appointmentDate, // Add appointment date for cutoff calculation
      fiscalYear, // optional
      budgetType, // optional
      processBy,
      processDate,
    } = req.body;
    // 1) Get settings
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.loyaltyPay) {
      return res.status(400).json({
        message: "Active settings with loyalty pay not found."
      });
    }
    const usedFY = fiscalYear || settings.fiscalYear;
    // 2) Calculate years of service with June 22 cutoff
    let calculatedYears;
    if (appointmentDate) {
      const cutoffDate = settings.loyaltyPay.cutoffDate || "06-22";
      calculatedYears = calculateLoyaltyPayYearsOfService(appointmentDate, usedFY, cutoffDate);
    } else {
      // Fallback to provided years if no appointment date
      calculatedYears = Number(yearsInService);
    }
    // 3) Compute amount using utility function
    const amount = calculateLoyaltyPayAmount(calculatedYears, settings.loyaltyPay);
    // 4) Save LoyaltyPay record
    const loyalty = new LoyaltyPay({
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      yearsInService: calculatedYears,
      appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
      amount,
      fiscalYear: usedFY,
      budgetType: budgetType || settings.budgetType,
      processBy,
      processDate,
    });
    await loyalty.save();
    // 5) Sync combined loyaltyAward to PersonnelServices
    const totalLoyalty = await computeTotalLoyalty(employeeFullName, usedFY);
    const person = await PersonnelServices.findOne({
      employeeFullName,
      fiscalYear: usedFY,
    });
    if (person) {
      person.loyaltyAward = totalLoyalty;
      await person.save();
    }
    return res.status(201).json({
      message: "Loyalty Pay record saved and PersonnelServices updated",
      data: loyalty,
      calculatedYears: calculatedYears, // Include calculated years for debugging
    });
  } catch (err) {
    console.error("❌ Error in createLoyaltyPay:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Get all Loyalty Pay records
 * (original logic unchanged)
 */
exports.getAllLoyaltyPays = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    let query = {};
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    } else {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (active) query.fiscalYear = active.fiscalYear;
    }
    const records = await LoyaltyPay.find(query).lean().sort({ createdAt: -1 });
    return res.status(200).json({ data: records });
  } catch (err) {
    console.error("❌ Error in getAllLoyaltyPays:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Update a Loyalty Pay record,
 * then recompute & sync combined loyaltyAward to PersonnelServices.
 */
exports.updateLoyaltyPay = async (req, res) => {
  try {
    const { id } = req.params;
    const { yearsInService, appointmentDate, fiscalYear } = req.body;
    // 1) Get settings
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.loyaltyPay) {
      return res.status(400).json({
        message: "Active settings with loyalty pay not found."
      });
    }
    const usedFY = fiscalYear || settings.fiscalYear;
    // 2) Calculate years of service with June 22 cutoff
    let calculatedYears;
    if (appointmentDate) {
      const cutoffDate = settings.loyaltyPay.cutoffDate || "06-22";
      calculatedYears = calculateLoyaltyPayYearsOfService(appointmentDate, usedFY, cutoffDate);
    } else {
      // Fallback to provided years if no appointment date
      calculatedYears = Number(yearsInService);
    }
    // 3) Compute amount using utility function
    const amount = calculateLoyaltyPayAmount(calculatedYears, settings.loyaltyPay);
    // 4) Update record
    const updated = await LoyaltyPay.findByIdAndUpdate(
      id,
      { ...req.body, yearsInService: calculatedYears, amount, fiscalYear: usedFY },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    // 5) Sync to PersonnelServices
    const totalLoyalty = await computeTotalLoyalty(updated.employeeFullName, usedFY);
    const person = await PersonnelServices.findOne({
      employeeFullName: updated.employeeFullName,
      fiscalYear:     usedFY,
    });
    if (person) {
      person.loyaltyAward = totalLoyalty;
      await person.save();
    }
    return res.status(200).json({
      ...updated.toObject(),
      calculatedYears: calculatedYears // Include calculated years for debugging
    });
  } catch (err) {
    console.error("❌ Error in updateLoyaltyPay:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Delete a Loyalty Pay record,
 * then recompute & sync combined loyaltyAward to PersonnelServices.
 */
exports.deleteLoyaltyPay = async (req, res) => {
  try {
    const { id } = req.params;
    const toDel = await LoyaltyPay.findById(id);
    if (!toDel) return res.status(404).json({ message: "Record not found." });
    await LoyaltyPay.findByIdAndDelete(id);
    const totalLoyalty = await computeTotalLoyalty(toDel.employeeNumber, toDel.fiscalYear);
    const person = await PersonnelServices.findOne({
      employeeNumber: toDel.employeeNumber,
      fiscalYear:     toDel.fiscalYear,
    });
    if (person) {
      person.loyaltyAward = totalLoyalty;
      person.Total = Object.values(person.toObject()).reduce(
        (sum, v) => (typeof v === "number" ? sum + v : sum),
        0
      );
      await person.save();
    }
    return res.status(200).json({ message: "Deleted and PersonnelServices updated." });
  } catch (err) {
    console.error("❌ Error in deleteLoyaltyPay:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Get loyalty pay statistics
 */
exports.getLoyaltyPayStats = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Build query to filter by fiscal year (same logic as getAllLoyaltyPays)
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
    const totalRecords = await LoyaltyPay.countDocuments(query);
    // Get the sum of all amounts with fiscal year filter
    const aggregationResult = await LoyaltyPay.aggregate([
      {
        $match: query // Apply the same filter as the table
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        }
      }
    ]);
    const totalAmount = aggregationResult.length > 0 ? aggregationResult[0].totalAmount : 0;
    const averageAmount = totalRecords > 0 ? totalAmount / totalRecords : 0;
    // Get unique employees count with fiscal year filter
    const uniqueEmployees = await LoyaltyPay.distinct('employeeNumber', query);
    const result = {
      totalRecords,
      totalAmount,
      averageAmount,
      uniqueEmployees: uniqueEmployees.length
    };
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching loyalty pay stats:", error);
    res.status(500).json({ message: "Failed to fetch loyalty pay statistics" });
  }
};
/**
 * Get sum of Loyalty Pay amounts for active fiscal year
 * (original logic unchanged)
 */
exports.getSumOfLoyaltyPay = async (req, res) => {
  try {
    const active = await Settings.findOne({ isActive: true }).lean();
    if (!active) {
      return res.status(400).json({ message: "Active settings not found." });
    }
    const fiscalYear = active.fiscalYear;
    const result = await LoyaltyPay.aggregate([
      { $match: { fiscalYear } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount = result[0]?.totalAmount || 0;
    return res.status(200).json({ totalAmount });
  } catch (err) {
    console.error("❌ Error in getSumOfLoyaltyPay:", err);
    return res
      .status(500)
      .json({ error: "Failed to calculate total loyalty pay amount.", message: err.message });
  }
};