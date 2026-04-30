const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const consolidatedReportsController = require('../controllers/consolidatedReportsController');
const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Get consolidated data for reports
router.get('/consolidated-data', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getConsolidatedData);
// Get consolidated summary statistics
router.get('/consolidated-summary', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getConsolidatedSummary);
// Get available regions for consolidation
router.get('/available-regions', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getAvailableRegions);
// Generate consolidated MOOE PDF report (inline preview)
router.get('/consolidated-data-pdf', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getConsolidatedMooePdf);
// Export consolidated data
router.get('/export', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.exportConsolidatedData);
module.exports = router;