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
  getDraftProposal
} = require("../controllers/proposalController");
const Router = require("express").Router;
const Proposal = require("../models/Proposal");
const DraftProposal = require("../models/DraftProposal");
// Import enhanced RBAC middleware
const { 
  authenticatedRoute, 
  adminRoute, 
  dueDateProtectedRoute,
  ownerOnlyRoute,
  budgetOfficerRoute,
  PERMISSION_LEVELS,
  ACCESS_SCOPE
} = require('../middleware/securityMiddleware');
const {
  proposalAccessControl,
  checkProposalOwnership,
  applyAccessFilters
} = require('../middleware/proposalAccessControl');
const {
  budgetManagerOrgSelection,
  logOrgSelection,
  validateOrgSelection
} = require('../middleware/budgetManagerOrgSelection');
const {
  budgetRoleVisibilityControl
} = require('../middleware/budgetRoleVisibilityControl');
const proposalRBACRouter = Router();
// 🔒 SECURED ROUTES WITH RBAC
// Get all proposals summary (Admin only with full access)
proposalRBACRouter.get(
  "/summary", 
  ...adminRoute(),
  getAllProposals
);
// Get all proposals (Budget Officer+ with organizational filtering)
proposalRBACRouter.get(
  "/proposals", 
  ...budgetOfficerRoute(['read']),
  budgetRoleVisibilityControl(),  // ✅ APPLY ROLE-BASED VISIBILITY FIRST
  proposalAccessControl('read'),
  applyAccessFilters(),
  getProposals
);
// Get my proposals (Authenticated users - own proposals only)
proposalRBACRouter.get(
  "/myproposals", 
  ...ownerOnlyRoute(),
  getMyProposals
);
// Get all proposals for current user including drafts (Own proposals only)
proposalRBACRouter.get(
  "/myproposals/all", 
  ...ownerOnlyRoute(),
  getAllUserProposals
);
// Get proposal details (Budget Officer+ with organizational access)
if (typeof getProposalDetails === 'function') {
  proposalRBACRouter.get(
    '/proposals/details', 
    ...budgetOfficerRoute(['read']),
    proposalAccessControl('read'),
    getProposalDetails
  );
}
// Get single proposal by ID (Budget Officer+ with ownership/organizational check)
proposalRBACRouter.get(
  "/proposals/:id", 
  ...authenticatedRoute(),
  proposalAccessControl('read'),
  getProposalById
);
// Create new proposal (Authenticated users with due date and organizational access)
// Budget Managers can select any organizational unit
proposalRBACRouter.post(
  "/proposals",
  ...dueDateProtectedRoute(PERMISSION_LEVELS.USER, ACCESS_SCOPE.REGION),
  budgetManagerOrgSelection(),
  proposalAccessControl('create'),
  logOrgSelection(),
  createProposal
);
// Update proposal (Owner or Admin with due date protection)
proposalRBACRouter.put(
  "/proposals/:id", 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.USER, ACCESS_SCOPE.REGION),
  proposalAccessControl('update'),
  checkProposalOwnership(Proposal),
  updateProposal
);
// Delete proposal (Owner or Admin with due date protection)
proposalRBACRouter.delete(
  "/proposals/:id", 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.USER, ACCESS_SCOPE.REGION),
  proposalAccessControl('delete'),
  checkProposalOwnership(Proposal),
  deleteProposal
);
// Update proposal status (Budget Officer+ only)
proposalRBACRouter.post(
  "/updateProposalStatus", 
  ...budgetOfficerRoute(['update']),
  proposalAccessControl('update'),
  updateProposalStatus
);
// Approve proposal (Budget Manager+ only)
proposalRBACRouter.put(
  "/approveProposal", 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.BUDGET_MANAGER, ACCESS_SCOPE.REGION),
  proposalAccessControl('update'),
  approveProposal
);
// Reject proposals (Budget Manager+ only)
proposalRBACRouter.put(
  "/rejectAllProposals", 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.BUDGET_MANAGER, ACCESS_SCOPE.REGION),
  proposalAccessControl('update'),
  rejectAllProposals
);
// Delete all proposals (Admin only)
proposalRBACRouter.delete(
  "/deleteAllProposals", 
  ...dueDateProtectedRoute(PERMISSION_LEVELS.SUPER_ADMIN, ACCESS_SCOPE.FULL),
  deleteAllProposals
);
// Save as draft (Authenticated users with organizational access)
proposalRBACRouter.post(
  "/saveAsDraft", 
  ...authenticatedRoute(),
  proposalAccessControl('create'),
  saveAsDraft
);
// Update missing regions (Admin only)
proposalRBACRouter.post(
  "/update-missing-regions", 
  ...adminRoute(),
  updateMissingRegions
);
// Return proposal (Budget Officer+ only)
proposalRBACRouter.post(
  "/returnProposal", 
  ...budgetOfficerRoute(['update']),
  proposalAccessControl('update'),
  returnProposal
);
// Get draft proposal by ID (Owner or Admin)
if (typeof getDraftProposal === 'function') {
  proposalRBACRouter.get(
    '/proposals/draft/:id', 
    ...authenticatedRoute(),
    checkProposalOwnership(DraftProposal),
    getDraftProposal
  );
}
// Save draft proposal (Authenticated users with organizational access)
if (typeof saveDraftProposal === 'function') {
  proposalRBACRouter.post(
    '/proposals/draft', 
    ...authenticatedRoute(),
    proposalAccessControl('create'),
    saveDraftProposal
  );
}
// Simplified proposal endpoint (Authenticated users with filtering)
proposalRBACRouter.get('/proposal-simple', 
  ...authenticatedRoute(),
  proposalAccessControl('read'),
  async (req, res) => {
    try {
      const { fiscalYear, budgetType, processBy, region } = req.query;
      if (!fiscalYear || !budgetType || !processBy || !region) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      // Apply access filters
      const accessFilters = req.accessFilters || {};
      // Check if user has access to the requested region
      if (accessFilters.region && accessFilters.region.$in && accessFilters.region.$in.length === 0) {
        return res.status(403).json({ message: "Access denied to this region" });
      }
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
  }
);
module.exports = proposalRBACRouter;
