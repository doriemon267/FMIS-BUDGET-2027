const {
  getAllCapitalOutlays,
  addCapitalOutlay,
  editCapitalOutlay,
  deleteCapitalOutlay,
  getCapitalOutlayList,
  getSublineItems,
  getAccountingTitles,
  deleteAllCapitalOutlays,
  bulkUpdateCapitalOutlay,
} = require("../controllers/capitalOutlayController");
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkDueDateWithRoleBypass = require("../middleware/checkDueDateWithRoleBypass");
const isAuth = require("../middleware/is_auth");

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
const CapitalOutlay = require("../models/CapitalOutlay"); // New model import
const capitalOutlayRouter = Router();
// Apply authentication to all capital outlay routes
capitalOutlayRouter.use(isAuth);
capitalOutlayRouter.get("/capital-outlays", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllCapitalOutlays);
capitalOutlayRouter.post("/capital-outlays", checkDueDateWithRoleBypass, submissionWorkflowControl('create', { strictMode: false, enforceSubmissionWorkflow: true, enableConsolidation: true }), addCapitalOutlay);
capitalOutlayRouter.put("/capital-outlays/:id", checkDueDateWithRoleBypass, submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true, enableConsolidation: true }), editCapitalOutlay);
capitalOutlayRouter.delete("/capital-outlays/:id", checkDueDateWithRoleBypass, deleteCapitalOutlay);
capitalOutlayRouter.get("/capital-outlay-list", getCapitalOutlayList);
capitalOutlayRouter.get("/subline-items", getSublineItems);
capitalOutlayRouter.get("/accounting-titles", getAccountingTitles);
capitalOutlayRouter.delete("/deleteAllCapitalOutlays", deleteAllCapitalOutlays);
// Check due date status
capitalOutlayRouter.get("/due-date-status", async (req, res) => {
  try {
    const Settings = require("../models/Settings");
    const activeSettings = await Settings.findOne({ isActive: true });
    if (!activeSettings) {
      return res.status(200).json({ 
        isPastDue: true, 
        message: "No active fiscal year found." 
      });
    }
    const now = new Date();
    const dueDate = new Date(activeSettings.dueDate);
    const isPastDue = now > dueDate;
    // Check if user has admin privileges
    const userRoles = req.user?.Roles || [];
    const isAdmin = userRoles.some(role => 
      role.toUpperCase().includes('ADMIN') || 
      role.toUpperCase().includes('SUPER') ||
      role.toUpperCase().includes('SUPER ADMIN') ||
      role.toUpperCase().includes('SUPER_ADMIN')
    );
    res.status(200).json({
      isPastDue,
      dueDate: dueDate.toISOString(),
      dueDateFormatted: dueDate.toLocaleDateString("en-PH"),
      canBypassDueDate: isAdmin,
      fiscalYear: activeSettings.fiscalYear,
      budgetType: activeSettings.budgetType
    });
  } catch (error) {
    console.error("Error checking due date status:", error);
    res.status(500).json({ error: "Failed to check due date status" });
  }
});
// Route to manually seed Capital Outlay chart of accounts
capitalOutlayRouter.post("/seed-chart-of-accounts", async (req, res) => {
  res.status(410).json({
    message: "This endpoint is deprecated. Chart of Accounts data now comes directly from the FMIS main database (MONGODB_MAIN_URL). Update the source dataset there if changes are needed.",
  });
});
// Helper to resolve region to its string name from ObjectId, populated object, or string format
const resolveRegionName = async (regionInput) => {
  if (!regionInput) return '';
  
  if (typeof regionInput === 'string' && !/^[0-9a-fA-F]{24}$/.test(regionInput)) {
    return regionInput;
  }
  
  try {
    const Region = require('../models/Region');
    let regionId = regionInput;
    
    if (typeof regionInput === 'object') {
      if (regionInput.Region || regionInput.RegionName || regionInput.regionName || regionInput.region) {
        return regionInput.Region || regionInput.RegionName || regionInput.regionName || regionInput.region;
      }
      regionId = regionInput._id || regionInput.id;
    }
    
    if (regionId && require('mongoose').Types.ObjectId.isValid(regionId)) {
      const regionDoc = await Region.findById(regionId).lean();
      return regionDoc?.Region || '';
    }
  } catch (err) {
    console.warn('[resolveRegionName] Error resolving region name:', err.message);
  }
  
  return String(regionInput);
};

