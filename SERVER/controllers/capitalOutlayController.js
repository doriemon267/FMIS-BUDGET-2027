const mongoose = require("mongoose");
const CapitalOutlay = require("../models/CapitalOutlay");
const ChartOfAccounts = require('../models/chartOfAccounts');
const Category = require("../models/Category");
const Settings = require("../models/Settings");
const Proposal = require('../models/Proposal');
const ProposalEditLog = require('../models/ProposalEditLog');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const { validateNonNegativeFields, validateNonNegativeInItems, CAPITAL_OUTLAY_NUMERIC_FIELDS } = require('../utils/validateNonNegative');

// Statuses that prevent Budget Preparer from editing Capital Outlay records
const LOCKED_CAPITAL_STATUSES = [
  "Forwarded to Reviewer",
  "Forwarded to Approver",
  "Forwarded to Budget Officer",
  "Forwarded to Budget Planning Analyst",
  "Forwarded to Overall Budget Approver",
  "Approver Approved",
  "Officer Approved",
  "Division Submitted",
  "Department Verified",
  "Department Submitted",
  "Region Approved",
  "Office Approved",
  "Finalized",
  "Submitted",
  // Legacy statuses
  "Forwarded to Officer",
  "Under Review by Reviewer",
  "Reviewer Approved",
  "Under Review by Officer",
  "Under Review by Manager",
  "Office",
  "Office Submitted"
];

