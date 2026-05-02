const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const { exportBudgetSummaryPDF, exportBudgetSummaryExcel } = require('../controllers/exportController');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Export routes
router.post('/budget-summary-pdf', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryPDF);
router.post('/budget-summary-excel', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryExcel);
module.exports = router;

