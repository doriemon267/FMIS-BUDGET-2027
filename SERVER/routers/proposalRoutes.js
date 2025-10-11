
const {
  getProposals,
  createProposal,
  getProposalById,
  updateProposal,
  deleteProposal,
  updateProposalStatus,
  getAllProposals,
  approveProposal,    
  rejectAllProposals,      
  getMyProposals,
  deleteAllProposals,
  saveAsDraft,
  getAllUserProposals,
  updateMissingRegions,
  returnProposal,
  getProposalDetails,
  saveDraftProposal,
  getDraftProposal,
  consolidateProposals,
  debugProposals
} = require("../controllers/proposalController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const {
  loadHierarchicalAssignment,
  requirePermission,
  applyHierarchicalFilters
} = require('../middleware/hierarchicalAssignmentMiddleware');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { budgetRoleAccessControl } = require('../controllers/proposalWorkflowController');
const { checkProposalOwnership } = require('../middleware/proposalAccessControl');
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
const Proposal = require("../models/Proposal");
const DraftProposal = require("../models/DraftProposal");
const proposalRouter = Router();
// Apply authentication to all proposal routes
proposalRouter.use(checkToken);
// Load hierarchical assignments for all routes
proposalRouter.use(loadHierarchicalAssignment);
// Get all proposals summary (with submission workflow control)
proposalRouter.get("/summary", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), 
  budgetRoleAccessControl('read'),
  getAllProposals
);
// Get all proposals with submission workflow filtering
proposalRouter.get("/proposals", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), 
  budgetRoleAccessControl('read'),
  getProposals
);
//Get all my proposals with submission workflow filtering
// proposalRouter.get("/myproposals", 
//   submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), 
//   getMyProposals
// );
// Get all proposals for the current user including drafts
proposalRouter.get("/myproposals/all", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), 
  getAllUserProposals
);
// Get proposal details - IMPORTANT: Place this BEFORE the /:id route
if (typeof getProposalDetails === 'function') {
  proposalRouter.get('/proposals/details', 
    submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), 
    getProposalDetails
  );
}
// Get a single proposal by ID - This should come AFTER the /details route
proposalRouter.get("/proposals/:id", 
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), 
  getProposalById
);
// Add a new proposal (requires create permission, applies submission workflow)
proposalRouter.post(
  "/proposals",
  submissionWorkflowControl('create'),
  requirePermission('canCreateProposals'),
  enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }),
  createProposal
);
// Edit an existing proposal (requires edit permission and ownership unless canEditAllProposals)
proposalRouter.put(
  "/proposals/:id",
  submissionWorkflowControl('update'),
  requirePermission('canEditOwnProposals'),
  checkProposalOwnership(Proposal),
  enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }),
  updateProposal
);
// Delete a proposal (requires delete permission and ownership unless admin)
proposalRouter.delete(
  "/proposals/:id",
  submissionWorkflowControl('delete'),
  requirePermission('canDeleteProposals'),
  checkProposalOwnership(Proposal),
  deleteProposal
);
// Update proposal status (requires update permission, applies submission workflow)
proposalRouter.post(
  "/updateProposalStatus",
  submissionWorkflowControl('update'),
  requirePermission('canEditOwnProposals'),
  updateProposalStatus
);
// Approve a proposal (requires canApproveProposals)
proposalRouter.put(
  "/approveProposal",
  requirePermission('canApproveProposals'),
  approveProposal
);
// Reject a proposal
proposalRouter.put("/rejectAllProposals", rejectAllProposals);
// Delete all proposals
proposalRouter.delete("/deleteAllProposals", deleteAllProposals);
// Save as Draft
proposalRouter.post(
  "/saveAsDraft",
  submissionWorkflowControl('update'),
  requirePermission('canEditOwnProposals'),
  saveAsDraft
);
// Add this new route
proposalRouter.post("/update-missing-regions", updateMissingRegions);
// Return a proposal
proposalRouter.post("/returnProposal", returnProposal);
// Add a simplified fallback endpoint
proposalRouter.get('/proposal-simple', async (req, res) => {
  try {
    const { fiscalYear, budgetType, processBy, region } = req.query;
    if (!fiscalYear || !budgetType || !processBy || !region) {
      return res.status(400).json({ message: "Missing required parameters" });
    }
    // Return basic information without database query
    const basicProposal = {
      fiscalYear,
      budgetType,
      processBy,
      region,
      cobExpenditures: "Unknown",
      status: "Unknown",
      submittedDate: null
    };
    res.status(200).json(basicProposal);
  } catch (error) {
    console.error("Error in simplified endpoint:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// Get draft proposal by ID
if (typeof getDraftProposal === 'function') {
  proposalRouter.get('/proposals/draft/:id', getDraftProposal);
}
// Add route to save draft proposals
if (typeof saveDraftProposal === 'function') {
  proposalRouter.post('/proposals/draft', saveDraftProposal);
}
// Manual consolidation route for fixing missing proposals
proposalRouter.post('/consolidate-proposals', applyHierarchicalFilters, consolidateProposals);
// Auto-consolidate Draft items into Proposals
const { consolidateAllDrafts } = require('../utils/autoConsolidateDrafts');
proposalRouter.post('/consolidate-drafts', async (req, res) => {
  try {
    const results = await consolidateAllDrafts();
    res.status(200).json({
      success: true,
      message: `Consolidated ${results.length} Draft proposals`,
      proposals: results
    });
  } catch (error) {
    console.error('Error consolidating drafts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to consolidate drafts',
      error: error.message
    });
  }
});
// Debug route to check database content
proposalRouter.get('/debug-proposals', debugProposals);
module.exports = proposalRouter;
