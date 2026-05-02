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
        query.$or = [{ workflowRef: workflowId }];
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

    // Fallback: unlinked records (no workflowRef) with same fiscalYear + budgetType + division
    if (proposalId && capitalOutlay.length === 0 && (req.query.fiscalYear || req.query.budgetType)) {
      const fallbackQuery = {
        $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }],
        ...(req.query.fiscalYear && { fiscalYear: req.query.fiscalYear }),
        ...(req.query.budgetType && { budgetType: req.query.budgetType }),
        ...(req.query.division && { division: req.query.division }),
      };
      const fallbackCO = await CapitalOutlay.find(fallbackQuery).populate('category', 'categoryName').lean();
      if (fallbackCO.length > 0) {
        capitalOutlay = fallbackCO;
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

