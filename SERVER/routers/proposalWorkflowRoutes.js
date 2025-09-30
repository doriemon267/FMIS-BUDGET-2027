const Router = require('express').Router;
const checkToken = require('../middleware/checkToken');
const proposalWorkflowController = require('../controllers/proposalWorkflowController');

const router = Router();

// Auth for all workflow routes
router.use(checkToken);

// Submit proposal to Budget Officer
router.post('/submit', proposalWorkflowController.submitProposal);

// Submit proposal directly to Budget Manager (BUDGET_ANALYST only)
router.post('/submit-direct-to-manager', proposalWorkflowController.submitDirectToManager);

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