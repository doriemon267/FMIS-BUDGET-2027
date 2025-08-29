const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings
} = require('../controllers/comprehensiveReportsController');

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Routes for comprehensive reports
router.get('/comprehensive-data', getComprehensiveReportData);
router.get('/available-regions-comprehensive', getAvailableRegionsComprehensive);
router.get('/available-fiscal-years', getAvailableFiscalYears);
router.get('/available-budget-types', getAvailableBudgetTypes);
router.get('/active-settings', getActiveSettings);

module.exports = router;