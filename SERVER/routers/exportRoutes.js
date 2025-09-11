const express = require('express');
const router = express.Router();
const { exportBudgetSummaryPDF, exportBudgetSummaryExcel } = require('../controllers/exportController');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
// Export routes
router.post('/budget-summary-pdf', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryPDF);
router.post('/budget-summary-excel', hierarchicalAccessControl('read', { allowedFields: ['region'] }), exportBudgetSummaryExcel);
module.exports = router;