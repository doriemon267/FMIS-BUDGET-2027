const Retiree = require("../models/Retiree");
const PersonnelService = require('../models/PersonnelServices');
const EmployeeList = require("../models/EmployeeList");
const Settings = require("../models/Settings");
/**
 * Get all retirees with pagination
 */
exports.getAllRetirees = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      fiscalYear,
      search,
      orderBy = "createdAt",
      order = "desc",
      operator = "=",
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      retirementType,
      dateOfRetirement,
      leaveDays,
      terminalLeave,
      retirementGratuity,
      total
    } = req.query;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Import utility functions
    const {
      searchFilter,
      textFilter,
      numberFilter,
      dateFilter,
    } = require("../utils/controller_get_process");

    // Build query with hierarchical filters
    const query = {};
    if (fiscalYear) query.fiscalYear = fiscalYear;
    
    // Global search
    if (search) {
      searchFilter(query, search, [
        "employeeFullName",
        "employeeNumber",
        "department",
        "positionTitle"
      ]);
    }

    // Text filters
    textFilter(query, {
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      retirementType
    });

    // Date filters
    dateFilter(query, { dateOfRetirement });

    // Number filters
    numberFilter(query, {
      leaveDays,
      terminalLeave,
      retirementGratuity,
      total
    }, operator);

    // Sorting
    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;
    const sortQuery = { [orderBy]: sortOrder };

    // Initial fetch to apply manual case-insensitive filtering if needed
    // or just use regex in the query for better performance if model is consistent
    const retirees = await Retiree.find(query).sort(sortQuery).lean();
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userId = req.user?.id || req.user?._id;
    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_OFFICER', 'BUDGET OFFICER'].includes(r));
    
    let filteredRetirees = retirees;

    if (!isSuperAdmin && !isBudgetManager && userId) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = String(userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department || '').toUpperCase().trim();
          const assignedRegion = String(userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region || '').toUpperCase().trim();
          const assignedDivision = String(userAssignment.divisionName || '').toUpperCase().trim();
          
          filteredRetirees = retirees.filter(ps => {
            const psDivision = String(ps.division || '').toUpperCase().trim();
            const psDepartment = String(ps.department || '').toUpperCase().trim();
            const psRegion = String(ps.region || '').toUpperCase().trim();

            if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
              return psDivision === assignedDivision;
            }
            if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
              return psDepartment === assignedDepartment;
            }
            if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
              return psRegion === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getAllRetirees:', err.message);
      }
    }
    
    // Apply pagination to filtered results
    const paginatedRetirees = filteredRetirees.slice(skip, skip + limitNum);
    
    res.status(200).json({
      retiree: paginatedRetirees,
      totalRecords: filteredRetirees.length,
      totalPages: Math.ceil(filteredRetirees.length / limitNum),
      currentPage: pageNum
    });
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
    const leaveDays = parseFloat(req.body.leaveDays) || 0;
    const terminalLeave = parseFloat(req.body.terminalLeave) || 0;
    const retirementGratuity = parseFloat(req.body.retirementGratuity) || 0;

    // Resolve fiscal year from body or active settings
    let usedFiscalYear = req.body.fiscalYear;
    if (!usedFiscalYear) {
      const activeSetting = await Settings.findOne({ isActive: true }).lean();
      usedFiscalYear = activeSetting?.fiscalYear;
    }

    // Convert string amounts to numbers
    const formData = {
      ...req.body,
      leaveDays,
      terminalLeave,
      retirementGratuity,
      fiscalYear: usedFiscalYear,
      total: parseFloat(req.body.total) || (terminalLeave + retirementGratuity)
    };
    const newRetiree = new Retiree(formData);
    await newRetiree.save();

    // --- Sync PersonnelServices record (same as updateRetiree) ---
    const employeeNumber = req.body.employeeNumber;
    if (employeeNumber && usedFiscalYear) {
      const personnel = await PersonnelService.findOne({ employeeNumber, fiscalYear: usedFiscalYear });
      if (personnel) {
        personnel.terminalLeave = terminalLeave;
        personnel.retirementBenefits = retirementGratuity;
        // Recalculate Total using all numeric fields
        const numericFields = [
          "annualSalary", "RATA", "PERA", "uniformALLOWANCE", "productivityIncentive",
          "medical", "meal", "cashGift", "midyearBonus", "yearEndBonus",
          "gsisPremium", "philhealthPremium", "pagibigPremium", "employeeCompensation",
          "subsistenceAllowanceMDS", "subsistenceAllowanceST", "overtimePay", "loyaltyAward",
          "earnedLeaves", "retirementBenefits", "terminalLeave", "courtAppearance",
          "hazardPay", "subsistenceAllowance", "honoraria", "childrenAllowance"
        ];
        personnel.Total = numericFields.reduce(
          (acc, field) => acc + (Number(personnel[field]) || 0),
          0
        );
        await personnel.save();
      } else {
        console.warn(`[createRetiree] No PersonnelServices record found for employeeNumber=${employeeNumber}, fiscalYear=${usedFiscalYear}`);
      }
    }

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
      leaveDays,
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
        leaveDays: Number(leaveDays) || 0,
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
    const personnel = await PersonnelService.findOne({
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
    const personnel = await PersonnelService.findOne({
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

    // RESPONSIBILITY CENTER FILTERING: Match the table logic
    const userId = req.user?.id || req.user?._id;
    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_OFFICER', 'BUDGET OFFICER'].includes(r));

    if (!isSuperAdmin && !isBudgetManager && userId) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = String(userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department || '').toUpperCase().trim();
          const assignedRegion = String(userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region || '').toUpperCase().trim();
          const assignedDivision = String(userAssignment.divisionName || '').toUpperCase().trim();

          if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
            query.division = { $regex: new RegExp(`^${assignedDivision}$`, 'i') };
          } else if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
            query.department = { $regex: new RegExp(`^${assignedDepartment}$`, 'i') };
          } else if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
            query.region = { $regex: new RegExp(`^${assignedRegion}$`, 'i') };
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getRetireeStats:', err.message);
      }
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

    // Get counts by retirement type (Case-insensitive matching)
    const compulsoryCount = await Retiree.countDocuments({ 
      ...query, 
      retirementType: { $regex: /^Compulsory$/i } 
    });
    const optionalCount = await Retiree.countDocuments({ 
      ...query, 
      retirementType: { $regex: /^Optional$/i } 
    });

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
    
    // Build filter query for organization
    const filterQuery = { fiscalYear: usedFiscalYear };
    const userId = req.user?.id || req.user?._id;
    const userRoles = req.user?.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_OFFICER', 'BUDGET OFFICER'].includes(r));

    if (!isSuperAdmin && !isBudgetManager && userId) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = String(userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department || '').toUpperCase().trim();
          const assignedRegion = String(userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region || '').toUpperCase().trim();
          const assignedDivision = String(userAssignment.divisionName || '').toUpperCase().trim();

          if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
            filterQuery.division = { $regex: new RegExp(`^${assignedDivision}$`, 'i') };
          } else if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
            filterQuery.department = { $regex: new RegExp(`^${assignedDepartment}$`, 'i') };
          } else if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
            filterQuery.region = { $regex: new RegExp(`^${assignedRegion}$`, 'i') };
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getRetireesSummary:', err.message);
      }
    }

    // Get summary for Compulsory retirements
    const compulsorySummary = await Retiree.aggregate([
      { 
        $match: { 
          ...filterQuery,
          retirementType: { $regex: /^Compulsory$/i }
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
          ...filterQuery,
          retirementType: { $regex: /^Optional$/i }
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
    const { region } = req.query;

    // --- Reference Date: December 31 of the active fiscal year ---
    // Per Philippine government budget rules, retirement eligibility is determined
    // based on the employee's age AS OF DECEMBER 31 of the budget year —
    // not today's actual date. This ensures employees who turn 60/65 later
    // this year are included in the budget proposal.
    let referenceYear = new Date().getFullYear();
    try {
      const activeSetting = await Settings.findOne({ isActive: true }).lean();
      if (activeSetting?.fiscalYear) {
        const parsed = parseInt(String(activeSetting.fiscalYear), 10);
        if (!isNaN(parsed)) referenceYear = parsed;
      }
    } catch (_) { /* fallback to current year */ }
    // December 31 of the reference year (local time, noon — avoids timezone edge cases)
    const referenceDate = new Date(referenceYear, 11, 31, 12, 0, 0);

    // Build query for active employees with an appointment date.
    // NOTE: We do NOT filter DateOfBirth in the DB query to avoid excluding
    // employees whose DateOfBirth field exists but is null/missing in older records.
    // We validate DateOfBirth in JavaScript below.
    const query = {
      // Case-insensitive match to catch "active", "ACTIVE", "Active" variants
      employeeStatus: { $regex: /^Active$/i },
      DateOfAppointment: { $exists: true, $ne: null },
    };
    
    // Apply hierarchical filters (PersonnelServices uses lowercase for org units)
    if (req.hierarchicalFilters && Object.keys(req.hierarchicalFilters).length > 0) {
      Object.assign(query, req.hierarchicalFilters);
    }

    // Add region filter if provided and not already constrained
    if (region && !query.region) {
      query.region = region;
    }

    // Get employees based on query from PersonnelServices
    const employees = await PersonnelService.find(query).lean();
    
    // Remove duplicates based on employeeNumber
    const uniqueEmployees = employees.filter((emp, index, self) => 
      index === self.findIndex(e => e.employeeNumber === emp.employeeNumber)
    );
    
    const eligible = uniqueEmployees
      .map(emp => {
        // Skip employees with missing or invalid DateOfBirth
        if (!emp.DateOfBirth) return null;
        const dob = new Date(emp.DateOfBirth);
        if (isNaN(dob.getTime())) return null; // invalid date string

        // Skip employees with missing or invalid DateOfAppointment
        const doa = new Date(emp.DateOfAppointment);
        if (isNaN(doa.getTime())) return null;
        
        // Compute age AS OF DECEMBER 31 of the fiscal year
        let age = referenceDate.getFullYear() - dob.getFullYear();
        if (
          referenceDate.getMonth() < dob.getMonth() ||
          (referenceDate.getMonth() === dob.getMonth() && referenceDate.getDate() < dob.getDate())
        ) {
          age--;
        }
        
        // Compute service years AS OF DECEMBER 31 of the fiscal year
        let serviceYears = referenceDate.getFullYear() - doa.getFullYear();
        if (
          referenceDate.getMonth() < doa.getMonth() ||
          (referenceDate.getMonth() === doa.getMonth() && referenceDate.getDate() < doa.getDate())
        ) {
          serviceYears--;
        }
        
        // Determine eligibility — strictly based on age requirement
        // Compulsory: age >= 65
        // Optional: age 60–64 AND at least 15 years of service
        let eligibleType = null;
        if (age >= 65) {
          eligibleType = "Compulsory";
        } else if (age >= 60 && age < 65 && serviceYears >= 15) {
          eligibleType = "Optional";
        }
        
        return eligibleType
          ? {
              employeeNumber: emp.employeeNumber,
              employeeFullName: emp.employeeFullName,
              positionTitle: emp.positionTitle,
              department: emp.department,
              division: emp.division,
              region: emp.region,
              dateOfBirth: emp.DateOfBirth,
              dateOfAppointment: emp.DateOfAppointment,
              earnedLeaves: emp.earnedLeaves || 0,
              annualSalary: emp.annualSalary || 0,
              monthlySalary: emp.monthlySalary || 0, // Needed for terminal leave formula
              age,
              serviceYears,
              eligibleType,
            }
          : null;
      })
      .filter(Boolean);
    res.json({ eligible, referenceDate: referenceDate.toISOString().split('T')[0], referenceYear });
  } catch (err) {
    console.error("Error in getEligibleForRetirement:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};