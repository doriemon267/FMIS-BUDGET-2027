const mongoose = require("mongoose");
const PersonnelServices = require("../models/PersonnelServices");
const EmployeeMaster = require("../models/EmployeeList");
const Settings = require("../models/Settings");
const Proposal = require('../models/Proposal');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
// Import ChildrenAllowance model safely
const ChildrenAllowance =
  mongoose.models.ChildrenAllowance || require("../models/childrenAllowance");
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

    // Get filters from middleware - prioritize submission workflow filters over hierarchical filters
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    
    // Use submission workflow filters if available (they include status filtering), otherwise use hierarchical filters
    const activeFilters = Object.keys(submissionWorkflowFilters).length > 0 ? submissionWorkflowFilters : hierarchicalFilters;

    // Map hierarchical filters to database field names
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
      return mapped;
    };

    const dbFilters = mapFiltersToDb(activeFilters);

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
    let query = {
      fiscalYear: activeSettings.fiscalYear, // Strict fiscal year filter
    };

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
    // Note: Submission workflow filters are now included in activeFilters above

    // Add region filter if provided (and not already constrained by hierarchy)
    if (region) {
      if (query.$and) {
        query.$and.push({ region: region });
      } else if (!query.region) {
        query.region = region;
      }
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
        personnel.subsistenceAllowanceMDS || 0;
      const recalculatedSubsistenceAllowanceST =
        personnel.subsistenceAllowanceST || 0;
      const recalculatedLoyaltyAward = personnel.loyaltyAward || 0;
      const recalculatedOvertimePay = personnel.overtimePay || 0;
      const recalculatedAnnualSalary = personnel.monthlySalary * 12;
      const recalculatedRATA = personnel.RATA;
      const recalculatedPERA = activeSettings.PERA * 12;
      const recalculatedUniform = activeSettings.uniformAllowance;
      const recalculatedProductivityIncentive =
        activeSettings.productivityIncentive;
      const recalculatedMedical = personnel.medical || 0;
      const recalculatedMeal = personnel.meal || 0;
      const recalculatedChildrenAllowance = personnel.childrenAllowance || 0;
      const recalculatedMidyearBonus = personnel.midyearBonus || personnel.monthlySalary || 0;
      const recalculatedCashGift = activeSettings.cashGift;
      const recalculatedYearEndBonus = personnel.yearEndBonus;
      const recalculatedCourtAppearanceAmount = personnel.courtAppearance || 0;
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
      const recalculatedTerminalLeave = personnel.terminalLeave || 0;
      const recalculatedearnedLeaves = personnel.earnedLeaves || 0;
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
        recalculatedMedical +
        recalculatedMeal +
        recalculatedChildrenAllowance +
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
        medical: recalculatedMedical,
        meal: recalculatedMeal,
        childrenAllowance: recalculatedChildrenAllowance,
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
    const { statusOfAppointment, RATA, region } = req.body;

    // ⚠️ CRITICAL: Get user's assignment DIRECTLY to ensure proper filtering
    const userId = req.user.id;
    const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
    const userAssignment = await HierarchicalUserAssignment.getUserPermissions(userId);
    
    if (!userAssignment || userAssignment.assignmentLevel === 'NONE') {
      return res.status(403).json({
        message: 'No organizational assignment found. Cannot perform bulk add.',
        code: 'NO_ORG_ASSIGNMENT'
      });
    }

    // Get hierarchical filters from middleware (as backup)
    const hierarchicalFilters = req.hierarchicalFilters || {};
    // Get submission workflow data for correct org attribution
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = userAssignment.assignmentLevel || workflowData.userLevel;
    
    // Get the user's ACTUAL assigned organizational units
    const userRegion = userAssignment.regions?.[0]?.regionName || workflowData.region || req.body.region;
    const userDepartment = userAssignment.departments?.[0]?.departmentName || workflowData.department || req.body.department;
    const userDivision = userAssignment.divisions?.[0] || workflowData.division || req.body.division;
    
    const ownerRegion = userRegion;
    const ownerDepartment = userDepartment;
    const ownerDivision = userLevel === 'DEPARTMENT' ? null : userDivision;

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          // Map lowercase to database field names (uppercase first letter)
          if (condition.region) conditionMapped.Region = condition.region;
          if (condition.department) conditionMapped.Department = condition.department;
          if (condition.division) conditionMapped.Division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      // Map lowercase to database field names (uppercase first letter)
      if (filters.region) mapped.Region = filters.region;
      if (filters.department) mapped.Department = filters.department;
      if (filters.division) mapped.Division = filters.division;
      return mapped;
    };

    console.log('🔍 [BULK ADD] ==================== USER ASSIGNMENT ====================');
    console.log('🔍 [BULK ADD] User ID:', userId);
    console.log('🔍 [BULK ADD] Assignment Level:', userAssignment.assignmentLevel);
    console.log('🔍 [BULK ADD] Assigned Region:', userRegion);
    console.log('🔍 [BULK ADD] Assigned Department:', userDepartment);
    console.log('🔍 [BULK ADD] Assigned Division:', userDivision);
    console.log('🔍 [BULK ADD] =================================================================');

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

    // ⚠️ CRITICAL: Build STRICT query using DIRECT user assignment
    // This is the PRIMARY fix - no more middleware filter merging
    let employeeQuery = {
      StatusOfAppointment: statusOfAppointment,
      employeeStatus: "Active",
      fiscalYear: fiscalYear
    };

    // Apply hierarchical filtering based on user's DIRECT assignment level
    if (userRegion) {
      employeeQuery.Region = userRegion;
    }

    if (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'DIVISION') {
      if (userDepartment) {
        employeeQuery.Department = userDepartment;
      }
    }

    if (userAssignment.assignmentLevel === 'DIVISION') {
      if (userDivision) {
        employeeQuery.Division = userDivision;
        console.log('🔍 [BULK ADD] ⚠️⚠️⚠️ DIVISION LEVEL - STRICT FILTER:', userDivision);
      }
    }

    console.log('🔍 [BULK ADD] ==================== FINAL QUERY ====================');
    console.log('🔍 [BULK ADD] Employee Query:', JSON.stringify(employeeQuery, null, 2));
    console.log('🔍 [BULK ADD] Expected Division:', userDivision || 'N/A');
    console.log('🔍 [BULK ADD] ================================================================');

    // Fetch only Active employees within user's hierarchical scope
    // This will now respect the Division (Responsibility Center) or Department (Office) filters
    const employees = await EmployeeMaster.find(employeeQuery);
    
    console.log('🔍 [BULK ADD] ==================== QUERY RESULTS ====================');
    console.log('🔍 [BULK ADD] Found employees:', employees.length);
    
    // Extract unique divisions from results for verification
    const divisions = [...new Set(employees.map(emp => emp.Division).filter(Boolean))];
    const departments = [...new Set(employees.map(emp => emp.Department).filter(Boolean))];
    
    console.log('🔍 [BULK ADD] Unique Divisions in results:', divisions);
    console.log('🔍 [BULK ADD] Unique Departments in results:', departments);
    console.log('🔍 [BULK ADD] ⚠️ EXPECTED DIVISION:', userDivision);
    console.log('🔍 [BULK ADD] ⚠️ MATCH:', divisions.length === 1 && divisions[0] === userDivision ? 'YES ✓' : 'NO ✗');
    console.log('🔍 [BULK ADD] ================================================================');
    
    // Log how many employees were found
    console.log(`🔍 [BULK ADD] Found ${employees.length} employee(s) matching criteria`);
    
    // Log sample of divisions found (for debugging)
    if (employees.length > 0) {
      const divisions = [...new Set(employees.map(e => e.Division))];
      console.log(`🔍 [BULK ADD] Unique Divisions found:`, divisions);
      const departments = [...new Set(employees.map(e => e.Department))];
      console.log(`🔍 [BULK ADD] Unique Departments found:`, departments);
    }
    
    // Check if no employees found
    if (employees.length === 0) {
      const scopeInfo = userLevel === 'DIVISION' 
        ? `Division/Responsibility Center: ${ownerDivision}` 
        : userLevel === 'DEPARTMENT' 
        ? `Department/Office: ${ownerDepartment}` 
        : `Region: ${ownerRegion}`;
      
      return res.status(200).json({
        added: [],
        duplicates: [],
        message: `No active ${statusOfAppointment} employees found in your assigned scope (${scopeInfo}) for fiscal year ${fiscalYear}. Please verify that employees are properly assigned to your Office/Responsibility Center in the Employee Master List.`
      });
    }
    const personnelServicesData = [];
    const duplicates = [];
    
  for (const employee of employees) {
      let existingPersonnelService;
      
      // Check for duplicates differently based on whether it's a VACANT position
      const isVacant = employee.EmployeeFullName && 
                      employee.EmployeeFullName.toString().toUpperCase() === 'VACANT';
      
      if (isVacant) {
        // For VACANT positions, check by position details since employeeNumber might be null/empty
        const duplicateConditions = [];
        
        // Check by ItemNumber if available (most reliable)
        if (employee.ItemNumber && employee.ItemNumber.trim() !== '') {
          duplicateConditions.push({ itemNumber: employee.ItemNumber });
        }
        
        // Always include position details as fallback
        duplicateConditions.push({
          positionTitle: employee.PositionTitle,
          department: employee.Department,
          division: employee.Division || null,
          section: employee.Section || null,
          gradelevel_SG: employee.SG?.toString() || "",
          fiscalYear: fiscalYear,
          region: employee.Region,
          employeeFullName: "VACANT"
        });
        
        existingPersonnelService = await PersonnelServices.findOne({
          $or: duplicateConditions
        });
      } else {
        // For regular employees, check by employeeNumber and fiscalYear
        existingPersonnelService = await PersonnelServices.findOne({
          employeeNumber: employee.EmployeeID,
          fiscalYear: fiscalYear,
        });
      }
      
      if (existingPersonnelService) {
        const identifier = isVacant 
          ? `${employee.PositionTitle} (${employee.Department})`
          : `${employee.EmployeeFullName} (${employee.EmployeeID})`;
        
        console.log(`Skipping ${isVacant ? 'VACANT position' : 'employee'} ${identifier} - already exists in fiscal year ${fiscalYear}`);
        duplicates.push({
          employeeNumber: employee.EmployeeID || 'VACANT',
          employeeName: employee.EmployeeFullName,
          positionTitle: employee.PositionTitle,
          department: employee.Department,
          division: employee.Division,
          existingStatus: existingPersonnelService.statusOfAppointment,
          existingId: existingPersonnelService._id,
          isVacant: isVacant
        });
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
        // CRITICAL: Use the employee's ORIGINAL Department/Division/Section from db.employees
        // DO NOT replace with user's assignment - that's only for filtering!
        department: employee.Department || "",
        division: employee.Division || "",
        section: employee.Section || "",
        unit: employee.Unit || "",
        // Use the employee's ORIGINAL Region from db.employees
        region: employee.Region || "",
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
        // Submission workflow tagging - tracks WHO processed this record, NOT the employee's org assignment
        originalLevel: workflowData.originalLevel || (userLevel === 'DIVISION' ? 'DIVISION' : userLevel === 'DEPARTMENT' ? 'DEPARTMENT' : userLevel === 'REGION' ? 'REGION' : null),
        workflowLevel: workflowData.workflowLevel || (userLevel === 'DIVISION' ? 'DIVISION' : userLevel === 'DEPARTMENT' ? 'DEPARTMENT' : userLevel === 'REGION' ? 'REGION' : null),
        status: req.body.status || 'Draft',
        // Track the user's assignment for workflow purposes (NOT the employee's org)
        processorRegion: ownerRegion || null,
        processorDepartment: ownerDepartment || null,
        processorDivision: ownerDivision || null
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
      // Non-blocking: trigger Proposal totals recalculation for affected proposals using first added item's keys
      try {
        const first = addedPersonnelServices[0] || {};
        const keys = {
          fiscalYear: first.fiscalYear,
          budgetType: first.budgetType,
          region: first.region,
          processBy: first.processBy
        };
        if (keys.fiscalYear && keys.region) {
          const strictQuery = {
            fiscalYear: keys.fiscalYear,
            budgetType: keys.budgetType,
            region: keys.region,
            ...(keys.processBy ? { processBy: keys.processBy } : {})
          };
          let proposals = await Proposal.find(strictQuery).select('_id').lean();
          if (!proposals.length) {
            const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
            proposals = await Proposal.find(relaxedQuery).select('_id').lean();
          }
          if (proposals.length) {
            await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
            console.log(`🔄 [PS] Recalculated totals for ${proposals.length} proposal(s)`, keys);
          }
        }
      } catch (recErr) {
        console.warn('⚠️ [PS] Proposal totals recalculation skipped:', recErr?.message);
      }
      res.status(200).json({
        added: addedPersonnelServices,
        duplicates: duplicates,
        message: `Successfully added ${addedPersonnelServices.length} personnel services. ${duplicates.length} duplicates were skipped.`
      });
    } else {
      res.status(200).json({ 
        added: [],
        duplicates: duplicates,
        message: `No new personnel services to add. ${duplicates.length} duplicates were found.` 
      });
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

    // Get hierarchical filters from middleware
    const hierarchicalFilters = req.hierarchicalFilters || {};

    // Map hierarchical filters to database field names
    const mapFiltersToDb = (filters) => {
      const mapped = {};

      // Handle $and conditions from middleware
      if (filters.$and && Array.isArray(filters.$and)) {
        mapped.$and = filters.$and.map(condition => {
          const conditionMapped = {};
          if (condition.region) conditionMapped.region = condition.region;
          if (condition.department) conditionMapped.department = condition.department;
          if (condition.division) conditionMapped.division = condition.division;
          return conditionMapped;
        });
        return mapped;
      }

      // Handle simple key-value filters
      if (filters.region) mapped.region = filters.region;
      if (filters.department) mapped.department = filters.department;
      if (filters.division) mapped.division = filters.division;
      return mapped;
    };

    const dbHierarchicalFilters = mapFiltersToDb(hierarchicalFilters);

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

    // First, find the personnel service record to check access
    const personnelServices = await PersonnelServices.findById(id);
    if (!personnelServices) {
      return res
        .status(404)
        .json({
          message: "Personnel service not found",
          details: "No record found for the given ID",
        });
    }

    // Check if the record has been submitted and prevent editing
    const submittedStatuses = ["Submitted", "Division Submitted", "Department Verified", "Department Submitted", "Region Approved", "Finalized"];
    if (submittedStatuses.includes(personnelServices.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: "Cannot edit personnel service record that has been submitted or approved"
      });
    }

    // Check if user has access to this record based on hierarchical filters
    let hasAccess = true;
    if (Object.keys(dbHierarchicalFilters).length > 0) {
      if (dbHierarchicalFilters.$and) {
        hasAccess = dbHierarchicalFilters.$and.every(condition => {
          return Object.entries(condition).every(([key, value]) => {
            return personnelServices[key] === value;
          });
        });
      } else {
        hasAccess = Object.entries(dbHierarchicalFilters).every(([key, value]) => {
          return personnelServices[key] === value;
        });
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: "Access denied",
        message: "You don't have permission to update this personnel service record"
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
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: updatedPersonnelService?.fiscalYear,
        budgetType: updatedPersonnelService?.budgetType,
        region: updatedPersonnelService?.region,
        processBy: updatedPersonnelService?.processBy
      };
      if (keys.fiscalYear && keys.region) {
        const strictQuery = {
          fiscalYear: keys.fiscalYear,
          budgetType: keys.budgetType,
          region: keys.region,
          ...(keys.processBy ? { processBy: keys.processBy } : {})
        };
        let proposals = await Proposal.find(strictQuery).select('_id').lean();
        if (!proposals.length) {
          const relaxedQuery = { fiscalYear: keys.fiscalYear, budgetType: keys.budgetType, region: keys.region };
          proposals = await Proposal.find(relaxedQuery).select('_id').lean();
        }
        if (proposals.length) {
          await Promise.allSettled(proposals.map(p => recalculateAndSaveProposalTotals({ proposalId: p._id })));
          console.log(`🔄 [PS] Recalculated totals for ${proposals.length} proposal(s)`, keys);
        }
      }
    } catch (recErr) {
      console.warn('⚠️ [PS] Proposal totals recalculation skipped:', recErr?.message);
    }
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
    // Fetch all matching personnel services and recalculate Totals using the
    // same formulas used by the list endpoint so the grand total exactly
    // matches the per-row Total values shown in the UI.
    const personnelServices = await PersonnelServices.find(query).lean();

    const grandTotal = personnelServices.reduce((acc, personnel) => {
      const recalculatedSubsistenceAllowanceMDS = personnel.subsistenceAllowanceMDS || 0;
      const recalculatedSubsistenceAllowanceST = personnel.subsistenceAllowanceST || 0;
      const recalculatedLoyaltyAward = personnel.loyaltyAward || 0;
      const recalculatedOvertimePay = personnel.overtimePay || 0;
      const recalculatedAnnualSalary = (personnel.monthlySalary || 0) * 12;
      const recalculatedRATA = personnel.RATA || 0;
      const recalculatedPERA = (activeSettings.PERA || 0) * 12;
      const recalculatedUniform = activeSettings.uniformAllowance || 0;
      const recalculatedProductivityIncentive = activeSettings.productivityIncentive || 0;
      const recalculatedMedical = personnel.medical || 0;
      const recalculatedMeal = personnel.meal || 0;
      const recalculatedChildrenAllowance = personnel.childrenAllowance || 0;
      const recalculatedMidyearBonus = personnel.midyearBonus || personnel.monthlySalary || 0;
      const recalculatedCashGift = activeSettings.cashGift || 0;
      const recalculatedYearEndBonus = personnel.yearEndBonus || 0;
      const recalculatedCourtAppearanceAmount = personnel.courtAppearance || 0;
      const recalculatedGsis = recalculatedAnnualSalary * (activeSettings.gsisPremium || 0);
      // PhilHealth calculation (same rules as list endpoint)
      const monthlySalary = personnel.monthlySalary || 0;
      let monthlyPhilhealthPremium;
      if (monthlySalary <= 10000) {
        monthlyPhilhealthPremium = 500;
      } else if (monthlySalary >= 100000) {
        monthlyPhilhealthPremium = 5000;
      } else {
        monthlyPhilhealthPremium = monthlySalary * 0.05;
      }
      const recalculatedPhilhealth = (monthlyPhilhealthPremium * 12) / 2;
      const recalculatedPagibig = (activeSettings.pagibigPremium || 0) * 12;
      const recalculatedEmpComp = (activeSettings.employeeCompensation || 0) * 12;
      const recalculatedTerminalLeave = personnel.terminalLeave || 0;
      const recalculatedearnedLeaves = personnel.earnedLeaves || 0;

      const subtotal =
        recalculatedAnnualSalary +
        recalculatedSubsistenceAllowanceMDS +
        recalculatedSubsistenceAllowanceST +
        recalculatedLoyaltyAward +
        recalculatedOvertimePay +
        recalculatedRATA +
        recalculatedPERA +
        recalculatedUniform +
        recalculatedProductivityIncentive +
        recalculatedMedical +
        recalculatedMeal +
        recalculatedChildrenAllowance +
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
  PersonnelServices: require("../models/PersonnelServices"),
};
