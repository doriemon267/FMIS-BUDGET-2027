const express = require("express");
const router = express.Router();
// 🔒 SECURITY: Import authentication middleware
const authMiddleware = require("../middleware/authMiddleware");


const {
  getAllChartOfAccounts,
  getChartOfAccountById,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getAccountingTitles,
  getSublineItems
} = require("../controllers/chartOfAccountsController");

// 🔒 ALL ROUTES NOW REQUIRE AUTHENTICATION
router.use(authMiddleware);

// Get all chart of accounts
router.get("/chart-of-accounts", getAllChartOfAccounts);
// Get a single chart of account by ID
router.get("/chart-of-accounts/:id", getChartOfAccountById);
// Create a new chart of account
router.post("/chart-of-accounts", createChartOfAccount);
// Update a chart of account
router.put("/chart-of-accounts/:id", updateChartOfAccount);
// Delete a chart of account
router.delete("/chart-of-accounts/:id", deleteChartOfAccount);
// Get accounting titles by subline item
router.get("/accounting-titles", getAccountingTitles);
// Get subline items
router.get("/subline-items", getSublineItems);
module.exports = router;
