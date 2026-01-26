const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');


const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;


const {
  getAllChartOfAccounts,
  getChartOfAccountById,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  getAccountingTitles,
  getSublineItems
} = require("../controllers/chartOfAccountsController");
// Apply authentication to all chart of accounts routes
router.use(tokenMiddleware);
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
// Get accounting titles by subline item (existing endpoint)
router.get("/accounting-titles", getAccountingTitles);
// Get subline items (existing endpoint)
router.get("/subline-items", getSublineItems);
module.exports = router;
