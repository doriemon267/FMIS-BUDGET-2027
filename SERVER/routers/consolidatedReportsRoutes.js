const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const consolidatedReportsController = require('../controllers/consolidatedReportsController');
const { hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Get consolidated data for reports
router.get('/consolidated-data', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getConsolidatedData);

// Get consolidated summary statistics
router.get('/consolidated-summary', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getConsolidatedSummary);

// Get available regions for consolidation
router.get('/available-regions', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.getAvailableRegions);

// Export consolidated data
router.get('/export', hierarchicalAccessControl('read', { allowedFields: ['region'] }), consolidatedReportsController.exportConsolidatedData);

module.exports = router;