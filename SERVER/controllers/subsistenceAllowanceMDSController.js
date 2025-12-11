// controllers/subsistenceAllowanceMDSController.js
const SubsistenceAllowanceMDS = require("../models/subsistenceAllowanceMDS");
const Settings = require("../models/Settings");
const PersonnelServices = require('../models/PersonnelServices');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
/**
 * Create a new Subsistence Allowance MDS record,
 * then immediately update the corresponding PersonnelServices entry.
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
      processBy,
      processDate,
      fiscalYear, // optional
      budgetType, // optional
    } = req.body;
    // 1) Get active settings (or by fiscalYear if provided)
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.subsistenceAllowanceRate) {
      return res.status(404).json({
        message:
          "Walang active settings na may subsistence allowance rate para sa fiscal year na ito.",
      });
    }
    const amount = settings.subsistenceAllowanceRate;
    const usedFiscalYear = fiscalYear || settings.fiscalYear;
    // 2) Save new SubsistenceAllowanceMDS record
    const record = new SubsistenceAllowanceMDS({
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
      budgetType: budgetType || settings.budgetType,
    });
    await record.save();
    // 3) Sync to PersonnelServices
    const personnel = await PersonnelServices.findOne({
      employeeNumber,
      employeeFullName,
      fiscalYear: usedFiscalYear,
    });
    if (personnel) {
      personnel.subsistenceAllowanceMDS = amount;
      await personnel.save();
      
      // Trigger recalculation of proposal totals
      if (personnel.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res.status(201).json({
      message:
        "Subsistence Allowance record saved and PersonnelServices updated.",
      data: record,
    });
  } catch (error) {
    console.error("❌ Error in createSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Fetch paginated SubsistenceAllowanceMDS records.
 */
