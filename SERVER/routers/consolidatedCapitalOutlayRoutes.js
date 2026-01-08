const express = require('express');
const router = express.Router();
const consolidatedCapitalOutlayController = require('../controllers/consolidatedCapitalOutlayController');
const checkToken = require('../middleware/check_token');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Apply authentication middleware to all routes in this router
router.use(checkToken);
// Test endpoint to verify routing
router.get('/test', (req, res) => {
  res.json({ message: 'Consolidated Capital Outlay routes are working!', timestamp: new Date().toISOString() });
});
// Get consolidated Capital Outlay data for reports - USE SUBMISSION WORKFLOW CONTROL
router.get('/capital-outlay-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), consolidatedCapitalOutlayController.getConsolidatedCapitalOutlayData);
module.exports = router;
