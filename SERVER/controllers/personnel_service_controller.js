const mongoose = require("mongoose");
const PersonnelServices = require("../models/personnelServices");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
// Import MealAllowance and MedicalAllowance models safely
const MealAllowance =
  mongoose.models.MealAllowance || require("../models/mealAllowance");
const MedicalAllowance =
  mongoose.models.MedicalAllowance || require("../models/medicalAllowance");
const {
  numberFilter,
  dateFilter,
  textFilter,
  booleanFilter,
  searchFilter,
} = require("../utils/controller_get_process");
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
        // Calculate the correct annual amount
        const monthlyAmount = mealAllowance.actualDays * settings.meal;
        const annualAmount = monthlyAmount * 12;
        // Update the personnel services record
        await PersonnelServices.updateOne(
          { employeerails: true },
          { employeeNumber, fiscalYear },
          { meal: annualAmount }
        );
        // Recalculate the Total field
        const updatedPersonnel = await PersonnelServices.findOne({
          employeeNumber,
          fiscalYear,
        });
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
          const newTotal = numericFields.reduce(
            (acc, field) => acc + (Number(updatedPersonnel[field]) || 0),
            0
          );
          await PersonnelServices.updateOne(
            { employeeNumber, fiscalYear },
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
    const activeSettings = await Settings.findOne({ isActive: true });
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
    } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res
        .status(400)
        .json({
          message: "Active settings not found",
          details: "No active settings available",
        });
    }
    // Set strict fiscal year filter
    const query = {
      fiscalYear: activeSettings.fiscalYear, // Strict fiscal year filter
    };
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
    // Apply submission workflow filters from middleware
    if (req.submissionWorkflowFilters) {
      Object.assign(query, req.submissionWorkflowFilters);
    }
    
    // Apply hierarchical filters  
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }
    // Add region filter if provided (and not already constrained by hierarchy)
    if (region && !query.region) {
      query.region = region;
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
    const totalRecords = await PersonnelServices.countDocuments(query);
    // Recalculate fields
    personnelServices = personnelServices.map((personnel) => {
      const recalculatedSubsistenceAllowanceMDS =
        personnel.subsistenceAllowanceMDS;
      const recalculatedSubsistenceAllowanceST =
        personnel.subsistenceAllowanceST;
      const recalculatedLoyaltyAward = personnel.loyaltyAward;
      const recalculatedOvertimePay = personnel.overtimePay;
      const recalculatedAnnualSalary = personnel.monthlySalary * 12;
      const recalculatedRATA = personnel.RATA;
      const recalculatedPERA = activeSettings.PERA * 12;
      const recalculatedUniform = activeSettings.uniformAllowance;
      const recalculatedProductivityIncentive =
        activeSettings.productivityIncentive;
      const recalculatedCashGift = activeSettings.cashGift;
      const recalculatedMidyearBonus = personnel.midyearBonus;
      const recalculatedYearEndBonus = personnel.yearEndBonus;
      const recalculatedCourtAppearanceAmount = personnel.courtAppearance;
      const recalculatedGsis =
        personnel.annualSalary * activeSettings.gsisPremium;
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
      const recalculatedPhilhealth = (monthlyPhilhealthPremium * 12) / 2;
      const recalculatedPagibig = activeSettings.pagibigPremium * 12;
      const recalculatedEmpComp = activeSettings.employeeCompensation * 12;
      const recalculatedTerminalLeave = personnel.terminalLeave;
      const recalculatedearnedLeaves = personnel.earnedLeaves;
      const recalculatedTotal =
        recalculatedAnnualSalary +
        recalculatedSubsistenceAllowanceMDS +
        recalculatedSubsistenceAllowanceST +
        recalculatedLoyaltyAward +
        recalculatedOvertimePay +
        recalculatedRATA +
        recalculatedPERA +
        recalculatedUniform +
        recalculatedProductivityIncentive +
        personnel.medical +
        personnel.meal +
        personnel.childrenAllowance +
        recalculatedCashGift +
        recalculatedMidyearBonus +
        recalculatedYearEndBonus +
        recalculatedCourtAppearanceAmount +
        recalculatedGsis +
        recalculatedPhilhealth +
        recalculatedPagibig +
        recalculatedearnedLeaves +
        recalculatedTerminalLeave +
        recalculatedEmpComp;
      return {
        ...personnel.toObject(),
        annualSalary: recalculatedAnnualSalary,
        subsistenceAllowanceMDS: recalculatedSubsistenceAllowanceMDS,
        subsistenceAllowanceST: recalculatedSubsistenceAllowanceST,
        loyaltyAward: recalculatedLoyaltyAward,
        overtimePay: recalculatedOvertimePay,
        RATA: recalculatedRATA,
        PERA: recalculatedPERA,
        uniformALLOWANCE: recalculatedUniform,
        productivityIncentive: recalculatedProductivityIncentive,
        cashGift: recalculatedCashGift,
        midyearBonus: recalculatedMidyearBonus,
        yearEndBonus: recalculatedYearEndBonus,
        courtAppearance: recalculatedCourtAppearanceAmount,
        gsisPremium: recalculatedGsis,
        philhealthPremium: recalculatedPhilhealth,
        pagibigPremium: recalculatedPagibig,
        employeeCompensation: recalculatedEmpComp,
        terminalLeave: recalculatedTerminalLeave,
        earnedLeaves: recalculatedearnedLeaves,
        Total: recalculatedTotal,
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
    const { statusOfAppointment, RATA } = req.body;
    if (!statusOfAppointment || !RATA) {
      return res
        .status(400)
        .json({
          message:
            "Missing required fields: statusOfAppointment and RATA are required",
        });
    }
    const activeSettings = await Settings.findOne({ isActive: true });
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
    // Get region from request body
    const { region } = req.body; // Build query for employees with fiscal year
    const employeeQuery = {
      StatusOfAppointment: statusOfAppointment,
      employeeStatus: "Active", // Only get active employees
      fiscalYear: fiscalYear, // Only get employees for the current fiscal year
    };
    // Add region filter if provided
    if (region) {
      employeeQuery.Region = region;
      }
    // Fetch only Active employees with the specified StatusOfAppointment and region (if provided)
    const employees = await EmployeeMaster.find(employeeQuery);
    // Check if no employees found
    if (employees.length === 0) {
      return res.status(200).json([]);
    }
    const personnelServicesData = [];
    for (const employee of employees) {
      // Check if employee already exists in PersonnelServices for current fiscal year
      const existingPersonnelService = await PersonnelServices.findOne({
        employeeNumber: employee.EmployeeID,
        fiscalYear: fiscalYear,
      });
      if (existingPersonnelService) {
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
        department: employee.Department || "",
        division: employee.Division || "",
        section: employee.Section || "",
        unit: employee.Unit || "",
        // Use the region from the request body if provided, otherwise use the employee's region
        region: req.body.region || employee.Region || "",
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
        PERA: (req.body.PERA || activeSettings.PERA) * 12,
        uniformALLOWANCE: activeSettings.uniformAllowance || 0,
        productivityIncentive:
          req.body.compensation?.productivityIncentive || 0,
        medical: (req.body.medicalAllowance || 0) * 12,
        meal: 0,
        cashGift: req.body.compensation?.cashGift || 0,
        midyearBonus: monthlySalary,
        yearEndBonus: monthlySalary,
        gsisPremium: annualSalary * (activeSettings.gsisPremium || 0),
        philhealthPremium: (monthlyPhilhealthPremium * 12) / 2,
        pagibigPremium: (activeSettings.pagibigPremium || 0) * 12,
        employeeCompensation: (activeSettings.employeeCompensation || 0) * 12,
        subsistenceAllowanceMDS: 0,
        subsistenceAllowanceST: 0,
        overtimePay: 0,
        loyaltyAward: 0,
        earnedLeaves: monthlySalary * 30 * activeSettings.earnedLeaves, // Assuming 12 months of leaves for each employee
        retirementBenefits: 0,
        terminalLeave: 0,
        courtAppearance: 0,
        Total: 0,
      };
      if (statusAppointment === "COS") {
        personnelService = {
          ...personnelService,
          RATA: 0,
          PERA: 0,
          uniformALLOWANCE: 0,
          productivityIncentive: 0,
          medical: 0,
          meal: 0,
          cashGift: 0,
          midyearBonus: 0,
          yearEndBonus: 0,
          gsisPremium: 0,
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
      }
      personnelServicesData.push(personnelService);
    }
    if (personnelServicesData.length > 0) {
      const addedPersonnelServices = await PersonnelServices.insertMany(
        personnelServicesData
      );
      res.status(200).json(addedPersonnelServices);
    } else {
      res.status(200).json({ message: "No new personnel services to add." });
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
    const allowedFields = [
      "employeeFullName",
      "noOfDependent",
      "hazardPay",
      "subsistenceAllowance",
      "honoraria",
      "childrenAllowance",
      "Total",
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
    const personnelServices = await PersonnelServices.findById(id);
    if (!personnelServices) {
      return res
        .status(404)
        .json({
          message: "Personnel service not found",
          details: "No record found for the given ID",
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
      "honoraria",
      "childrenAllowance",
    ];
    updatedPersonnelService.Total = numericFields.reduce(
      (acc, field) => acc + (Number(updatedPersonnelService[field]) || 0),
      0
    );
    await updatedPersonnelService.save();
    res.status(200).json(updatedPersonnelService);
  } catch (error) {
    console.error("Error in updatePersonnelService:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getAllPerServices = async (req, res) => {
  try {
    const { fiscalYear, region } = req.query;
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
    
    const personnelServices = await PersonnelServices.find(query);
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel services:", error.stack);
    res.status(500).json({ message: "Server error", details: error.message });
  }
};
exports.getGrandTotalPermanent = async (req, res) => {
  try {
    let activeSettings = await Settings.findOne({ isActive: true }).lean();
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
      statusOfAppointment: "PERMANENT",
      fiscalYear,
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
    const personnelServices = await PersonnelServices.find(query).lean();
    const fieldsToSum = [
      "annualSalary",
      "RATA",
      "PERA",
      "uniformALLOWANCE",
      "productivityIncentive",
      "medical",
      "childrenAllowance",
      "meal",
      "cashGift",
      "subsistenceAllowanceMDS",
      "subsistenceAllowanceST",
      "midyearBonus",
      "yearEndBonus",
      "gsisPremium",
      "philhealthPremium",
      "pagibigPremium",
      "employeeCompensation",
      "loyaltyAward",
      "overtimePay",
      "earnedLeaves",
      "retirementBenefits",
      "terminalLeave",
      "courtAppearance",
    ];
    const grandTotal = personnelServices.reduce((acc, curr) => {
      const subtotal = fieldsToSum.reduce(
        (sum, field) => sum + (Number(curr[field]) || 0),
        0
      );
      return acc + subtotal;
    }, 0);
    return res.json({ fiscalYear, grandTotal });
  } catch (error) {
    console.error("Error in getGrandTotalPermanent:", error.stack);
    return res
      .status(500)
      .json({ message: "Server error", details: error.message });
  }
};
exports.getGrandTotalCasual = async (req, res) => {
  try {
    let activeSettings = await Settings.findOne({ isActive: true }).lean();
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
    const personnelServices = await PersonnelServices.find(query).lean();
    const fieldsToSum = [
      "annualSalary",
      "PERA",
      "uniformALLOWANCE",
      "productivityIncentive",
      "medical",
      "childrenAllowance",
      "meal",
      "cashGift",
      "subsistenceAllowanceMDS",
      "subsistenceAllowanceST",
      "midyearBonus",
      "yearEndBonus",
      "gsisPremium",
      "philhealthPremium",
      "pagibigPremium",
      "employeeCompensation",
      "loyaltyAward",
      "overtimePay",
      "earnedLeaves",
      "retirementBenefits",
      "terminalLeave",
    ];
    const grandTotal = personnelServices.reduce((acc, curr) => {
      const subtotal = fieldsToSum.reduce(
        (sum, field) => sum + (Number(curr[field]) || 0),
        0
      );
      return acc + subtotal;
    }, 0);
    return res.json({ fiscalYear, grandTotal });
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
    const result = grandTotal[0] || { grandTotal: 0 };
    res.status(200).json(result);
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
module.exports = {
  getAllPersonnelServices: exports.getAllPersonnelServices,
  bulkAddPersonnelServices: exports.bulkAddPersonnelServices,
  getAllPerServices: exports.getAllPerServices,
  updatePersonnelService: exports.updatePersonnelService,
  getGrandTotalPermanent: exports.getGrandTotalPermanent,
  getGrandTotalCasual: exports.getGrandTotalCasual,
  deleteAllPersonnelss: exports.deleteAllPersonnelss,
  getGrandTotal: exports.getGrandTotal,
  getPersonnelHiredBeforeJune1988: exports.getPersonnelHiredBeforeJune1988,
  syncAllMealAllowances: exports.syncAllMealAllowances,
  getPersonnelServices: exports.getPersonnelServices,
  PersonnelServices: require("../models/personnelServices"),
};
