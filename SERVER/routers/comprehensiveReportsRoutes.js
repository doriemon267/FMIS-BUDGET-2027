const express = require('express');
const router = express.Router();

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings,
  getComprehensiveReportPdf
} = require('../controllers/comprehensiveReportsController');
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Routes for comprehensive reports
router.get('/comprehensive-data', getComprehensiveReportData);
router.get('/available-regions-comprehensive', getAvailableRegionsComprehensive);
router.get('/available-fiscal-years', getAvailableFiscalYears);
router.get('/available-budget-types', getAvailableBudgetTypes);
router.get('/active-settings', getActiveSettings);
router.get('/comprehensive-pdf', getComprehensiveReportPdf);
module.exports = router;