const Settings = require("../models/Settings");
const RATA = require("../models/RATA");
const PersonnelServices = require("../models/personnelServices");
const EmployeeCourtAppearance = require("../models/employeeCourtAppearance");
const MealAllowance = require("../models/mealAllowance");
const mongoose = require("mongoose");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
} = require("../utils/controller_get_process");
exports.createSettings = async (req, res) => {
  try {
    const { fiscalYear, budgetType, isActive } = req.body;
    // Enforce uniqueness on (fiscalYear, budgetType)
    const existingSettings = await Settings.findOne({ fiscalYear, budgetType });
    if (existingSettings) {
      return res
        .status(400)
        .json({ field: "fiscalYear", message: "Settings for this fiscal year and budget type already exist." });
    }
    if (isActive) {
      await Settings.updateMany({}, { isActive: false });
    }
    // Ensure default values for medical and meal allowances if not provided
    const settingsData = {
      ...req.body,
      medicalAllowance: req.body.medicalAllowance !== undefined ? req.body.medicalAllowance : 200,
      meal: req.body.meal !== undefined ? req.body.meal : 200
    };
    const newSettings = new Settings(settingsData);
    await newSettings.save();
    res.status(201).json(newSettings);
  } catch (error) {
    console.error("Error in createSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getAllSettings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      orderBy,
      order = "asc",
      operator,
      ...filters
    } = req.query;
    let query = {};
    if (search && search.split("-").length !== 3) {
      query.$or = [{ fiscalYear: { $regex: search, $options: "i" } }];
    }
    numberFilter(query, filters, operator);
    booleanFilter(query, { isActive: filters.isActive });
    dateFilter(query, { createdAt: filters.createdAt });
    const sortQuery = {
      [orderBy || "createdAt"]: order.toLowerCase() === "desc" ? -1 : 1,
    };
    const skip = (Number(page) - 1) * Number(limit);
    const settings = await Settings.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort(sortQuery);
    const totalRecords = await Settings.countDocuments(query);
    return res.json({
      settings,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: Number(page),
      totalRecords,
    });
  } catch (error) {
    console.error("Error in getAllSettings:", error.stack);
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.getActiveSettings = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ message: "No active fiscal year found." });
    }
    res.status(200).json(activeSettings);
  } catch (error) {
    console.error("Error in getActiveSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.updateSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fiscalYear,
      startDate,
      dueDate,
      budgetType,
      isActive,
      meal,
      medicalAllowance,
      ...otherSettings
    } = req.body;
    // Check if settings exist without using a session
    const existing = await Settings.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Settings not found." });
    }
    if (
      (fiscalYear !== undefined && fiscalYear !== existing.fiscalYear) ||
      (budgetType !== undefined && budgetType !== existing.budgetType)
    ) {
      const dup = await Settings.findOne({
        fiscalYear: fiscalYear ?? existing.fiscalYear,
        budgetType: budgetType ?? existing.budgetType
      });
      if (dup && String(dup._id) !== String(existing._id)) {
        return res
          .status(400)
          .json({ field: "fiscalYear", message: "Settings for this fiscal year and budget type already exist." });
      }
    }
    // If isActive is being set to true, set all others to false
    if (isActive === true && existing.isActive === false) {
      await Settings.updateMany({}, { $set: { isActive: false } });
    }
    const toUpdate = {};
    if (fiscalYear !== undefined) toUpdate.fiscalYear = fiscalYear;
    if (startDate !== undefined) toUpdate.startDate = new Date(startDate);
    if (dueDate !== undefined) toUpdate.dueDate = new Date(dueDate);
    if (budgetType !== undefined) toUpdate.budgetType = budgetType;
    if (isActive === true) toUpdate.isActive = true;
    if (meal !== undefined) toUpdate.meal = meal;
    for (const [k, v] of Object.entries(otherSettings)) {
      if (v !== undefined) toUpdate[k] = v;
    }
    const updatedSettings = await Settings.findByIdAndUpdate(
      id,
      { $set: toUpdate },
      { new: true, runValidators: true }
    );
    const mealChanged = meal !== undefined && meal !== existing.meal;
    const medicalChanged =
      medicalAllowance !== undefined &&
      medicalAllowance !== existing.medicalAllowance;
    let mealAllowancesUpdated = false;
    if (mealChanged || medicalChanged) {
      // Find employees with MealAllowance records and hired before June 1988
      const mealAllowanceEmployees = await MealAllowance.find({
        fiscalYear: updatedSettings.fiscalYear,
      }).select("employeeNumber actualDays");
      const employeeNumbers = mealAllowanceEmployees.map((ma) => ma.employeeNumber);
      // Filter PersonnelServices for employees with MealAllowance and hired before June 1988
      const personnelToUpdate = await PersonnelServices.find({
        fiscalYear: updatedSettings.fiscalYear,
        employeeNumber: { $in: employeeNumbers },
        DateOfAppointment: { $lt: new Date("1988-06-01") },
      });
      // Update PersonnelServices.meal based on corresponding MealAllowance.actualDays
      for (const personnel of personnelToUpdate) {
        const mealAllowance = await MealAllowance.findOne({
          fiscalYear: updatedSettings.fiscalYear,
          employeeNumber: personnel.employeeNumber,
        });
        if (mealAllowance) {
          const updatedMonthlyAmount = mealAllowance.actualDays * meal;
          const updatedAnnualAmount = updatedMonthlyAmount * 12; // Calculate annual amount
          await PersonnelServices.updateOne(
            { _id: personnel._id },
            { $set: { meal: updatedAnnualAmount } }
          );
        }
      }
      // Only update meal allowances for employees who already have a meal allowance record
      await MealAllowance.updateMany(
        {
          fiscalYear: updatedSettings.fiscalYear,
          employeeNumber: { $in: employeeNumbers }
        },
        [
          {
            $set: {
              amount: { $multiply: ["$actualDays", meal] }, // Store monthly amount
            },
          },
        ]
      );
      mealAllowancesUpdated = true;
    }
    return res.status(200).json({
      ...updatedSettings.toObject(),
      _debug: {
        mealChanged,
        medicalChanged,
        personnelUpdated: mealChanged || medicalChanged,
        mealAllowancesUpdated,
      },
    });
  } catch (error) {
    console.error("Error in updateSettings:", error.stack);
    return res.status(500).json({ message: "Server error", error });
  }
};
exports.deleteSettings = async (req, res) => {
  try {
    const { id } = req.params;
    await Settings.findByIdAndDelete(id);
    res.status(200).json({ message: "Settings deleted successfully." });
  } catch (error) {
    console.error("Error in deleteSettings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.setActiveFiscalYear = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await Settings.findById(id);
    if (!settings) {
      return res.status(404).json({ message: "Settings not found." });
    }
    await Settings.updateMany({}, { isActive: false });
    settings.isActive = true;
    await settings.save();
    res.status(200).json({
      message: "Fiscal year activated successfully.",
      settings,
    });
  } catch (error) {
    console.error("Error in setActiveFiscalYear:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.getAdvancedSettings = async (req, res) => {
  try {
    const { fiscalYear } = req.params;
    const { budgetType } = req.query;
    const filter = { fiscalYear };
    if (budgetType) filter.budgetType = budgetType;
    const settings = await Settings.findOne(filter);
    if (!settings) {
      return res
        .status(404)
        .json({ message: "Settings not found for this fiscal year." });
    }
    const advancedFields = {
      PERA: settings.PERA,
      uniformAllowance: settings.uniformAllowance,
      productivityIncentive: settings.productivityIncentive,
      medicalAllowance: settings.medicalAllowance,
      cashGift: settings.cashGift,
      meal: settings.meal,
      courtAppearance: settings.courtAppearance,
      gsisPremium: settings.gsisPremium,
      philhealthPremium: settings.philhealthPremium,
      pagibigPremium: settings.pagibigPremium,
      employeeCompensation: settings.employeeCompensation,
      overtimeRate: settings.overtimeRate,
      weekdayMultiplier: settings.weekdayMultiplier,
      weekendMultiplier: settings.weekendMultiplier,
      subsistenceAllowanceRate: settings.subsistenceAllowanceRate,
      earnedLeaves: settings.earnedLeaves,
    };
    res.status(200).json(advancedFields);
  } catch (error) {
    console.error("Error fetching advanced settings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.updateAdvancedSettings = async (req, res) => {
  try {
    const { fiscalYear } = req.params;
    const { budgetType } = req.query;
    const updateData = req.body;
    // Enforce 5% for 2025 per PhilHealth Circular 2019-0009
    if (fiscalYear === "2025" && updateData.philhealthPremium !== undefined) {
      if (updateData.philhealthPremium !== 0.05) {
        return res.status(400).json({
          message: "PhilHealth premium must be 5% in 2025 per Circular 2019-0009.",
        });
      }
    }
    const filter = { fiscalYear };
    if (budgetType) filter.budgetType = budgetType;
    const settings = await Settings.findOneAndUpdate(
      filter,
      updateData,
      { new: true, runValidators: true }
    );
    if (!settings) {
      return res
        .status(404)
        .json({ message: "Settings not found for this fiscal year." });
    }
    // Recalculate philhealthPremium for all PersonnelServices
    if (updateData.philhealthPremium !== undefined) {
      const personnelServices = await PersonnelServices.find({ fiscalYear });
      for (const personnel of personnelServices) {
        let monthlyPhilhealthPremium;
        const monthlySalary = personnel.monthlySalary;
        if (monthlySalary <= 10000) {
          monthlyPhilhealthPremium = 500; // Fixed minimum for 2025
        } else if (monthlySalary >= 100000) {
          monthlyPhilhealthPremium = 5000; // Fixed maximum for 2025
        } else {
          monthlyPhilhealthPremium = monthlySalary * 0.05; // 5% rate for 2025
        }
        const newPhilhealthPremium = (monthlyPhilhealthPremium * 12) / 2;
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
          "pagibigPremium",
          "employeeCompensation",
          "subsistenceAllowanceMDS",
          "subsistenceAllowanceST",
          "overtimePay",
          "loyaltyAward",
          "retirementBenefits",
          "terminalLeave",
          "courtAppearance",
          "hazardPay",
          "subsistenceAllowance",
          "honoraria",
          "childrenAllowance",
          "earnedLeaves"
        ];
        personnel.philhealthPremium = newPhilhealthPremium;
        personnel.Total = numericFields.reduce(
          (acc, field) => acc + (Number(personnel[field]) || 0),
          0
        );
        await personnel.save();
      }
    }
    res.status(200).json({
      message: "Advanced settings updated successfully.",
      settings,
    });
  } catch (error) {
    console.error("Error updating advanced settings:", error.stack);
    res.status(500).json({ message: "Server error", error });
  }
};