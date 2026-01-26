const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getConsolidatedPersonnelServicesData,
  getAvailableRegions,
  getStatusOfAppointmentValues
} = require('../controllers/consolidatedPersonnelServicesController');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Routes for consolidated personnel services reports - now with submission workflow control
router.get('/personnel-services-data', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getConsolidatedPersonnelServicesData);
router.get('/available-regions-ps', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAvailableRegions);
router.get('/debug-status-values', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getStatusOfAppointmentValues);
module.exports = router;