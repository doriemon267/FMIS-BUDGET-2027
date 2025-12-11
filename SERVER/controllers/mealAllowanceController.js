const MealAllowance = require("../models/mealAllowance");
const Settings = require("../models/Settings");
const PersonnelService = require('../models/PersonnelServices');
const { body, validationResult } = require("express-validator");
const { calculateMealAllowance, calculateMonthlyMealAllowance, getAllowanceRates } = require("../utils/allowanceUtils");
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const validateMealAllowance = [
  body("employeeNumber")
    .trim()
    .notEmpty()
    .withMessage("Employee number is required"),
  body("employeeFullName")
    .trim()
    .notEmpty()
    .withMessage("Employee name is required"),
  body("actualDays")
    .isInt({ min: 0 })
    .withMessage("Actual days must be a non-negative integer"),
  body("fiscalYear")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Fiscal year cannot be empty"),
  body("processDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid process date"),
];
async function syncPersonnelServicesMeal(employeeNumber, fiscalYear, mealAmount = 0) {
  try {
    // First check if the personnel record has been submitted
    const personnelRecord = await PersonnelServices.findOne({
      employeeNumber,
      fiscalYear,
    });
    
    if (personnelRecord) {
      // Check if the record has been submitted and prevent updating
      const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
      if (submittedStatuses.includes(personnelRecord.status)) {
        console.log(`Cannot update meal allowance for submitted personnel record: ${employeeNumber}`);
        return false;
      }
    }

    // Update the personnel services record
    const updateResult = await PersonnelServices.updateOne(
      { employeeNumber, fiscalYear },
      { meal: mealAmount }
    );
    // Recalculate the Total field
    const updatedPersonnel = await PersonnelServices.findOne({
      employeeNumber,
      fiscalYear,
    });
    if (updatedPersonnel) {
      const numericFields = [
        "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
        "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
        "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
        "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
        "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
        "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
      ];
      const newTotal = numericFields.reduce(
        (acc, field) => acc + (Number(updatedPersonnel[field]) || 0),
        0
      );
      await PersonnelServices.updateOne(
        { employeeNumber, fiscalYear },
        { Total: newTotal }
      );
    }
    return updateResult.modifiedCount > 0;
  } catch (error) {
    console.error("Error syncing meal allowance:", error);
    return false;
  }
}
exports.createMealAllowance = [
  ...validateMealAllowance,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        processBy,
        processDate,
        fiscalYear,
        budgetType,
      } = req.body;
      // Force actualDays to be 22
      const actualDays = 22;
      // Verify employee was hired before June 1988
      const personnel = await PersonnelServices.findOne({
        employeeNumber,
        fiscalYear:
          fiscalYear ||
          (
            await Settings.findOne({ isActive: true }).lean()
          ).fiscalYear,
        DateOfAppointment: { $lt: new Date("1988-06-01") },
      });
      if (!personnel) {
        return res.status(400).json({
          message:
            "Employee is not eligible for meal allowance (must be hired before June 1988)",
        });
      }
      const settings = fiscalYear
        ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
        : await Settings.findOne({ isActive: true }).lean();
      if (!settings) {
        return res
          .status(404)
          .json({ message: "Active settings not found" });
      }
      // Get meal allowance rate (use default 200 if not set)
      const rates = getAllowanceRates(settings);
      const mealAllowanceRate = rates.mealAllowance;
      // Calculate monthly amount: days × daily rate
      const monthlyAmount = calculateMonthlyMealAllowance(actualDays, mealAllowanceRate);
      // Calculate annual amount: monthly amount × 12 months
      const annualAmount = calculateMealAllowance(actualDays, mealAllowanceRate);
      const usedFiscalYear = fiscalYear || settings.fiscalYear;
      const usedBudgetType = budgetType || settings.budgetType;
      const existing = await MealAllowance.findOne({
        employeeNumber,
        fiscalYear: usedFiscalYear,
        budgetType: usedBudgetType,
      });
      if (existing) {
        return res.status(400).json({
          message:
            "Meal allowance already exists for this employee, fiscal year, and budget type",
        });
      }
      const record = new MealAllowance({
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        actualDays: actualDays, // Always 22
        amount: monthlyAmount, // Store monthly amount (66 in your example)
        processBy,
        processDate: processDate ? new Date(processDate) : new Date(),
        fiscalYear: usedFiscalYear,
        budgetType: usedBudgetType,
      });
      await record.save();
      // Update the personnel services record with the annual amount
      await PersonnelServices.updateOne(
        { employeeNumber, fiscalYear: usedFiscalYear },
        { meal: annualAmount } // Store annual amount (792 in your example)
      );
      // Recalculate the Total field in PersonnelServices
      const updatedPersonnel = await PersonnelServices.findOne({
        employeeNumber,
        fiscalYear: usedFiscalYear,
      });
      if (updatedPersonnel) {
        const numericFields = [
          "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
          "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
          "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
          "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
          "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
          "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
        ];
        const newTotal = numericFields.reduce(
          (acc, field) => acc + (Number(updatedPersonnel[field]) || 0),
          0
        );
        await PersonnelServices.updateOne(
          { employeeNumber, fiscalYear: usedFiscalYear },
          { Total: newTotal }
        );
        
        // Recalculate proposal totals if personnel has a proposalId
        if (updatedPersonnel.proposalId) {
          try {
            await recalculateAndSaveProposalTotals({ proposalId: updatedPersonnel.proposalId });
          } catch (recalcErr) {
            console.error('Error recalculating proposal totals:', recalcErr);
          }
        }
      }
      return res.status(201).json(record);
    } catch (err) {
      console.error("❌ Error in createMealAllowance:", err.stack);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  },
];
exports.updateMealAllowance = [
  ...validateMealAllowance,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        processBy,
        processDate,
        fiscalYear,
        budgetType,
      } = req.body;
      // Force actualDays to be 22
      const actualDays = 22;
      // Verify employee was hired before June 1988
      const personnel = await PersonnelServices.findOne({
        employeeNumber,
        fiscalYear:
          fiscalYear ||
          (
            await Settings.findOne({ isActive: true }).lean()
          ).fiscalYear,
        DateOfAppointment: { $lt: new Date("1988-06-01") },
      });
      if (!personnel) {
        return res.status(400).json({
          message:
            "Employee is not eligible for meal allowance (must be hired before June 1988)",
        });
      }
      const settings = fiscalYear
        ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
        : await Settings.findOne({ isActive: true }).lean();
      if (!settings) {
        return res
          .status(404)
          .json({ message: "Active settings not found" });
      }
      // Get meal allowance rate (use default 200 if not set)
      const rates = getAllowanceRates(settings);
      const mealAllowanceRate = rates.mealAllowance;
      // Calculate monthly amount
      const monthlyAmount = calculateMonthlyMealAllowance(actualDays, mealAllowanceRate);
      // Calculate annual amount (monthly * 12)
      const annualAmount = calculateMealAllowance(actualDays, mealAllowanceRate);
      const usedFiscalYear = fiscalYear || settings.fiscalYear;
      const usedBudgetType = budgetType || settings.budgetType;
      const updated = await MealAllowance.findByIdAndUpdate(
        id,
        {
          employeeNumber,
          employeeFullName,
          positionTitle,
          department,
          division,
          region,
          actualDays: actualDays, // Always 22
          amount: monthlyAmount, // Store monthly amount in MealAllowance
          processBy,
          processDate: processDate ? new Date(processDate) : new Date(),
          fiscalYear: usedFiscalYear,
          budgetType: usedBudgetType,
        },
        { new: true, runValidators: true }
      );
      if (!updated)
        return res.status(404).json({ message: "Record not found" });
      // Update the personnel services record with the annual amount
      // First check if the personnel record has been submitted
      const personnelRecord = await PersonnelServices.findOne({
        employeeNumber: updated.employeeNumber,
        fiscalYear: usedFiscalYear,
      });
      
      if (personnelRecord) {
        // Check if the record has been submitted and prevent updating
        const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
        if (submittedStatuses.includes(personnelRecord.status)) {
          return res.status(403).json({
            error: "Update not allowed",
            message: "Cannot update meal allowance for personnel service record that has been submitted or approved"
          });
        }
      }

      await PersonnelServices.updateOne(
        { employeeNumber: updated.employeeNumber, fiscalYear: usedFiscalYear },
        { meal: annualAmount } // Store annual amount in PersonnelServices
      );
      // Recalculate the Total field in PersonnelServices
      const updatedPersonnel = await PersonnelServices.findOne({
        employeeNumber: updated.employeeNumber,
        fiscalYear: usedFiscalYear,
      });
      if (updatedPersonnel) {
        const numericFields = [
          "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
          "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
          "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
          "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
          "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
          "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
        ];
        const newTotal = numericFields.reduce(
          (acc, field) => acc + (Number(updatedPersonnel[field]) || 0),
          0
        );
        await PersonnelServices.updateOne(
          { employeeNumber: updated.employeeNumber, fiscalYear: usedFiscalYear },
          { Total: newTotal }
        );
        
        // Recalculate proposal totals if personnel has a proposalId
        if (updatedPersonnel.proposalId) {
          try {
            await recalculateAndSaveProposalTotals({ proposalId: updatedPersonnel.proposalId });
          } catch (recalcErr) {
            console.error('Error recalculating proposal totals:', recalcErr);
          }
        }
      }
      return res.status(200).json(updated);
    } catch (err) {
      console.error("❌ Error in updateMealAllowance:", err.stack);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  },
];
exports.getAllMealAllowances = async (req, res) => {
  try {
    const {
      fiscalYear,
      page = 1,
      limit = 10,
      search,
      orderBy = "createdAt",
      order = "asc",
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
      const searchCondition = {
        $or: [
          { employeeFullName: { $regex: search, $options: "i" } },
          { positionTitle: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
          { division: { $regex: search, $options: "i" } },
          { region: { $regex: search, $options: "i" } },
        ]
      };
      
      if (query.$and) {
        query.$and.push(searchCondition);
      } else {
        query = {
          $and: [query, searchCondition]
        };
      }
    }
    let fy = fiscalYear;
    if (!fy) {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (!active)
        return res.status(400).json({ message: "Active settings not found" });
      fy = active.fiscalYear;
    }
    
    if (query.$and) {
      query.$and.push({ fiscalYear: fy });
    } else {
      query.fiscalYear = fy;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [orderBy]: order === "desc" ? -1 : 1 };
    const [records, total] = await Promise.all([
      MealAllowance.find(query)
        .select("-__v")
        .lean()
        .skip(skip)
        .limit(Number(limit))
        .sort(sort),
      MealAllowance.countDocuments(query),
    ]);
    return res.status(200).json({
      data: records,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      totalRecords: total,
    });
  } catch (err) {
    console.error("❌ Error in getAllMealAllowances:", err.stack);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
exports.updateMealAllowance = [
  ...validateMealAllowance,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        processBy,
        processDate,
        fiscalYear,
        budgetType,
      } = req.body;
      const settings = fiscalYear
        ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
        : await Settings.findOne({ isActive: true }).lean();
      if (!settings || !settings.meal) {
        return res
          .status(404)
          .json({ message: "Active settings with meal rate not found" });
      }
      const amount = Number(actualDays) * Number(settings.meal);
      const usedFiscalYear = fiscalYear || settings.fiscalYear;
      const usedBudgetType = budgetType || settings.budgetType;
      const updated = await MealAllowance.findByIdAndUpdate(
        id,
        {
          employeeNumber,
          employeeFullName,
          positionTitle,
          department,
          division,
          region,
          actualDays: actualDays, // Always 22
          amount,
          processBy,
          processDate: processDate ? new Date(processDate) : new Date(),
          fiscalYear: usedFiscalYear,
          budgetType: usedBudgetType,
        },
        { new: true, runValidators: true }
      );
      if (!updated)
        return res.status(404).json({ message: "Record not found" });
      await PersonnelServices.updateOne(
        { employeeNumber: updated.employeeNumber, fiscalYear: usedFiscalYear },
        { meal: amount },
        { upsert: true }
      );
      return res
        .status(200)
        .json({ message: "Record updated and synced", data: updated });
    } catch (err) {
      console.error("❌ Error in updateMealAllowance:", err.stack);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
    }
  },
];
// In mealAllowanceController.js
exports.deleteMealAllowance = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the meal allowance record before deleting
    const toDelete = await MealAllowance.findById(id);
    if (!toDelete) {
      return res.status(404).json({ message: "Record not found" });
    }
    const { employeeNumber, fiscalYear } = toDelete;
    
    // Check if the personnel record has been submitted before allowing deletion
    const personnelRecord = await PersonnelServices.findOne({
      employeeNumber,
      fiscalYear,
    });
    
    if (personnelRecord) {
      // Check if the record has been submitted and prevent deletion
      const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
      if (submittedStatuses.includes(personnelRecord.status)) {
        return res.status(403).json({
          error: "Delete not allowed",
          message: "Cannot delete meal allowance for personnel service record that has been submitted or approved"
        });
      }
    }

    // Delete the meal allowance record
    await MealAllowance.findByIdAndDelete(id);
    // CRITICAL: Reset the meal value to 0 in PersonnelServices
    const updateResult = await PersonnelServices.updateOne(
      { employeeNumber, fiscalYear },
      { $set: { meal: 0 } }
    );
    // Verify the update worked
    const verifyDoc = await PersonnelServices.findOne({ employeeNumber, fiscalYear });
    if (verifyDoc) {
      // If meal is still not 0, try direct document update
      if (verifyDoc.meal !== 0) {
        verifyDoc.meal = 0;
        await verifyDoc.save();
        }
      // Recalculate Total field
      const numericFields = [
        "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
        "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
        "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
        "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
        "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
        "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
      ];
      const newTotal = numericFields.reduce(
        (acc, field) => acc + (Number(verifyDoc[field]) || 0),
        0
      );
      // Update the total
      await PersonnelServices.updateOne(
        { employeeNumber, fiscalYear },
        { $set: { Total: newTotal } }
      );
      } else {
      }
    // Return success response
    return res.status(200).json({
      message: "Meal allowance deleted successfully",
      success: true
    });
  } catch (error) {
    console.error(`Error deleting meal allowance:`, error);
    return res.status(500).json({ 
      message: "Server error", 
      details: error.message 
    });
  }
};
// Add this new controller function
exports.getMealAllowanceStats = async (req, res) => {
  try {
    const totalRecords = await MealAllowance.countDocuments();
    // Get the sum of all amounts (convert monthly to annual to match table display)
    const aggregationResult = await MealAllowance.aggregate([
      {
        $group: {
          _id: null,
          totalMonthlyAmount: { $sum: "$amount" }, // Amount is monthly in database
        }
      }
    ]);
    // Convert to annual amounts to match what's displayed in the table (monthly × 12)
    const totalMonthlyAmount = aggregationResult.length > 0 ? aggregationResult[0].totalMonthlyAmount : 0;
    const totalAmount = totalMonthlyAmount * 12; // Convert to annual
    const averageAmount = totalRecords > 0 ? totalAmount / totalRecords : 0;
    // Get unique employees count
    const uniqueEmployees = await MealAllowance.distinct('employeeNumber');
    res.status(200).json({
      totalRecords,
      totalAmount,
      averageAmount,
      uniqueEmployees: uniqueEmployees.length
    });
  } catch (error) {
    console.error("Error fetching meal allowance stats:", error);
    res.status(500).json({ message: "Failed to fetch meal allowance statistics" });
  }
};
