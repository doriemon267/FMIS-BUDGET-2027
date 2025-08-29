const express = require("express");
const router = express.Router();

// 🔒 SECURITY: Import authentication middleware
const checkToken = require('../middleware/checkToken');

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
// Get all chart of accounts
router.get("/chart-of-accounts", checkToken, getAllChartOfAccounts);

// Get a single chart of account by ID
router.get("/chart-of-accounts/:id", checkToken, getChartOfAccountById);

// Create a new chart of account
router.post("/chart-of-accounts", checkToken, createChartOfAccount);

// Update a chart of account
router.put("/chart-of-accounts/:id", checkToken, updateChartOfAccount);

// Delete a chart of account
router.delete("/chart-of-accounts/:id", checkToken, deleteChartOfAccount);

// Get accounting titles by subline item
router.get("/accounting-titles", checkToken, getAccountingTitles);

// Get subline items
router.get("/subline-items", checkToken, getSublineItems);

module.exports = router;
