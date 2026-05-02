const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const consolidatedCapitalOutlayController = require('../controllers/consolidatedCapitalOutlayController');

const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Test endpoint to verify routing
router.get('/test', (req, res) => {
  res.json({ message: 'Consolidated Capital Outlay routes are working!', timestamp: new Date().toISOString() });
});
// Get consolidated Capital Outlay data for reports - USE SUBMISSION WORKFLOW CONTROL
router.get('/capital-outlay-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), consolidatedCapitalOutlayController.getConsolidatedCapitalOutlayData);
// Generate Capital Outlay PDF report (inline preview)
router.get('/capital-outlay-pdf', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), consolidatedCapitalOutlayController.getConsolidatedCapitalOutlayPdf);
// Available departments and divisions for filter selectors
router.get('/capital-outlay-departments', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), consolidatedCapitalOutlayController.getAvailableDepartments);
router.get('/capital-outlay-divisions', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), consolidatedCapitalOutlayController.getAvailableDivisions);
router.get('/capital-outlay-regions', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), consolidatedCapitalOutlayController.getAvailableRegionsCapitalOutlay);
module.exports = router;