// Get Capital Outlay by parameters
capitalOutlayRouter.get("/capital-outlay/getByParams", submissionWorkflowControl('read'), async (req, res) => {
  try {
    const { proposalId, fiscalYear, budgetType, processBy, region, status, department, division } = req.query;
    const query = {};

    // ✅ Primary filter: if proposalId is provided, accept either legacy Proposal _id or NewProposalWorkflow _id
    if (proposalId) {
      let workflowId = proposalId;
      if (typeof proposalId === 'string' && require('mongoose').Types.ObjectId.isValid(proposalId)) {
        try {
          workflowId = new require('mongoose').Types.ObjectId(proposalId);
        } catch (_) {}
      }
      try {
        // ALWAYS check both workflowRef and proposalId for the provided ID
        // (New workflow records might use either field for the workflow ID)
        query.$or = [
          { workflowRef: workflowId },
          { proposalId: workflowId }
        ];
        
        const Proposal = require('../models/Proposal');
        const legacy = await Proposal.findOne({ workflowRef: workflowId }).select('_id').lean();
        if (legacy?._id) {
          query.$or.push({ proposalId: legacy._id });
        }
      } catch (_e) {
        query.proposalId = workflowId;
      }
    } else {
      // Fallback: use individual parameters
      if (fiscalYear) query.fiscalYear = fiscalYear;
      if (budgetType) query.budgetType = budgetType;
      if (processBy) query.processBy = processBy;
      if (region) query.region = region;
      if (status) query.status = status;
      if (department) query.department = department;
      if (division) query.division = division;
    }
    
    let capitalOutlay = await CapitalOutlay.find(query).populate('category', 'categoryName').lean();

    // ✅ ENHANCED FALLBACK: Always merge relevant unlinked records when viewing a proposal,
    // not just when linked records are missing. This ensures centralized/bulk-uploaded capital outlay 
    // (no workflowRef) shows up alongside proposal-specific entries.
    if (proposalId && (req.query.fiscalYear || req.query.budgetType)) {
      // Fetch the proposal to get its region if not provided in the request
      let proposalRegion = req.query.region;
      let proposalCreatorId = null;
      let proposalCreatedBy = null;
      let proposalFiscalYear = req.query.fiscalYear;
      let proposalBudgetType = req.query.budgetType;
      
      let resolvedRegionName = await resolveRegionName(proposalRegion);
      if (!resolvedRegionName) {
        try {
          // Check legacy Proposal first
          const Proposal = require('../models/Proposal');
          const proposal = await Proposal.findById(proposalId).select('region createdByUserId processBy fiscalYear budgetType').lean();
          if (proposal) {
            resolvedRegionName = proposal.region;
            proposalCreatorId = proposal.createdByUserId || proposal.processBy;
            proposalFiscalYear = proposalFiscalYear || String(proposal.fiscalYear || '');
            proposalBudgetType = proposalBudgetType || proposal.budgetType;
          } else {
            // Check NewProposalWorkflow if legacy not found
            const NewProposalWorkflow = require('../models/NewProposalWorkflow');
            const workflow = await NewProposalWorkflow.findById(proposalId)
              .populate('region', 'Region RegionName region')
              .lean();
            if (workflow) {
              resolvedRegionName = await resolveRegionName(workflow.region);
              proposalCreatorId = workflow.createdByUserId || workflow.processBy;
              proposalCreatedBy = workflow.createdBy;
              proposalFiscalYear = proposalFiscalYear || String(workflow.fiscalYear || '');
              proposalBudgetType = proposalBudgetType || workflow.budgetType || workflow.modelType;
            }
          }
        } catch (err) {
          console.warn('[CapitalOutlay] Failed to fetch proposal for region fallback:', err.message);
        }
      }
      proposalRegion = resolvedRegionName;

      // Build regional search array including special regions
      const searchRegions = [null, ""];
      if (proposalRegion) {
        const reg = String(proposalRegion).trim();
        searchRegions.push(reg);
        
        // Handle Region 10 / Region X equivalence
        if (reg === 'Region 10') searchRegions.push('Region X');
        if (reg === 'Region X') searchRegions.push('Region 10');
      }

      // Resilient Division/Department matching: Match if either field matches either provided value
      const orgClauses = [];
      if (req.query.division) {
        const div = String(req.query.division).trim();
        orgClauses.push({ division: div });
        orgClauses.push({ department: div });
      }
      if (req.query.department) {
        const dept = String(req.query.department).trim();
        orgClauses.push({ department: dept });
        orgClauses.push({ division: dept });
      }
      // Also include records that have NO division/department (Central/Region level capital outlay)
      orgClauses.push({ $and: [{ division: { $in: [null, ""] } }, { department: { $in: [null, ""] } }] });

      const unlinkedQuery = {
        $and: [
          { $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
          { $or: [{ proposalId: null }, { proposalId: { $exists: false } }] },
          { $or: orgClauses },
          { region: { $in: searchRegions } }
        ]
      };

      if (req.query.fiscalYear) {
        const fyNum = Number(req.query.fiscalYear);
        const fyOr = [{ fiscalYear: String(req.query.fiscalYear) }];
        if (!Number.isNaN(fyNum)) {
          fyOr.push({ fiscalYear: fyNum });
        }
        unlinkedQuery.$and.push({ $or: fyOr });
      }
      
      const finalBudgetType = req.query.budgetType || proposalBudgetType;
      if (finalBudgetType) {
        unlinkedQuery.$and.push({ budgetType: new RegExp(`^${finalBudgetType}$`, 'i') });
      }

      const unlinkedCapitalOutlay = await CapitalOutlay.find(unlinkedQuery).populate('category', 'categoryName').lean();
      
      if (unlinkedCapitalOutlay.length > 0) {
        // Merge and deduplicate by _id to avoid showing the same record twice 
        // (though unlinked records by definition shouldn't be in the first 'capitalOutlay' array)
        const existingIds = new Set(capitalOutlay.map(co => String(co._id)));
        const uniqueUnlinked = unlinkedCapitalOutlay.filter(co => !existingIds.has(String(co._id)));
        
        if (uniqueUnlinked.length > 0) {
          capitalOutlay = [...capitalOutlay, ...uniqueUnlinked];
        }
      }
    }
    
    // When proposalId is provided we're viewing a specific proposal (e.g. Proposal Details dialog).
    // Return all Capital Outlay linked to that proposal; access is already controlled by who can open the proposal.
    const isProposalContext = Boolean(proposalId);
    
    if (!isProposalContext) {
      // RESPONSIBILITY CENTER FILTERING: Only when NOT scoped to a single proposal
      const userId = req.user?.id || req.user?._id || req.user?.UserId || req.user?.userId;
      const userIdString = userId ? String(userId) : undefined;
      const userRoles = req.user?.Roles || [];
      
      const isSuperAdmin = userRoles.some(r => ['SUPER_ADMIN', 'SUPER ADMIN'].includes(r));
      const isBudgetManager = userRoles.some(r => ['BUDGET_MANAGER', 'BUDGET MANAGER', 'OVERALL_BUDGET_APPROVER'].includes(r));
      
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
            
            const filteredOutlay = capitalOutlay.filter(co => {
              if (assignedDivision && userAssignment.assignmentLevel === 'DIVISION') {
                return co.division === assignedDivision;
              }
              if (assignedDepartment && (userAssignment.assignmentLevel === 'DEPARTMENT' || userAssignment.assignmentLevel === 'OFFICE')) {
                return co.department === assignedDepartment;
              }
              if (assignedRegion && userAssignment.assignmentLevel === 'REGION') {
                return co.region === assignedRegion;
              }
              if (userAssignment.assignmentLevel === 'FULL') {
                return true;
              }
              return false;
            });
            
            capitalOutlay = filteredOutlay;
          }
        } catch (err) {
          console.error('[ORG_FILTER] Error in capital-outlay/getByParams:', err.message);
        }
      }
    }
    
    res.status(200).json(capitalOutlay);
  } catch (error) {
    console.error("Error fetching Capital Outlay by params:", error);
    res.status(500).json({ message: "Failed to fetch Capital Outlay data" });
  }
});
// Bulk update Capital Outlay entries
capitalOutlayRouter.put("/capital-outlay/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), bulkUpdateCapitalOutlay);
module.exports = capitalOutlayRouter;