// All Chart of Accounts entries are read straight from the FMIS main database via MONGODB_MAIN_URL.
// We intentionally avoid local file-based seeding so the data always mirrors the source system.
// Helper function to get the active fiscal year
const getActiveFiscalYear = async () => {
  const activeSettings = await Settings.findOne({ isActive: true });
  if (!activeSettings) {
    throw new Error("Active settings not found");
  }
  return activeSettings.fiscalYear;
};
// Get all capital outlays with search & pagination
exports.getAllCapitalOutlays = async (req, res) => {
  try {
    const { page = 1, search, category, orderBy, order = "asc", region, department, division } = req.query;
    let query = {};

    // --- ENHANCED USER & ORG DETECTION ---
    const user = req.user || {};
    const userId = user.id || user.userId || user._id || user.UserId;
    const userRoles = user.roles || user.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));

    let activeDept = department || req.submissionWorkflowData?.department || req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;

    // If activeDept is still missing, attempt emergency lookup from DB
    if (!activeDept && userId && !isSuperAdmin) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
          .populate('departmentId')
          .lean();
        if (assignment) {
          activeDept = assignment.departmentId?.departmentName || assignment.departmentId?.Department || assignment.departmentId?.DepartmentName;
          console.log(`[CO_FETCH_DEBUG] Emergency lookup for User ${userId}: Dept=${activeDept}`);
        }
      } catch (err) {
        console.warn(`[CO_FETCH_DEBUG] Emergency lookup failed: ${err.message}`);
      }
    }

    // Add fiscal year to the query
    try {
      query.fiscalYear = await getActiveFiscalYear();
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (search) {
      query.particulars = { $regex: search, $options: "i" };
    }
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = new mongoose.Types.ObjectId(category);
    } else {
      query.category = { $ne: null };
    }
    // Apply submission workflow filters when available; fallback to hierarchical filters
    const submissionFilters = req.submissionWorkflowFilters || {};
    const hierarchicalFilters = req.hierarchicalFilters || {};
    const activeFilters = Object.keys(submissionFilters).length > 0 ? submissionFilters : hierarchicalFilters;
    
    if (activeFilters && Object.keys(activeFilters).length > 0) {
      if (activeFilters.$and) {
        const baseQuery = { ...query };
        query = { $and: [ baseQuery, ...activeFilters.$and ] };
      } else {
        query = { ...query, ...activeFilters };
      }
    }

    // STRICT OVERRIDE: Ensure we filter by the selected department to prevent "Global" records from showing
    if (activeDept && !isSuperAdmin) {
      if (query.$and) {
        query.$and.push({ department: activeDept });
      } else {
        query.department = activeDept;
      }
    }

    if (region && !query.region) query.region = region;
    if (division && !query.division) query.division = division;

    console.log(`[CO_FETCH_FILTER] User=${userId} Dept=${activeDept} Roles=${userRoles} ->`, JSON.stringify(query, null, 2));
    const sortQuery = { [orderBy || "createdAt"]: order === "desc" ? -1 : 1 };
    const [capitalOutlays, totalRecords] = await Promise.all([
      CapitalOutlay.find(query)
        .populate({
          path: "category",
          select: "categoryName _id",
          options: { strictPopulate: false },
        })
        .sort(sortQuery)
        .skip((page - 1) * 100) // Adjust the skip value if needed
        .exec(),
      CapitalOutlay.countDocuments(query),
    ]);
    // Format the response to ensure category is properly extracted
    const formattedOutlays = capitalOutlays.map((outlay) => {
      const outlayObj = outlay.toObject();
      // Ensure category is properly formatted
      let categoryData = null;
      if (outlay.category) {
        if (typeof outlay.category === 'object') {
          categoryData = {
            _id: outlay.category._id.toString(),
            categoryName: outlay.category.categoryName,
          };
        } else {
          categoryData = {
            _id: outlay.category.toString(),
            categoryName: outlay.category.toString(),
          };
        }
      }
      return {
        ...outlayObj,
        category: categoryData,
      };
    });
    res.status(200).json({
      capitalOutlays: formattedOutlays,
      totalPages: Math.ceil(totalRecords / 100), // Adjust the totalPages calculation if needed
      currentPage: parseInt(page),
      totalRecords,
    });
  } catch (error) {
    console.error("Error fetching capital outlays:", error);
    res.status(500).json({ error: "Failed to retrieve capital outlays." });
  }
};
// Add a new capital outlay
// Add a new capital outlay
// Add a new capital outlay
exports.addCapitalOutlay = async (req, res) => {
  try {
    console.log("=== ADD CAPITAL OUTLAY ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    const {
      particulars,
      cost,
      income, // <-- Add this line
      subsidy, // Added subsidy field
      category,
      processBy,
      region,
      processDate,
      fiscalYear,
      sublineItem,
      accountingTitle,
      uacsCode,
      proposalId,  // CRITICAL: Link to specific proposal to prevent cross-proposal data mixing
    } = req.body;
    
    console.log("Extracted fields:");
    console.log("- Category:", category);
    console.log("- SublineItem:", sublineItem);
    console.log("- AccountingTitle:", accountingTitle);
    console.log("- UacsCode:", uacsCode);
    console.log("- Region:", region);
    console.log("- Income:", income);
    console.log("- Subsidy:", subsidy);
    console.log("- Cost:", cost);
    
    // ─── VALIDATION: lahat ng fields ay required ───
    if (
      cost == null ||
      !category ||
      !sublineItem ||
      !accountingTitle ||
      !uacsCode ||
      !region // Ensure region is required
    ) {
      console.error("Validation failed: Missing required fields");
      return res
        .status(400)
        .json({
          error:
            "Missing fields: cost, category, sublineItem, accountingTitle, uacsCode, and region are all required.",
        });
    }
    const nonNeg = validateNonNegativeFields({ cost, income, subsidy }, CAPITAL_OUTLAY_NUMERIC_FIELDS);
    if (!nonNeg.valid) {
      return res.status(400).json({ error: nonNeg.message });
    }
    // ─── UACS CODE VALIDATION REMOVED ───
    // Previous validation required codes starting with "5-01-" or "5-02-"
    // However, the chart_of_accounts table contains codes starting with "1-"
    // Validation removed to accept all UACS codes from chart_of_accounts
    console.log("UACS code check skipped - accepting all codes from chart_of_accounts:", uacsCode);
    
    // Fetch active settings
    console.log("Fetching active settings...");
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      console.error("Active settings not found");
      return res
        .status(400)
        .json({ error: "Active settings not found" });
    }
    console.log("Active settings found:", activeSettings.fiscalYear, activeSettings.budgetType);
    // Duplicate check before saving
    console.log("Checking for duplicates...");
    const duplicate = await CapitalOutlay.findOne({
      uacsCode,
      region,
      fiscalYear: activeSettings.fiscalYear,
      sublineItem
    });
    if (duplicate) {
      console.error("Duplicate found:", duplicate._id);
      return res.status(400).json({ error: "Duplicate entry: This Capital Outlay already exists for this region, year, and subline item." });
    }
    console.log("No duplicates found");
    
    // Normalize organizational ownership using submission workflow data
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    const ownerRegion = workflowData.region ?? req.body.region ?? region;
    const ownerDepartment = workflowData.department ?? req.body.department ?? null;
    // Clear division for department-origin records to avoid leaking into division scope
    const ownerDivision = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? null);
    
    console.log("Creating new capital outlay...");
    // Map incoming proposalId (workflow) to legacy Proposal _id
    const incomingWorkflowId = proposalId || workflowData.proposalId;
    
    // Check workflow status - prevent adding to locked proposals
    if (incomingWorkflowId) {
      const NewProposalWorkflow = require('../models/NewProposalWorkflow');
      const workflow = await NewProposalWorkflow.findById(incomingWorkflowId).select('status');
      if (workflow && LOCKED_CAPITAL_STATUSES.includes(workflow.status)) {
        return res.status(403).json({
          error: "Cannot add entries",
          message: `Cannot add capital outlay entries to proposal in '${workflow.status}' status. Only 'Draft' or 'Returned to Preparer' proposals can have new entries added.`
        });
      }
    }
    
    let legacyProposal = null;
    if (incomingWorkflowId) {
      legacyProposal = await Proposal.findOne({ workflowRef: incomingWorkflowId }).select('_id');
      if (!legacyProposal) {
        console.warn('[addCapitalOutlay] No legacy Proposal found for workflowRef:', incomingWorkflowId);
      }
    } else {
      console.warn('[addCapitalOutlay] Missing workflow proposalId in request; attempting inference');
      try {
        const inferQuery = {
          fiscalYear: activeSettings.fiscalYear.toString(),
          budgetType: activeSettings.budgetType,
          region: ownerRegion
        };
        legacyProposal = await Proposal.findOne(inferQuery).select('_id');
        if (legacyProposal) {
          console.warn('[addCapitalOutlay] Inferred legacy Proposal linkage via fiscalYear+budgetType+region:', legacyProposal._id);
        } else {
          console.warn('[addCapitalOutlay] Inference failed; entry will remain unlinked');
        }
      } catch (infErr) {
        console.warn('[addCapitalOutlay] Inference error:', infErr.message);
      }
    }

    const orgLevelFromUser =
      userLevel === 'DIVISION'
        ? 'DIVISION'
        : userLevel === 'DEPARTMENT'
          ? 'DEPARTMENT'
          : userLevel === 'REGION'
            ? 'REGION'
            : null;
    const resolvedOriginalLevel =
      workflowData.originalLevel || orgLevelFromUser || 'REGION';
    const resolvedWorkflowLevel =
      workflowData.workflowLevel || workflowData.originalLevel || orgLevelFromUser || 'BUDGET PREPARER';

    const newOutlay = new CapitalOutlay({
   
      particulars,
      cost,
      income: income || 0, // <-- Add this line
      subsidy: subsidy || 0, // Added subsidy field with default value
      category,
      processBy,
      region: ownerRegion,
      department: ownerDepartment || undefined,
      division: ownerDivision || undefined,
      processDate: new Date(),
      fiscalYear,
      budgetType: activeSettings.budgetType,
      sublineItem,
      accountingTitle,
      uacsCode,
      // Tagging for submission workflow
      originalLevel: resolvedOriginalLevel,
      workflowLevel: resolvedWorkflowLevel,
      status: req.body.status || 'Draft',
      createdBy: req.user?.id ? String(req.user.id) : undefined, // Track who created this record
      proposalId: legacyProposal ? legacyProposal._id : undefined, // Link to legacy Proposal for aggregation
      workflowRef: incomingWorkflowId ? new mongoose.Types.ObjectId(incomingWorkflowId) : undefined // Track workflow origin
    });
    
    console.log("Saving capital outlay to database...");
    await newOutlay.save();
    // Direct recompute for linked legacy proposal
    if (legacyProposal?._id) {
      try {
        const proposalDoc = await Proposal.findById(legacyProposal._id);
        await proposalDoc?.recomputeTotals();
      } catch (e) {
        console.warn('[addCapitalOutlay] recomputeTotals failed', e.message);
      }
    }
    console.log("Capital outlay saved successfully:", newOutlay._id);
    console.log("=== ADD CAPITAL OUTLAY COMPLETE ===");
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: newOutlay.fiscalYear,
        budgetType: newOutlay.budgetType,
        region: newOutlay.region,
        processBy: newOutlay.processBy
      };
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
        console.log(`🔄 [CO] Recalculated totals for ${proposals.length} proposal(s)`, keys);
      }
    } catch (recErr) {
      console.warn('⚠️ [CO] Proposal totals recalculation skipped:', recErr?.message);
    }

    return res.status(201).json({
      message: "Capital outlay added successfully",
      capitalOutlay: newOutlay
    });
  } catch (error) {
    console.error("=== ERROR ADDING CAPITAL OUTLAY ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
// Edit an existing capital outlay
exports.editCapitalOutlay = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, particulars, cost, income, subsidy, category, processBy, region, processDate, fiscalYear, status, sublineItem, accountingTitle, uacsCode } = req.body;
    // // // // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("Invalid capital outlay ID:", id);
      return res.status(400).json({ error: "Invalid capital outlay ID." });
    }
    // Validate category ID format if provided
    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      console.error("Invalid category ID:", category);
      return res.status(400).json({ error: "Invalid category ID." });
    }
    // Fetch fiscalYear and budgetType from active settings
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(400).json({ error: "Active settings not found" });
    }
    const budgetType = activeSettings.budgetType;
    // Check if the capital outlay exists
    const existingOutlay = await CapitalOutlay.findById(id);
    if (!existingOutlay) {
      console.error("Capital outlay not found for ID:", id);
      return res.status(404).json({ error: "Capital outlay not found." });
    }

    // Check if the record has been submitted and prevent editing
    if (LOCKED_CAPITAL_STATUSES.includes(existingOutlay.status)) {
      return res.status(403).json({
        error: "Update not allowed",
        message: `Cannot edit capital outlay record that has been submitted or approved (status: ${existingOutlay.status})`
      });
    }
    const nonNeg = validateNonNegativeFields({ cost, income, subsidy }, CAPITAL_OUTLAY_NUMERIC_FIELDS);
    if (!nonNeg.valid) {
      return res.status(400).json({ error: nonNeg.message });
    }
    // Update capital outlay
    // Use submission workflow data for ownership normalization
    const workflowData = req.submissionWorkflowData || {};
    const userLevel = workflowData.userLevel;
    const updRegion = workflowData.region ?? req.body.region ?? existingOutlay.region;
    const updDepartment = workflowData.department ?? req.body.department ?? existingOutlay.department;
    const updDivision = userLevel === 'DEPARTMENT' ? null : (workflowData.division ?? req.body.division ?? existingOutlay.division);

    const updatedCapitalOutlay = await CapitalOutlay.findByIdAndUpdate(
      id,
      {
        title,
        particulars,
        cost,
        income: income || 0, // <-- Add this line
        subsidy: subsidy || 0, // Added subsidy field with default value
        category,
        processBy,
        // Respect any updated organizational ownership if provided
        region: updRegion,
        department: updDepartment,
        division: updDivision,
        processDate,
        fiscalYear,
        budgetType, // Include budgetType
        status,
        sublineItem,
        accountingTitle,
        uacsCode,
        // Preserve/Apply submission workflow tagging when available
        ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
        ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
        // Preserve proposal linkage fields
        ...(existingOutlay?.proposalId ? { proposalId: existingOutlay.proposalId } : {}),
        ...(existingOutlay?.workflowRef ? { workflowRef: existingOutlay.workflowRef } : {})
      },
      { new: true, runValidators: true }
    ).populate("category"); // Ensure updated category details are returned
    // Non-blocking: trigger Proposal totals recalculation for affected proposals
    try {
      const keys = {
        fiscalYear: updatedCapitalOutlay.fiscalYear,
        budgetType: updatedCapitalOutlay.budgetType,
        region: updatedCapitalOutlay.region,
        processBy: updatedCapitalOutlay.processBy
      };
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
        console.log(`🔄 [CO] Recalculated totals for ${proposals.length} proposal(s)`, keys);
      }
    } catch (recErr) {
      console.warn('⚠️ [CO] Proposal totals recalculation skipped:', recErr?.message);
    }
      // Direct recompute for linked legacy proposal (more precise)
      if (existingOutlay?.proposalId) {
        try {
          const proposalDoc = await Proposal.findById(existingOutlay.proposalId);
          await proposalDoc?.recomputeTotals();
        } catch (e) {
          console.warn('[editCapitalOutlay] recomputeTotals failed', e.message);
        }
      }
    return res.status(200).json({
      message: "Capital outlay updated successfully.",
      capitalOutlay: updatedCapitalOutlay,
    });
  } catch (error) {
    console.error("Error updating capital outlay:", error);
    return res.status(500).json({ error: "Failed to update capital outlay." });
  }
};
// Delete a capital outlay
exports.deleteCapitalOutlay = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error("[DELETE] Invalid ObjectId:", id);
      return res.status(400).json({ error: "Invalid capital outlay ID." });
    }
    // Try to find the item first for better error reporting
    const found = await CapitalOutlay.findById(id);
    if (!found) {
      console.error("[DELETE] CapitalOutlay not found for id:", id);
      return res.status(404).json({ error: "Capital outlay not found." });
    }

    // Check if the record has been submitted and prevent deletion
    if (LOCKED_CAPITAL_STATUSES.includes(found.status)) {
      return res.status(403).json({
        error: "Delete not allowed",
        message: `Cannot delete capital outlay record that has been submitted or approved (status: ${found.status})`
      });
    }

    // Try to delete
    const deletedCapitalOutlay = await CapitalOutlay.findByIdAndDelete(id);
    if (!deletedCapitalOutlay) {
      console.error("[DELETE] Failed to delete CapitalOutlay for id:", id);
      return res.status(500).json({ error: "Failed to delete capital outlay (not found after lookup)." });
    }
    // res.status(200).json({ message: "Capital outlay deleted successfully." });
  } catch (error) {
    console.error("Error deleting capital outlay:", error);
    res.status(500).json({ error: error.message || "Failed to delete capital outlay." });
  }
};
// Fetch all capital outlay list
exports.getCapitalOutlayList = async (req, res) => {
  try {
    const { region, fiscalYear, department, division } = req.query;
    let query = {};
    
    // --- ENHANCED USER & ORG DETECTION ---
    const user = req.user || {};
    const userId = user.id || user.userId || user._id || user.UserId;
    const userRoles = user.roles || user.Roles || [];
    const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));

    let activeDept = department || req.submissionWorkflowData?.department || req.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;

    // Emergency lookup if missing
    if (!activeDept && userId && !isSuperAdmin) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const assignment = await HierarchicalUserAssignment.findOne({ userId: String(userId) })
          .populate('departmentId')
          .lean();
        if (assignment) {
          activeDept = assignment.departmentId?.departmentName || assignment.departmentId?.Department || assignment.departmentId?.DepartmentName;
        }
      } catch (_) {}
    }

    if (region) query.region = region;
    if (fiscalYear) query.fiscalYear = fiscalYear;
    if (activeDept && !isSuperAdmin) query.department = activeDept;
    if (division) query.division = division;
    
    console.log(`[CO_LIST_DEBUG] User=${userId} Dept=${activeDept} Region=${region}`);
    let capitalOutlays = await CapitalOutlay.find(query);
    
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    // RESPONSIBILITY CENTER FILTERING: Restrict visibility based on user's CURRENT organizational assignment
    const userIdString = userId ? String(userId) : undefined;
    
    const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_OFFICER', 'BUDGET OFFICER'].includes(r));
    
    if (!isSuperAdmin && !isBudgetManager && userIdString) {
      try {
        const HierarchicalUserAssignment = require('../models/HierarchicalUserAssignment');
        const userAssignment = await HierarchicalUserAssignment.findOne({ userId: userIdString })
          .populate('departmentId', 'Department DepartmentName department')
          .populate('regionId', 'Region RegionName region')
          .lean();
        
        if (userAssignment) {
          const assignedDepartment = userAssignment.departmentId?.Department || 
                                    userAssignment.departmentId?.DepartmentName ||
                                    userAssignment.departmentId?.department;
          const assignedRegion = userAssignment.regionId?.Region ||
                                userAssignment.regionId?.RegionName ||
                                userAssignment.regionId?.region;
          const assignedDivision = userAssignment.divisionName;
          
          const filteredOutlays = capitalOutlays.filter(co => {
            if (assignedDivision && ['DIVISION', 'DIVISION_LEVEL', 'RESPONSIBILITY_CENTER'].includes(userAssignment.assignmentLevel)) {
              return co.division === assignedDivision;
            }
            if (assignedDepartment && ['DEPARTMENT', 'DEPARTMENT_LEVEL', 'DEPARTMENT_REGIONAL_LEVEL', 'OFFICE', 'OFFICE_LEVEL'].includes(userAssignment.assignmentLevel)) {
              return co.department === assignedDepartment;
            }
            if (assignedRegion && ['REGION', 'REGION_LEVEL', 'BUDGET_AND_REVENUE_DIVISION'].includes(userAssignment.assignmentLevel)) {
              return co.region === assignedRegion;
            }
            if (userAssignment.assignmentLevel === 'FULL') {
              return true;
            }
            return false;
          });
          
          if (filteredOutlays.length > 0 || userAssignment.assignmentLevel !== 'FULL') {
            capitalOutlays = filteredOutlays;
          }
        }
      } catch (err) {
        console.error('[ORG_FILTER] Error in getCapitalOutlayList:', err.message);
      }
    }
    
    res.status(200).json(capitalOutlays);
  } catch (error) {
    console.error("Error fetching capital outlays:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
exports.getSublineItems = async (req, res) => {
  try {
    const { category } = req.query;
    // Fetch the category document dynamically
    const categoryDoc = await Category.findOne({ categoryName: category });
    if (!categoryDoc) {
      return res.status(404).json({ error: "Category not found." });
    }
    // Get sublineItems from the category document
    const sublineItemList = categoryDoc.sublineItems || [];
    // If category has subline items, return them directly
    // This ensures Capital Outlay categories work even if chart of accounts is not populated
    if (sublineItemList.length > 0) {
      return res.status(200).json({ sublineItems: sublineItemList });
    }
    // Fallback: Fetch matching sublineItems from ChartOfAccounts
    const fetchedSublineItems = await ChartOfAccounts.find({
      sublineItem: { $in: sublineItemList },
    }).distinct("sublineItem");
    res.status(200).json({ sublineItems: fetchedSublineItems });
  } catch (error) {
    console.error("Error fetching subline items:", error);
    res.status(500).json({ error: "Failed to retrieve subline items." });
  }
};
// Fetch accounting titles based on subline item
exports.getAccountingTitles = async (req, res) => {
  try {
    const { sublineItem } = req.query;
    // // Debugging
    // First try to get from database
    const accountingTitleDocs = await ChartOfAccounts.find({ sublineItem }).select("accountingTitle uacsCode");
    const accountingTitles = accountingTitleDocs.map((doc) => ({
      accountingTitle: doc.accountingTitle,
      uacsCode: doc.uacsCode,
    }));

    if (accountingTitles.length === 0) {
      const message = `No Chart of Accounts entries found for "${sublineItem}". Please verify the FMIS main database (MONGODB_MAIN_URL) contains the expected Chart of Accounts records.`;

      console.warn(`[CapitalOutlay] ${message}`);

      return res.status(200).json({
        accountingTitles: [],
        message,
      });
    }

    const nonCapitalOutlayCodes = accountingTitles
      .filter(({ uacsCode }) => !(typeof uacsCode === 'string' && /^(5-01|5-02)-/.test(uacsCode.trim())))
      .map(({ uacsCode }) => uacsCode)
      .filter(Boolean);

    const responsePayload = { accountingTitles };

    if (nonCapitalOutlayCodes.length > 0) {
      responsePayload.message = `Returned ${nonCapitalOutlayCodes.length} accounting title(s) whose UACS codes are outside the usual Capital Outlay prefixes (5-01 or 5-02). Review the source data if this is unexpected.`;
      console.warn(
        `[CapitalOutlay] Subline "${sublineItem}" includes non-capital-outlay UACS codes: ${nonCapitalOutlayCodes.join(", ")}`
      );
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Error fetching accounting titles:", error);
    res.status(500).json({ error: "Failed to retrieve accounting titles." });
  }
};
// deleteCapitalOutlay all records
exports.deleteAllCapitalOutlays = async (req, res) => {
  try {
    await CapitalOutlay.deleteMany({}); // Delete all records
    res.status(200).json({ message: "All capital outlays deleted successfully." });
  } catch (error) {
    console.error("Error deleting capital outlays:", error);  // Debugging
    res.status(500).json({ error: "Failed to delete capital outlays." });
  }
};

exports.bulkUpdateCapitalOutlay = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required and must not be empty" });
    }
    const nonNeg = validateNonNegativeInItems(items, CAPITAL_OUTLAY_NUMERIC_FIELDS);
    if (!nonNeg.valid) {
      return res.status(400).json({ message: nonNeg.message });
    }
    const activeSettings = await Settings.findOne({ isActive: true });
    const setFY = activeSettings?.fiscalYear;
    const setBT = activeSettings?.budgetType;
    const workflowData = req.submissionWorkflowData || {};

    const updates = [];
    const originalDbValues = new Map();
    
    for (const item of items) {
      if (!item._id) {
        return res.status(400).json({ message: "Each item must have an _id field" });
      }

      const existingCapitalOutlay = await CapitalOutlay.findById(item._id);
      if (!existingCapitalOutlay) {
        return res.status(404).json({ message: `Capital Outlay entry with ID ${item._id} not found` });
      }

      originalDbValues.set(item._id.toString(), {
        cost: existingCapitalOutlay.cost,
        amount: existingCapitalOutlay.amount,
        income: existingCapitalOutlay.income,
        subsidy: existingCapitalOutlay.subsidy,
        particulars: existingCapitalOutlay.particulars
      });

      // Check if the record has been submitted and prevent editing
      if (LOCKED_CAPITAL_STATUSES.includes(existingCapitalOutlay.status)) {
        return res.status(403).json({
          error: "Update not allowed",
          message: `Cannot edit Capital Outlay record ${item._id} that has been submitted or approved (status: ${existingCapitalOutlay.status})`
        });
      }

      updates.push(
        CapitalOutlay.findByIdAndUpdate(
          item._id,
          {
            cost: item.cost !== undefined ? item.cost : existingCapitalOutlay.cost,
            amount: item.amount !== undefined ? item.amount : existingCapitalOutlay.amount,
            income: item.income !== undefined ? item.income : existingCapitalOutlay.income,
            subsidy: item.subsidy !== undefined ? item.subsidy : existingCapitalOutlay.subsidy,
            particulars: item.particulars !== undefined ? item.particulars : existingCapitalOutlay.particulars,
            ...(setFY ? { fiscalYear: setFY } : {}),
            ...(setBT ? { budgetType: setBT } : {}),
            region: item.region !== undefined ? item.region : (workflowData.region || existingCapitalOutlay.region),
            department: item.department !== undefined ? item.department : (workflowData.department || existingCapitalOutlay.department),
            division: item.division !== undefined ? item.division : (workflowData.division || existingCapitalOutlay.division),
            processBy: item.processBy !== undefined ? item.processBy : (req.user?.userName || req.user?.id || existingCapitalOutlay.processBy),
            processDate: item.processDate !== undefined ? item.processDate : new Date(),
            status: item.status !== undefined ? item.status : (workflowData.status || existingCapitalOutlay.status),
            proposalId: item.proposalId || existingCapitalOutlay.proposalId,
            workflowRef: item.workflowRef || existingCapitalOutlay.workflowRef || workflowData.workflowRef,
            ...(workflowData.originalLevel ? { originalLevel: workflowData.originalLevel } : {}),
            ...(workflowData.workflowLevel ? { workflowLevel: workflowData.workflowLevel } : {}),
          },
          { new: true }
        )
      );
    }

    const updatedItems = await Promise.all(updates);
    
    try {
      const proposalIds = new Set();
      for (const item of updatedItems) {
        if (item.proposalId) {
          proposalIds.add(item.proposalId);
        }
      }
      
      if (proposalIds.size > 0) {
        for (const proposalId of proposalIds) {
          await recalculateAndSaveProposalTotals({ proposalId });
        }
      }
    } catch (error) {
      console.error("Error recalculating proposal totals:", error);
    }

    try {
      for (const updatedItem of updatedItems) {
        const originalDbValue = originalDbValues.get(updatedItem._id.toString());
        if (originalDbValue && updatedItem.proposalId) {
          const changes = [];
          
          if (originalDbValue.cost !== undefined && updatedItem.cost !== originalDbValue.cost) {
            changes.push({
              field: 'cost',
              oldValue: originalDbValue.cost,
              newValue: updatedItem.cost,
              valueType: 'number'
            });
          }

          if (originalDbValue.amount !== undefined && updatedItem.amount !== originalDbValue.amount) {
            changes.push({
              field: 'amount',
              oldValue: originalDbValue.amount,
              newValue: updatedItem.amount,
              valueType: 'number'
            });
          }

          if (originalDbValue.subsidy !== undefined && updatedItem.subsidy !== originalDbValue.subsidy) {
            changes.push({
              field: 'subsidy',
              oldValue: originalDbValue.subsidy,
              newValue: updatedItem.subsidy,
              valueType: 'number'
            });
          }

          if (originalDbValue.income !== undefined && updatedItem.income !== originalDbValue.income) {
            changes.push({
              field: 'income',
              oldValue: originalDbValue.income,
              newValue: updatedItem.income,
              valueType: 'number'
            });
          }

          if (changes.length > 0) {
            await ProposalEditLog.logChange({
              proposalId: updatedItem.proposalId,
              workflowRef: updatedItem.workflowRef,
              fiscalYear: updatedItem.fiscalYear,
              budgetType: updatedItem.budgetType,
              region: updatedItem.region,
              department: updatedItem.department,
              division: updatedItem.division,
              changeType: 'BULK_EDIT',
              entityType: 'CapitalOutlay',
              entityId: updatedItem._id,
              changedBy: {
                userId: req.user?.id || req.user?._id || 'SYSTEM',
                userName: [req.user?.name, req.user?.UserName, req.user?.email, `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim()].find(v => v && v.length > 0) || 'SYSTEM',
                email: req.user?.email,
                role: req.user?.Roles?.join(', ') || 'SYSTEM'
              },
              changes,
              summary: `Updated ${changes.length} field(s) in Capital Outlay entry`,
              ipAddress: req.ip,
              userAgent: req.get('user-agent')
            });
          }
        }
      }
    } catch (error) {
      console.error("Error logging Capital Outlay changes:", error);
    }

    res.status(200).json({ 
      message: "Capital Outlay entries updated successfully", 
      updatedCount: updatedItems.length,
      items: updatedItems 
    });
  } catch (error) {
    console.error("Error updating Capital Outlay entries:", error);
    res.status(500).json({ message: "Failed to update Capital Outlay entries" });
  }
};
