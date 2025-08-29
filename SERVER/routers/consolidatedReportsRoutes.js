const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const consolidatedReportsController = require('../controllers/consolidatedReportsController');

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Get consolidated data for reports
router.get('/consolidated-data', consolidatedReportsController.getConsolidatedData);

// Get consolidated summary statistics
router.get('/consolidated-summary', consolidatedReportsController.getConsolidatedSummary);

// Get available regions for consolidation
router.get('/available-regions', consolidatedReportsController.getAvailableRegions);

// Export consolidated data
router.get('/export', consolidatedReportsController.exportConsolidatedData);

module.exports = router;