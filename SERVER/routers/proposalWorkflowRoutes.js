const Router = require('express').Router;
const checkToken = require('../middleware/checkToken');
const { normalizeRoles } = require('../middleware/normalizeRoles');
const proposalWorkflowController = require('../controllers/proposalWorkflowController');

const router = Router();

// Auth for all workflow routes
router.use(checkToken);

// Normalize roles after authentication
router.use(normalizeRoles);

// Save draft progress
router.post('/draft/save', proposalWorkflowController.saveDraft);

// Submit proposal to Budget Officer (BUDGET_ANALYST submits to BUDGET_REVIEWER)
router.post('/submit', proposalWorkflowController.submitProposal);

// Validate analyst submission prerequisites without attempting submission
router.get('/submit/prerequisites/:proposalId', proposalWorkflowController.checkAnalystSubmissionPrerequisites);

// Submit proposal directly to Budget Manager (BUDGET_ANALYST only - DEPRECATED, use reviewer routes)
router.post('/submit-direct-to-manager', proposalWorkflowController.submitDirectToManager);

// === NEW REVIEWER WORKFLOW ROUTES ===
// REVIEWER approves proposal from PREPARER
router.post('/reviewer/approve', proposalWorkflowController.coordinatorApproveProposal);

// REVIEWER approves AND forwards to BUDGET_OFFICER in one action
router.post('/reviewer/approve-and-forward-to-officer', proposalWorkflowController.coordinatorApproveAndForwardToOfficer);

// REVIEWER returns proposal to PREPARER
router.post('/reviewer/return', proposalWorkflowController.coordinatorReturnProposal);

// PREPARER submits to BUDGET_OFFICER for verification
router.post('/preparer/submit-to-officer', proposalWorkflowController.coordinatorSubmitToOfficer);

// PREPARER submits directly to BUDGET_MANAGER (bypass Officer)
router.post('/preparer/submit-to-manager', proposalWorkflowController.coordinatorSubmitToManager);

// PREPARER saves edits without forwarding
router.post('/preparer/save-edits', proposalWorkflowController.coordinatorSaveEdits);

// === BUDGET OFFICER WORKFLOW ROUTES ===
// BUDGET_OFFICER approves proposal
router.post('/officer/approve', proposalWorkflowController.officerApproveProposal);

// BUDGET_OFFICER returns proposal to REVIEWER
router.post('/officer/return', proposalWorkflowController.officerReturnProposal);

// BUDGET_OFFICER submits to BUDGET_MANAGER
router.post('/officer/submit-to-manager', proposalWorkflowController.officerSubmitToManager);

// BUDGET_OFFICER saves edits without forwarding
router.post('/officer/save-edits', proposalWorkflowController.officerSaveEdits);

// === BUDGET MANAGER WORKFLOW ROUTES ===
// BUDGET_MANAGER approves proposal (final approval)
router.post('/manager/approve', proposalWorkflowController.managerApproveProposal);

// BUDGET_MANAGER returns proposal
router.post('/manager/return', proposalWorkflowController.managerReturnProposal);

// BUDGET_MANAGER saves edits without forwarding
router.post('/manager/save-edits', proposalWorkflowController.managerSaveEdits);

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