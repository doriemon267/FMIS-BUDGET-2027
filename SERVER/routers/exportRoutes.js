const express = require('express');
const router = express.Router();
const { exportBudgetSummaryPDF, exportBudgetSummaryExcel } = require('../controllers/exportController');

// Export routes
router.post('/budget-summary-pdf', exportBudgetSummaryPDF);
router.post('/budget-summary-excel', exportBudgetSummaryExcel);

module.exports = router;
