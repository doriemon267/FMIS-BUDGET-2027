const express = require('express');
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues,
  getConsolidatedPersonnelServicesPdf
} = require('../controllers/consolidatedPersonnelServicesController');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Apply authentication middleware to all routes in this router
router.use(authMiddleware);
// Routes for consolidated personnel services reports - now with submission workflow control
router.get('/personnel-services-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getConsolidatedPersonnelServicesData);
router.get('/available-regions-ps', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAvailableRegions);
router.get('/debug-status-values', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getStatusOfAppointmentValues);
router.get('/personnel-services-pdf', submissionWorkflowControl('read', { enforceSubmissionWorkflow: false }), getConsolidatedPersonnelServicesPdf);
module.exports = router;