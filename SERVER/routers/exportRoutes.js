const express = require('express');
const router = express.Router();
const { exportBudgetSummaryPDF, exportBudgetSummaryExcel } = require('../controllers/exportController');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Export routes
router.post('/budget-summary-pdf', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryPDF);
router.post('/budget-summary-excel', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryExcel);
module.exports = router;
