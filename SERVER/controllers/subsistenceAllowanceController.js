// controllers/subsistenceAllowanceController.js
const SubsistenceAllowance = require("../models/subsistenceAllowance");
const Settings = require("../models/Settings");
const PersonnelServices = require("../models/PersonnelServices");
const { getActiveSettingsWithCompensation } = require("../utils/settingsUtils");
const { recalculateAndSaveProposalTotals } = require("../utils/recalculateProposalTotals");
const { ensurePersonnelRecordEditable, findScopedPersonnelService } = require("../utils/employeeBenefitSyncUtils");

/**
 * Helper function: Calculate PersonnelServices Total correctly
 * Sum all numeric benefit/allowance fields to get the total compensation
 */
function calculatePersonnelTotal(personnel) {
  const numericFields = [
    'annualSalary',
    'RATA',
    'PERA',
    'uniformALLOWANCE',
    'productivityIncentive',
    'medical',
    'meal',
    'cashGift',
    'midyearBonus',
    'yearEndBonus',
    'gsisPremium',
    'providentFund',
    'philhealthPremium',
    'pagibigPremium',
    'employeeCompensation',
    'subsistenceAllowanceMDS',
    'subsistenceAllowanceST',
    'overtimePay',
    'loyaltyAward',
    'earnedLeaves',
    'retirementBenefits',
    'terminalLeave',
    'courtAppearance',
    'hazardPay',
    'subsistenceAllowance',
    'additionalMedical',
    'honoraria',
    'childrenAllowance'
  ];
  return numericFields.reduce(
    (acc, field) => acc + (Number(personnel[field]) || 0),
    0
  );
}

/** Match region flexibly: DB may store "CENTRAL OFFICE" or "CENTRAL-OFFICE" */
function regionMatch(regionValue) {
  if (!regionValue || typeof regionValue !== "string") return null;
  const normalized = regionValue.trim();
  const withHyphen = normalized.replace(/\s+/g, "-");
  const withSpace = normalized.replace(/-/g, " ");
  const variants = [normalized, withHyphen, withSpace].filter(Boolean);
  return [...new Set(variants)];
}

/**
 * Create a new Subsistence Allowance record (amount from compensation monthly * 12),
 * then sync to PersonnelServices.subsistenceAllowance.
 */
