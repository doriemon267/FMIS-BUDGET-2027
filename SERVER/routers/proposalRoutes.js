
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
const { checkProposalOwnership } = require('../middleware/proposalAccessControl');
const Proposal = require("../models/Proposal");
const DraftProposal = require("../models/DraftProposal");

const proposalRouter = Router();

// Apply authentication to all proposal routes
proposalRouter.use(checkToken);

// Load hierarchical assignments for all routes
proposalRouter.use(loadHierarchicalAssignment);

// Get all proposals summary
proposalRouter.get("/summary", applyHierarchicalFilters, getAllProposals);

// Get all proposals with hierarchical filtering
proposalRouter.get("/proposals", applyHierarchicalFilters, getProposals);

//Get all my proposals with hierarchical filtering
proposalRouter.get("/myproposals", applyHierarchicalFilters, getMyProposals);

// Get all proposals for the current user including drafts
proposalRouter.get("/myproposals/all", applyHierarchicalFilters, getAllUserProposals);

// Get proposal details - IMPORTANT: Place this BEFORE the /:id route
if (typeof getProposalDetails === 'function') {
  proposalRouter.get('/proposals/details', applyHierarchicalFilters, getProposalDetails);
}

// Get a single proposal by ID - This should come AFTER the /details route
proposalRouter.get("/proposals/:id", applyHierarchicalFilters, getProposalById);

// Add a new proposal (requires create permission)
proposalRouter.post(
  "/proposals",
  requirePermission('canCreateProposals'),
  createProposal
);

// Edit an existing proposal (requires edit permission and ownership unless canEditAllProposals)
proposalRouter.put(
  "/proposals/:id",
  requirePermission('canEditOwnProposals'),
  checkProposalOwnership(Proposal),
  updateProposal
);

// Delete a proposal (requires delete permission and ownership unless admin)
proposalRouter.delete(
  "/proposals/:id",
  requirePermission('canDeleteProposals'),
  checkProposalOwnership(Proposal),
  deleteProposal
);

// Update proposal status (requires update permission)
proposalRouter.post(
  "/updateProposalStatus",
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
proposalRouter.post("/saveAsDraft", saveAsDraft);

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
proposalRouter.post('/consolidate-proposals', consolidateProposals);

// Debug route to check database content
proposalRouter.get('/debug-proposals', debugProposals);

module.exports = proposalRouter;
