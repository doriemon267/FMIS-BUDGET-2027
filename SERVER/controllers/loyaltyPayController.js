// controllers/loyaltyPayController.js
const LoyaltyPay        = require("../models/loyaltyPay");
const Settings          = require("../models/Settings");
const PersonnelService = require('../models/PersonnelServices');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { getActiveSettingsWithCompensation } = require('../utils/settingsUtils');
const { resolveDraftWatermarkForRecords } = require('../utils/proposalPdfWatermark');
const {
  calculateLoyaltyPayYearsOfService,
  isEligibleForLoyaltyPay,
  getEligibleLoyaltyPayYear,
  calculateLoyaltyPayAmount
} = require("../utils/loyaltyPayUtils");
const { applyTableFilters } = require('../utils/controller_get_process');

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
    // 1) Get settings with compensation data
    const settings = await getActiveSettingsWithCompensation();
    if (!settings || !settings?.loyaltyPay) {
      return res.status(400).json({
        message: "Active settings with loyalty pay not found. Please configure loyalty pay in compensation settings."
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
    const person = await PersonnelService.findOne({
      employeeFullName,
      fiscalYear: usedFY,
    });
    if (person) {
      person.loyaltyAward = totalLoyalty;
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
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (fiscalYear) {
      if (query.$and) {
        query.$and.push({ fiscalYear: fiscalYear });
      } else {
        query.fiscalYear = fiscalYear;
      }
    } else {
      const active = await getActiveSettingsWithCompensation();
      if (active) {
        if (query.$and) {
          query.$and.push({ fiscalYear: active.fiscalYear });
        } else {
          query.fiscalYear = active.fiscalYear;
        }
      }
    }

    // Apply dynamic table filters
    applyTableFilters(
      query, 
      req.query, 
      ['employeeNumber', 'employeeFullName', 'positionTitle', 'department', 'division', 'region'], 
      ['yearsInService', 'amount'], 
      ['appointmentDate', 'processDate', 'createdAt', 'updatedAt'], 
      ['employeeFullName', 'positionTitle', 'department', 'division', 'region', 'processBy']
    );

    const [records, total] = await Promise.all([
      LoyaltyPay.find(query).lean().skip(skip).limit(limit).sort({ createdAt: -1 }),
      LoyaltyPay.countDocuments(query),
    ]);

    const employeeNumbers = [...new Set(records.map((record) => record.employeeNumber).filter(Boolean))];
    const fiscalYears = [...new Set(records.map((record) => String(record.fiscalYear || '')).filter(Boolean))];
    let proposalRecords = [];
    if (employeeNumbers.length > 0) {
      const personnelQuery = { employeeNumber: { $in: employeeNumbers } };
      if (fiscalYears.length > 0) {
        personnelQuery.$or = [
          { fiscalYear: { $in: fiscalYears } },
          { fiscal_year: { $in: fiscalYears.map(Number).filter(Number.isFinite) } },
        ];
      }
      proposalRecords = await PersonnelService.find(personnelQuery).lean();
    }
    const isFinalized = !(await resolveDraftWatermarkForRecords(proposalRecords, NewProposalWorkflow));

    return res.status(200).json({ 
      data: records,
      isFinalized,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total,
    });
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
    // 1) Get settings with compensation data
    const settings = await getActiveSettingsWithCompensation();
    if (!settings || !settings?.loyaltyPay) {
      return res.status(400).json({
        message: "Active settings with loyalty pay not found. Please configure loyalty pay in compensation settings."
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
    const person = await PersonnelService.findOne({
      employeeFullName: updated.employeeFullName,
      fiscalYear:     usedFY,
    });
    if (person) {
      person.loyaltyAward = totalLoyalty;
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
    const person = await PersonnelService.findOne({
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
      
      // Trigger recalculation of proposal totals
      if (person.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: person.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
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
    const { fiscalYear, region } = req.query;
    // Build query to filter by fiscal year (same logic as getAllLoyaltyPays)
    let query = {};
    if (fiscalYear) {
      query.fiscalYear = fiscalYear;
    } else {
      // Use active fiscal year from settings if not provided
      const settings = await getActiveSettingsWithCompensation();
      if (!settings) {
        return res.status(404).json({
          error: "Active settings not found",
        });
      }
      query.fiscalYear = settings.fiscalYear;
    }

    if (region) {
      query.region = { $regex: new RegExp(`^${region}$`, 'i') };
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
    
    // Get eligible employees count
    let eligibleCount = 0;
    try {
      // Get hierarchical filters from middleware
      const hierarchicalFilters = req.hierarchicalFilters || {};
      const settings = await getActiveSettingsWithCompensation();
      if (settings) {
        // Get region from hierarchical filters
        let regionFilter = '';
        if (hierarchicalFilters.$and) {
          const regionCondition = hierarchicalFilters.$and.find(cond => cond.region);
          if (regionCondition) {
            regionFilter = regionCondition.region;
          }
        } else if (hierarchicalFilters.region) {
          regionFilter = hierarchicalFilters.region;
        }
        
        if (regionFilter) {
          const { getEligibleForLoyaltyPay } = require('../controllers/employeeListController');
          // We can't call the function directly here as it requires req/res
          // Instead, we'll count eligible personnel using the same logic
          const personnelQuery = {
            employeeStatus: "Active",
            DateOfAppointment: { $exists: true, $ne: null },
            ...hierarchicalFilters
          };
          
          const personnelServices = await PersonnelService.find(personnelQuery).lean();
          const {
            calculateLoyaltyPayYearsOfService,
            getEligibleLoyaltyPayYear
          } = require("../utils/loyaltyPayUtils");
          
          const fiscalYearNum = parseInt(settings.fiscalYear);
          const cutoffDate = settings?.loyaltyPay?.cutoffDate || "06-22";
          
          for (const employee of personnelServices) {
            if (!employee.DateOfAppointment) continue;
            const yearsOfService = calculateLoyaltyPayYearsOfService(
              employee.DateOfAppointment,
              fiscalYearNum.toString(),
              cutoffDate
            );
            const eligibleYear = getEligibleLoyaltyPayYear(yearsOfService);
            if (eligibleYear !== null) {
              // Check if already received
              const existingRecord = await LoyaltyPay.findOne({
                employeeNumber: employee.employeeNumber,
                yearsInService: eligibleYear,
                fiscalYear: fiscalYearNum.toString()
              }).lean();
              if (!existingRecord) {
                eligibleCount++;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error calculating eligible count:", error);
    }
    
    const result = {
      totalRecords,
      totalAmount,
      averageAmount,
      uniqueEmployees: uniqueEmployees.length,
      eligiblePersonnel: eligibleCount
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
    const active = await getActiveSettingsWithCompensation();
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
