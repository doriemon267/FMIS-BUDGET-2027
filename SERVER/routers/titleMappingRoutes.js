const express = require("express");
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getAllTitleMappings,
  getCapitalOutlayTitleMappings,
  getTitleMappingById,
  createTitleMapping,
  updateTitleMapping,
  deleteTitleMapping,
  getAvailableChartOfAccounts,
  syncFromChartOfAccounts
} = require("../controllers/titleMappingController");
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Get all title mappings
router.get("/title-mappings", getAllTitleMappings);
// Get capital outlay title mappings only
router.get("/title-mappings/capital-outlay", getCapitalOutlayTitleMappings);
// Get available chart of accounts for mapping
router.get("/title-mappings/available-accounts", getAvailableChartOfAccounts);
// Sync title mappings from chart of accounts
router.post("/title-mappings/sync", syncFromChartOfAccounts);
// Get a single title mapping by ID
router.get("/title-mappings/:id", getTitleMappingById);
// Create a new title mapping
router.post("/title-mappings", createTitleMapping);
// Update a title mapping
router.put("/title-mappings/:id", updateTitleMapping);
// Delete a title mapping
router.delete("/title-mappings/:id", deleteTitleMapping);
module.exports = router;
