const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const incomeController = require("../controllers/IncomeController");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
// Apply authentication to all income routes
router.use(tokenMiddleware);
// Create a new income entry (apply hierarchical create control, relaxed to avoid 403 during transition)
router.post("/income", submissionWorkflowControl('create', { strictMode: false, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), incomeController.createIncome);
// Bulk update income entries
router.put("/income/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), incomeController.bulkUpdateIncome);
// Update an income entry (apply hierarchical update control, strict mode for security)
router.put("/income/:id", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), incomeController.updateIncome);
// Get all income entries (apply hierarchical read control)
router.get("/income", submissionWorkflowControl('read'), incomeController.getAllIncome);
// Get income by parameters
router.get("/income/getByParams", submissionWorkflowControl('read'), incomeController.getIncomeByParams);
// Get income by ID
router.get("/income/:id", incomeController.getIncomeById);
// Delete income
router.delete("/income/:id", incomeController.deleteIncome);
// Add a test endpoint
router.get("/income/test", (req, res) => {
  res.status(200).json({ message: "Income API is working" });
});
module.exports = router;
