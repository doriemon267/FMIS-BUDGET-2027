const express = require('express');
const router = express.Router();
const newProposalWorkflowController = require('../controllers/newProposalWorkflowController');
const consolidationController = require('../controllers/consolidationController');
const checkToken = require('../middleware/checkToken');

// Apply authentication middleware to all routes
router.use(checkToken);

// Routes for proposal management
router.post('/proposals', newProposalWorkflowController.createProposal);
router.get('/proposals', newProposalWorkflowController.getProposals);
router.get('/proposals/my-proposals', newProposalWorkflowController.getMyProposals);
router.get('/proposals/pending-review', newProposalWorkflowController.getPendingReview);
// Specific routes with parameters must come BEFORE generic /:id routes
router.get('/proposals/:id/audit-trail', newProposalWorkflowController.getAuditTrail);
router.post('/proposals/:id/action', newProposalWorkflowController.performAction);
// Generic routes AFTER specific ones
router.get('/proposals/:id', newProposalWorkflowController.getProposalById);
router.put('/proposals/:id', newProposalWorkflowController.updateProposal);
router.delete('/proposals/:id', newProposalWorkflowController.deleteProposal);

// BRD Consolidation Routes
router.get('/consolidation/folders', consolidationController.getFolders);
router.get('/consolidation/folders/:path/proposals', consolidationController.getProposalsInFolder);
router.get('/consolidation/regions', consolidationController.getRegionStructure);
router.get('/consolidation/central-office', consolidationController.getCentralOfficeStructure);
router.get('/consolidation/summary', consolidationController.getSummary);
router.get('/consolidation/:consolidationId', consolidationController.getConsolidationRecord);
router.put('/consolidation/:consolidationId/org-info', consolidationController.updateOrganizationalInfo);

module.exports = router;