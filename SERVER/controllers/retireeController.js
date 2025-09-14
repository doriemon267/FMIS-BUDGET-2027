const Retiree = require("../models/Retiree");
const PersonnelServices = require("../models/personnelServices");
const Settings = require("../models/Settings");
/**
 * Get all retirees with pagination
 */
exports.getAllRetirees = async (req, res) => {
  try {
    // Build query with hierarchical filters
    const query = {};
    
    // Merge hierarchical read filters if present
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    
    const retirees = await Retiree.find(query).sort({ createdAt: -1 });
    // Log a sample record if available
    if (retirees.length > 0) {
      }
    res.status(200).json(retirees);
  } catch (error) {
    console.error("Error fetching retirees:", error);
    res.status(500).json({ message: error.message });
  }
};
/**
 * Get a single retiree by ID
 */
exports.getRetireeById = async (req, res) => {
  try {
    const { id } = req.params;
    const retiree = await Retiree.findById(id);
    if (!retiree) {
      return res.status(404).json({ message: "Retiree not found" });
    }
    return res.status(200).json(retiree);
  } catch (error) {
    console.error("Error in getRetireeById:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Create a new retiree record
 */
exports.createRetiree = async (req, res) => {
  try {
    // Convert string amounts to numbers
    const formData = {
      ...req.body,
      terminalLeave: parseFloat(req.body.terminalLeave) || 0,
      retirementGratuity: parseFloat(req.body.retirementGratuity) || 0,
      total: parseFloat(req.body.total) || 
             (parseFloat(req.body.terminalLeave) || 0) + 
             (parseFloat(req.body.retirementGratuity) || 0)
    };
    const newRetiree = new Retiree(formData);
    await newRetiree.save();
    res.status(201).json({ 
      message: "Retiree record created successfully", 
      retiree: newRetiree 
    });
  } catch (error) {
    console.error("Error creating retiree:", error);
    res.status(500).json({ message: error.message });
  }
};
/**
 * Update a retiree record
 */
exports.updateRetiree = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      retirementType,
      dateOfRetirement,
      terminalLeave,
      retirementGratuity,
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;
    // Get active settings if fiscalYear not provided
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings) {
      return res.status(400).json({ message: "Active settings not found." });
    }
    const usedFiscalYear = fiscalYear || settings.fiscalYear;
    const usedBudgetType = budgetType || settings.budgetType;
    // Update retiree record
    const updatedRetiree = await Retiree.findByIdAndUpdate(
      id,
      {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        retirementType,
        dateOfRetirement,
        terminalLeave: Number(terminalLeave),
        retirementGratuity: Number(retirementGratuity),
        total: Number(terminalLeave) + Number(retirementGratuity),
        processBy,
        processDate,
        fiscalYear: usedFiscalYear,
        budgetType: usedBudgetType,
      },
      { new: true }
    );
    if (!updatedRetiree) {
      return res.status(404).json({ message: "Retiree not found" });
    }
    // Update PersonnelServices record
    const personnel = await PersonnelServices.findOne({
      employeeNumber,
      fiscalYear: usedFiscalYear,
    });
    if (personnel) {
      personnel.terminalLeave = Number(terminalLeave);
      personnel.retirementBenefits = Number(retirementGratuity);
      // Recalculate Total
      const numericFields = [
        "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
        "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
        "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
        "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
        "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
        "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
      ];
      const newTotal = numericFields.reduce(
        (acc, field) => acc + (Number(personnel[field]) || 0),
        0
      );
      personnel.Total = newTotal;
      await personnel.save();
    }
    return res.status(200).json(updatedRetiree);
  } catch (error) {
    console.error("Error in updateRetiree:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Delete a retiree record
 */
exports.deleteRetiree = async (req, res) => {
  try {
    const { id } = req.params;
    const retiree = await Retiree.findById(id);
    if (!retiree) {
      return res.status(404).json({ message: "Retiree not found" });
    }
    // First, update the PersonnelServices record to remove retirement benefits
    const personnel = await PersonnelServices.findOne({
      employeeNumber: retiree.employeeNumber,
      fiscalYear: retiree.fiscalYear,
    });
    if (personnel) {
      personnel.terminalLeave = 0;
      personnel.retirementBenefits = 0;
      // Recalculate Total
      const numericFields = [
        "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
        "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
        "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
        "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
        "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
        "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
      ];
      const newTotal = numericFields.reduce(
        (acc, field) => acc + (Number(personnel[field]) || 0),
        0
      );
      personnel.Total = newTotal;
      await personnel.save();
    }
    // Then delete the retiree record
    await Retiree.findByIdAndDelete(id);
    return res.status(200).json({ message: "Retiree record deleted successfully" });
  } catch (error) {
    console.error("Error in deleteRetiree:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Get retiree statistics
 */
exports.getRetireeStats = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Build query to filter by fiscal year
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
    const totalRecords = await Retiree.countDocuments(query);
    // Get the sum of all benefits with fiscal year filter
    const aggregationResult = await Retiree.aggregate([
      {
        $match: query // Apply the same filter as the table
      },
      {
        $group: {
          _id: null,
          totalBenefits: { $sum: "$total" },
          totalTerminalLeave: { $sum: "$terminalLeave" },
          totalRetirementGratuity: { $sum: "$retirementGratuity" },
        }
      }
    ]);
    // Get counts by retirement type
    const compulsoryCount = await Retiree.countDocuments({ ...query, retirementType: "Compulsory" });
    const optionalCount = await Retiree.countDocuments({ ...query, retirementType: "Optional" });
    const totalBenefits = aggregationResult.length > 0 ? aggregationResult[0].totalBenefits : 0;
    const totalTerminalLeave = aggregationResult.length > 0 ? aggregationResult[0].totalTerminalLeave : 0;
    const totalRetirementGratuity = aggregationResult.length > 0 ? aggregationResult[0].totalRetirementGratuity : 0;
    const result = {
      totalRecords,
      totalBenefits,
      totalTerminalLeave,
      totalRetirementGratuity,
      compulsoryRetirements: compulsoryCount,
      optionalRetirements: optionalCount
    };
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching retiree stats:", error);
    res.status(500).json({ message: "Failed to fetch retiree statistics" });
  }
};
/**
 * Get summary of retirees by type
 */
exports.getRetireesSummary = async (req, res) => {
  try {
    const { fiscalYear } = req.query;
    // Get active settings if fiscalYear not provided
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings) {
      return res.status(400).json({ message: "Settings not found." });
    }
    const usedFiscalYear = fiscalYear || settings.fiscalYear;
    // Get summary for Compulsory retirements
    const compulsorySummary = await Retiree.aggregate([
      { 
        $match: { 
          fiscalYear: usedFiscalYear,
          retirementType: "Compulsory"
        } 
      },
      { 
        $group: { 
          _id: null, 
          terminalLeaveTotal: { $sum: "$terminalLeave" },
          retirementGratuityTotal: { $sum: "$retirementGratuity" },
          total: { $sum: "$total" },
          count: { $sum: 1 }
        } 
      }
    ]);
    // Get summary for Optional retirements
    const optionalSummary = await Retiree.aggregate([
      { 
        $match: { 
          fiscalYear: usedFiscalYear,
          retirementType: "Optional"
        } 
      },
      { 
        $group: { 
          _id: null, 
          terminalLeaveTotal: { $sum: "$terminalLeave" },
          retirementGratuityTotal: { $sum: "$retirementGratuity" },
          total: { $sum: "$total" },
          count: { $sum: 1 }
        } 
      }
    ]);
    return res.status(200).json({
      fiscalYear: usedFiscalYear,
      compulsory: compulsorySummary[0] || {
        terminalLeaveTotal: 0,
        retirementGratuityTotal: 0,
        total: 0,
        count: 0
      },
      optional: optionalSummary[0] || {
        terminalLeaveTotal: 0,
        retirementGratuityTotal: 0,
        total: 0,
        count: 0
      }
    });
  } catch (error) {
    console.error("Error in getRetireesSummary:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
// ...existing code...
exports.getEligibleForRetirement = async (req, res) => {
  try {
    const today = new Date();
    const { region } = req.query;
    // Build query for active employees with appointment and birthdate
    const query = {
      employeeStatus: "Active",
      DateOfAppointment: { $exists: true, $ne: null },
      DateOfBirth: { $exists: true, $ne: null }
    };
    // Merge hierarchical read filters if present (ensure eligible employees match visible scope)
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }

    // Add region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }
    // Get employees based on query
    const employees = await PersonnelServices.find(query).lean();
    const eligible = employees
      .map(emp => {
        const dob = new Date(emp.dateOfBirth || emp.DateOfBirth);
        const doa = new Date(emp.dateOfAppointment || emp.DateOfAppointment);
        // Compute age
        let age = today.getFullYear() - dob.getFullYear();
        if (
          today.getMonth() < dob.getMonth() ||
          (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
        ) {
          age--;
        }
        // Compute service years
        let serviceYears = today.getFullYear() - doa.getFullYear();
        if (
          today.getMonth() < doa.getMonth() ||
          (today.getMonth() === doa.getMonth() && today.getDate() < doa.getDate())
        ) {
          serviceYears--;
        }
        // Determine eligibility
        let eligibleType = null;
        if (age >= 65 || serviceYears >= 30) {
          eligibleType = "Compulsory";
        } else if (
          (age >= 60 && age < 65 && serviceYears >= 15) ||
          serviceYears >= 25
        ) {
          eligibleType = "Optional";
        }
        return eligibleType
          ? {
              employeeNumber: emp.employeeNumber || emp.EmployeeID,
              employeeFullName: emp.employeeFullName || emp.EmployeeFullName,
              positionTitle: emp.positionTitle || emp.PositionTitle,
              department: emp.department || emp.Department,
              division: emp.division || emp.Division,
              region: emp.region || emp.Region,
              dateOfBirth: emp.dateOfBirth || emp.DateOfBirth,
              dateOfAppointment: emp.dateOfAppointment || emp.DateOfAppointment,
              earnedLeaves: emp.earnedLeaves,
              annualSalary: emp.annualSalary,
              age,
              serviceYears,
              eligibleType,
            }
          : null;
      })
      .filter(Boolean);
    res.json(eligible);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
};