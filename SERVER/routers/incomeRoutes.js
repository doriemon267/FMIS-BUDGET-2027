const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const incomeController = require("../controllers/IncomeController");

// Apply authentication to all income routes
router.use(checkToken);

// Create a new income entry
router.post("/income", incomeController.createIncome);

// Update an income entry
router.put("/income/:id", incomeController.updateIncome);

// Get all income entries
router.get("/income", incomeController.getAllIncome);

// Get income by ID
router.get("/income/:id", incomeController.getIncomeById);

// Delete income
router.delete("/income/:id", incomeController.deleteIncome);

// Add a test endpoint
router.get("/income/test", (req, res) => {
  console.log("Income test endpoint hit");
  res.status(200).json({ message: "Income API is working" });
});

module.exports = router;
