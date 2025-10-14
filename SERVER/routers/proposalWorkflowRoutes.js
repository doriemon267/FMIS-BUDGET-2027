const Router = require('express').Router;
const checkToken = require('../middleware/checkToken');
const { normalizeRoles } = require('../middleware/normalizeRoles');
const proposalWorkflowController = require('../controllers/proposalWorkflowController');

const router = Router();

// Auth for all workflow routes
router.use(checkToken);

// Normalize roles after authentication
router.use(normalizeRoles);

// Submit proposal to Budget Officer (BUDGET_ANALYST submits to BUDGET_COORDINATOR)
router.post('/submit', proposalWorkflowController.submitProposal);

// Submit proposal directly to Budget Manager (BUDGET_ANALYST only - DEPRECATED, use coordinator routes)
router.post('/submit-direct-to-manager', proposalWorkflowController.submitDirectToManager);

// === NEW COORDINATOR WORKFLOW ROUTES ===
// BUDGET_COORDINATOR approves proposal from BUDGET_ANALYST
router.post('/coordinator/approve', proposalWorkflowController.coordinatorApproveProposal);

// BUDGET_COORDINATOR returns proposal to BUDGET_ANALYST
router.post('/coordinator/return', proposalWorkflowController.coordinatorReturnProposal);

// BUDGET_COORDINATOR submits to BUDGET_OFFICER for verification
router.post('/coordinator/submit-to-officer', proposalWorkflowController.coordinatorSubmitToOfficer);

// BUDGET_COORDINATOR submits directly to BUDGET_MANAGER (bypassing officer)
router.post('/coordinator/submit-to-manager', proposalWorkflowController.coordinatorSubmitToManager);

// Verify proposal (Budget Officer only) - marks as verified without changing status
router.post('/verify', proposalWorkflowController.verifyProposal);

// Approve proposal (Budget Officer or Budget Manager)
router.post('/approve', proposalWorkflowController.approveProposal);

// Return proposal with comment (Budget Officer or Budget Manager)
router.post('/return', proposalWorkflowController.returnProposal);

// Bulk approve proposals (Budget Officer only)
router.post('/bulk-approve', proposalWorkflowController.bulkApproveProposals);

// Consolidate approved proposals into department-level proposal (Budget Officer)
router.post('/consolidate', proposalWorkflowController.consolidateProposals);

// Get proposal workflow history
router.get('/history/:proposalId', proposalWorkflowController.getProposalHistory);

module.exports = router;