const express = require('express');
const router = express.Router();
const newProposalWorkflowController = require('../controllers/newProposalWorkflowController');
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

module.exports = router;