exports.getAllSubsistenceAllowances = async (req, res) => {
  try {
    const { fiscalYear, page = 1, limit = 10, search, orderBy, order = "asc" } =
      req.query;
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
    // Determine fiscalYear
    let fy = fiscalYear;
    if (!fy) {
      const active = await Settings.findOne({ isActive: true }).lean();
      if (!active) return res.status(400).json({ message: "Active settings not found." });
      fy = active.fiscalYear;
    }
    query.fiscalYear = fy;
    
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      // Use the filters from the submission workflow middleware
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        // Simple key-value filters
        Object.assign(query, submissionWorkflowFilters);
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
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
    }
    // Pagination & sorting
    const skip = (page - 1) * limit;
    const sort = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
    const [records, total] = await Promise.all([
      SubsistenceAllowanceMDS.find(query).lean().skip(skip).limit(+limit).sort(sort),
      SubsistenceAllowanceMDS.countDocuments(query),
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
 * Update an existing SubsistenceAllowanceMDS record,
 * then sync the change to PersonnelServices.
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
      processBy,
      processDate,
      fiscalYear,
      budgetType,
    } = req.body;
    // Get settings
    const settings = fiscalYear
      ? await Settings.findOne({ fiscalYear, isActive: true }).lean()
      : await Settings.findOne({ isActive: true }).lean();
    if (!settings?.subsistenceAllowanceRate) {
      return res.status(404).json({
        message: "Active settings with subsistence allowance rate not found.",
      });
    }
    const amount = settings.subsistenceAllowanceRate;
    const usedFiscalYear = fiscalYear || settings.fiscalYear;
    // Update record
    const updated = await SubsistenceAllowanceMDS.findByIdAndUpdate(
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
        budgetType: budgetType || settings.budgetType,
        Amount: amount,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Record not found." });
    // Sync to PersonnelServices
    const personnel = await PersonnelServices.findOne({
      employeeNumber,
      employeeFullName,
      fiscalYear: usedFiscalYear,
    });
    if (personnel) {
      personnel.subsistenceAllowanceMDS = amount;
      await personnel.save();
      
      // Trigger recalculation of proposal totals
      if (personnel.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res.status(200).json(updated);
  } catch (error) {
    console.error("❌ Error in updateSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Delete a SubsistenceAllowanceMDS record,
 * then clear the corresponding field in PersonnelServices.
 */
exports.deleteSubsistenceAllowance = async (req, res) => {
  try {
    const { id } = req.params;
    const toDelete = await SubsistenceAllowanceMDS.findById(id);
    if (!toDelete) return res.status(404).json({ message: "Record not found." });
    // Remove the record
    await SubsistenceAllowanceMDS.findByIdAndDelete(id);
    // Sync deletion to PersonnelServices
    const personnel = await PersonnelServices.findOne({
      employeeNumber: toDelete.employeeNumber,
      fiscalYear:     toDelete.fiscalYear,
    });
    if (personnel) {
      personnel.subsistenceAllowance = 0;
      personnel.Total = Object.values(personnel.toObject()).reduce(
        (sum, v) => (typeof v === "number" ? sum + v : sum),
        0
      );
      await personnel.save();
      
      // Trigger recalculation of proposal totals
      if (personnel.proposalId) {
        try {
          await recalculateAndSaveProposalTotals({ proposalId: personnel.proposalId });
        } catch (recalcErr) {
          console.error('Error recalculating proposal totals:', recalcErr);
        }
      }
    }
    return res.status(200).json({ message: "Deleted and synced successfully." });
  } catch (error) {
    console.error("❌ Error in deleteSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
/**
 * Get sum of all subsistence allowances for the active fiscal year.
 */
exports.getSumOfSubsistenceAllowance = async (req, res) => {
  try {
    const active = await Settings.findOne({ isActive: true }).lean();
    if (!active) return res.status(400).json({ message: "Active settings not found." });
    const result = await SubsistenceAllowanceMDS.aggregate([
      { $match: { fiscalYear: active.fiscalYear } },
      { $group: { _id: null, totalAmount: { $sum: "$Amount" } } },
    ]);
    const totalAmount = result[0]?.totalAmount || 0;
    return res.status(200).json({ totalAmount });
  } catch (error) {
    console.error("❌ Error in getSumOfSubsistenceAllowance:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getAllPerServicesMDS = async (req, res) => {
  try {
    // Find the active fiscal year from settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(404).json({ error: "No active fiscal year found" });
    }
    const activeFiscalYear = activeSettings.fiscalYear;
    // Only include records with these statuses
    const statuses = ["Not Submitted", "Returned", "Drafts"];
    // Build base query
    let query = {
      fiscalYear: activeFiscalYear,
      status: { $in: statuses },
      division: "MEDICAL AND DENTAL SERVICES"
    };
    
    // Get filters from middleware - prioritize submission workflow filters over hardcoded logic
    const submissionWorkflowFilters = req.submissionWorkflowFilters || {};
    
    // Apply middleware filters if available (they include proper status filtering)
    if (Object.keys(submissionWorkflowFilters).length > 0) {
      // Use the filters from the submission workflow middleware
      if (submissionWorkflowFilters.$and || submissionWorkflowFilters.$or) {
        query = { ...query, ...submissionWorkflowFilters };
      } else {
        // Simple key-value filters
        Object.assign(query, submissionWorkflowFilters);
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      if (req.user && req.user.assignment) {
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
    }
    // Fetch personnel services for the active fiscal year and specified statuses
    // Also filter by MEDICAL AND DENTAL SERVICES division
    const personnelServices = await PersonnelServices.find(query);
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching personnel services:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// New endpoint that supports filtering by parameters including region
exports.getAllPerServicesMDSByParams = async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region, status } = req.query;
    // Find the active fiscal year from settings if not provided
    let activeFiscalYear = fiscalYear;
    if (!activeFiscalYear) {
      const activeSettings = await Settings.findOne({ isActive: true });
      if (!activeSettings) {
        return res.status(404).json({ error: "No active fiscal year found" });
      }
      activeFiscalYear = activeSettings.fiscalYear;
    }
    // Build query
    let query = { 
      fiscalYear: activeFiscalYear,
      // Always filter by MEDICAL AND DENTAL SERVICES division
      division: "MEDICAL AND DENTAL SERVICES"
    };
    // Add filters if provided
    if (budgetType) query.budgetType = budgetType;
    if (processBy) query.processBy = processBy;
    if (region) query.region = region;
    // Default status filter if not provided
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ["Not Submitted", "Returned", "Drafts"] };
    }
    // Apply hierarchical filtering based on user assignment
    if (req.user && req.user.assignment) {
      const userAssignment = req.user.assignment;
      const userLevel = req.user.level;
      const userRegion = req.user.region;
      const userDepartment = req.user.department;
      const userDivision = req.user.division;

      // Build filter based on user level
      let filterCriteria = {};

      if (userLevel === "Division") {
        // Division level: Can see their own division data
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
    // Fetch personnel services with the constructed query
    const personnelServices = await PersonnelServices.find(query).lean();
    res.status(200).json(personnelServices);
  } catch (error) {
    console.error("Error fetching MDS personnel by params:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