exports.createSubsistenceAllowance = async (req, res) => {
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
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;

    const activeSettings = await getActiveSettingsWithCompensation({ lean: true });
    if (!activeSettings) {
      return res.status(404).json({
        message: "Walang active settings na naka-link sa compensation.",
      });
    }
    const monthlyAmount = Number(activeSettings.subsistenceAllowance) || 0;
    if (monthlyAmount <= 0) {
      return res.status(400).json({
        message:
          "Walang subsistence allowance (monthly) sa Compensation Management. Mag-set muna sa /compensation-management.",
      });
    }
    const amount = monthlyAmount * 12;
    const usedFiscalYear = fiscalYear || activeSettings.fiscalYear;
    const usedBudgetType = budgetType || activeSettings.budgetType;

    const record = new SubsistenceAllowance({
      employeeNumber,
      employeeFullName,
      positionTitle,
      department,
      division,
      region,
      Amount: amount,
      processBy,
      processDate,
      fiscalYear: usedFiscalYear,
      budgetType: usedBudgetType,
    });
    await record.save();

    const personnel = await ensurePersonnelRecordEditable(
      { employeeNumber, fiscalYear: usedFiscalYear, proposalId, workflowRef },
      "subsistence allowance"
    );
    if (personnel) {
      personnel.subsistenceAllowance = amount;
      // CRITICAL FIX: Recalculate Total after adding subsistence allowance
      personnel.Total = calculatePersonnelTotal(personnel);
      // CRITICAL FIX: Recalculate Total after updating subsistence allowance
      personnel.Total = calculatePersonnelTotal(personnel);
      await personnel.save();
      if (personnel.proposalId) {
        try {
          console.log(`🔄 [Subsistence] Triggering recalculation for proposal: ${personnel.proposalId}`);
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
          console.log(`✅ [Subsistence] Recalculation completed for proposal: ${personnel.proposalId}`);
        } catch (recalcErr) {
          console.error("❌ [Subsistence] Error recalculating proposal totals:", recalcErr);
        }
      }
    }

    return res.status(201).json({
      message: "Subsistence Allowance record saved and PersonnelServices updated.",
      data: record,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("❌ Error in createSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Bulk create multiple Subsistence Allowance records
 */
exports.bulkCreateSubsistenceAllowance = async (req, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        message: "entries must be a non-empty array",
      });
    }

    const activeSettings = await getActiveSettingsWithCompensation({ lean: true });
    if (!activeSettings) {
      return res.status(404).json({
        message: "Walang active settings na naka-link sa compensation.",
      });
    }

    const monthlyAmount = Number(activeSettings.subsistenceAllowance) || 0;
    if (monthlyAmount <= 0) {
      return res.status(400).json({
        message:
          "Walang subsistence allowance (monthly) sa Compensation Management. Mag-set muna sa /compensation-management.",
      });
    }

    const amount = monthlyAmount * 12;
    const createdRecords = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
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
          processBy,
          processDate,
          fiscalYear,
          budgetType,
        } = entries[i];

        const usedFiscalYear = fiscalYear || activeSettings.fiscalYear;
        const usedBudgetType = budgetType || activeSettings.budgetType;

        // Check for duplicates
        const existingRecord = await SubsistenceAllowance.findOne({
          employeeNumber,
          fiscalYear: usedFiscalYear,
        });

        if (existingRecord) {
          errors.push({
            index: i,
            employeeNumber,
            employeeFullName,
            message: `Employee already has subsistence allowance record for FY ${usedFiscalYear}`,
          });
          continue;
        }

        const record = new SubsistenceAllowance({
          employeeNumber,
          employeeFullName,
          positionTitle,
          department,
          division,
          region,
          Amount: amount,
          processBy,
          processDate,
          fiscalYear: usedFiscalYear,
          budgetType: usedBudgetType,
        });

        await record.save();
        createdRecords.push(record);

        // Update PersonnelServices
        const personnel = await ensurePersonnelRecordEditable(
          { employeeNumber, fiscalYear: usedFiscalYear, proposalId, workflowRef },
          "subsistence allowance"
        );

        if (personnel) {
          personnel.subsistenceAllowance = amount;
          // CRITICAL FIX: Recalculate Total after adding subsistence allowance
          personnel.Total = calculatePersonnelTotal(personnel);
          await personnel.save();
          if (personnel.proposalId) {
            try {
              await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
            } catch (recalcErr) {
              console.error("Error recalculating proposal totals:", recalcErr);
            }
          }
        }
      } catch (entryErr) {
        errors.push({
          index: i,
          message: entryErr.message,
        });
      }
    }

    return res.status(201).json({
      message: `Created ${createdRecords.length} subsistence allowance record(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`,
      created: createdRecords.length,
      total: entries.length,
      data: createdRecords,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("❌ Error in bulkCreateSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Fetch paginated Subsistence Allowance records.
 */
exports.getAllSubsistenceAllowances = async (req, res) => {
  try {
    const { fiscalYear, page = 1, limit = 10, search, orderBy, order = "asc" } = req.query;
    let query = {};
    if (search) {
      query.$or = [
        { employeeFullName: { $regex: search, $options: "i" } },
        { positionTitle: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { division: { $regex: search, $options: "i" } },
        { region: { $regex: search, $options: "i" } },
      ];
    }
    let fy = fiscalYear;
    if (!fy) {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (!active) return res.status(400).json({ message: "Active settings not found." });
      fy = active.fiscalYear;
    }
    query.fiscalYear = fy;

    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        Object.assign(query, submissionWorkflowFilters);
      }
    } else if (req.user && req.user.assignment) {
      const userLevel = req.user.level;
      const userRegion = req.user.region;
      const userDepartment = req.user.department;
      const userDivision = req.user.division;
      let filterCriteria = {};
      if (userLevel === "Division") {
        filterCriteria.division = userDivision;
        filterCriteria.department = userDepartment;
        filterCriteria.region = userRegion;
      } else if (userLevel === "Department") {
        filterCriteria.department = userDepartment;
        filterCriteria.region = userRegion;
      } else if (userLevel === "Region") {
        filterCriteria.region = userRegion;
      }
      Object.assign(query, filterCriteria);
    }

    const skip = (page - 1) * limit;
    const sort = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
    const [records, total] = await Promise.all([
      SubsistenceAllowance.find(query).lean().skip(skip).limit(+limit).sort(sort),
      SubsistenceAllowance.countDocuments(query),
    ]);
    return res.status(200).json({
      data: records,
      totalPages: Math.ceil(total / limit),
      currentPage: +page,
      totalRecords: total,
    });
  } catch (error) {
    console.error("❌ Error in getAllSubsistenceAllowances:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Update an existing Subsistence Allowance record and sync to PersonnelServices.
 */
exports.updateSubsistenceAllowance = async (req, res) => {
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
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;

    const activeSettings = await getActiveSettingsWithCompensation({ lean: true });
    if (!activeSettings) {
      return res.status(404).json({ message: "Active settings with compensation not found." });
    }
    const monthlyAmount = Number(activeSettings.subsistenceAllowance) || 0;
    const amount = monthlyAmount * 12;
    const usedFiscalYear = fiscalYear || activeSettings.fiscalYear;
    const usedBudgetType = budgetType || activeSettings.budgetType;

    const updated = await SubsistenceAllowance.findByIdAndUpdate(
      id,
      {
        employeeNumber,
        employeeFullName,
        positionTitle,
        department,
        division,
        region,
        processBy,
        processDate,
        fiscalYear: usedFiscalYear,
        budgetType: usedBudgetType,
        Amount: amount,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });

    const personnel = await ensurePersonnelRecordEditable(
      {
        employeeNumber: updated.employeeNumber,
        fiscalYear: usedFiscalYear,
        proposalId,
        workflowRef,
      },
      "subsistence allowance"
    );
    if (personnel) {
      personnel.subsistenceAllowance = amount;
      await personnel.save();
      if (personnel.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
        } catch (recalcErr) {
          console.error("Error recalculating proposal totals:", recalcErr);
        }
      }
    }
    return res.status(200).json(updated);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("❌ Error in updateSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Delete a Subsistence Allowance record and clear PersonnelServices.subsistenceAllowance.
 */
exports.deleteSubsistenceAllowance = async (req, res) => {
  try {
    const { id } = req.params;
    const toDelete = await SubsistenceAllowance.findById(id);
    if (!toDelete) return res.status(404).json({ message: "Record not found." });
    await SubsistenceAllowance.findByIdAndDelete(id);

    const personnel = await ensurePersonnelRecordEditable(
      {
        employeeNumber: toDelete.employeeNumber,
        fiscalYear: toDelete.fiscalYear,
        proposalId: toDelete.proposalId,
        workflowRef: toDelete.workflowRef,
      },
      "subsistence allowance"
    );
    if (personnel) {
      personnel.subsistenceAllowance = 0;
      await personnel.save();
      if (personnel.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
        } catch (recalcErr) {
          console.error("Error recalculating proposal totals:", recalcErr);
        }
      }
    }
    return res.status(200).json({ message: "Deleted and synced successfully." });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("❌ Error in deleteSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * Get personnel services for Subsistence Allowance page (active FY, no division filter).
 */
exports.getAllPerServicesSubsistence = async (req, res) => {
  try {
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(200).json([]);
    }
    const activeFiscalYear = activeSettings.fiscalYear;
    const statuses = ["Not Submitted", "Returned", "Drafts"];
    let query = { fiscalYear: activeFiscalYear, status: { $in: statuses } };

    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        Object.assign(query, submissionWorkflowFilters);
      }
    } else if (req.user && req.user.assignment) {
      const userLevel = req.user.level;
      const userRegion = req.user.region;
      const userDepartment = req.user.department;
      const userDivision = req.user.division;
      let filterCriteria = {};
      if (userLevel === "Division") {
        filterCriteria.division = userDivision;
        filterCriteria.department = userDepartment;
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      } else if (userLevel === "Department") {
        filterCriteria.department = userDepartment;
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      } else if (userLevel === "Region") {
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      }
      Object.assign(query, filterCriteria);
    }
    const personnelServices = await PersonnelServices.find(query);
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel for subsistence allowance:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get personnel by params (fiscalYear, budgetType, region, etc.) for Subsistence Allowance.
 */
exports.getAllPerServicesSubsistenceByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    let activeFiscalYear = fiscalYear;
    if (!activeFiscalYear) {
      const activeSettings = await Settings.findOne({ isActive: true });
      if (!activeSettings) {
        return res.status(200).json([]);
      }
      activeFiscalYear = activeSettings.fiscalYear;
    }
    let query = { fiscalYear: activeFiscalYear };
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = { $in: regionMatch(region) };
    if (status) query.status = status;
    else query.status = { $in: ["Not Submitted", "Returned", "Drafts"] };

    if (req.user && req.user.assignment) {
      const userLevel = req.user.level;
      const userRegion = req.user.region;
      const userDepartment = req.user.department;
      const userDivision = req.user.division;
      let filterCriteria = {};
      if (userLevel === "Division") {
        filterCriteria.division = userDivision;
        filterCriteria.department = userDepartment;
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      } else if (userLevel === "Department") {
        filterCriteria.department = userDepartment;
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      } else if (userLevel === "Region") {
        if (userRegion) filterCriteria.region = { $in: regionMatch(userRegion) };
      }
      Object.assign(query, filterCriteria);
    }
    const personnelServices = await PersonnelServices.find(query).lean();
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel by params for subsistence:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
