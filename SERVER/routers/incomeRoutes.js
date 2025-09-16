const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const incomeController = require("../controllers/IncomeController");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
// Apply authentication to all income routes
router.use(checkToken);
// Create a new income entry (apply hierarchical create control, relaxed to avoid 403 during transition)
router.post("/income", submissionWorkflowControl('create', { strictMode: false, enableConsolidation: true }), incomeController.createIncome);
// Update an income entry (apply hierarchical update control, relaxed)
router.put("/income/:id", submissionWorkflowControl('update', { strictMode: false, enableConsolidation: true }), incomeController.updateIncome);
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
