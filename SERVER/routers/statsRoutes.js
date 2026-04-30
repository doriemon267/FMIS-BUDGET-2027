const express = require("express");
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { getOverviewStats } = require("../controllers/statsController");
const { loadHierarchicalAssignment, applyHierarchicalFilters } = require('../middleware/hierarchicalAssignmentMiddleware');
const router = express.Router();
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Load hierarchical assignment for the authenticated user
router.use(loadHierarchicalAssignment);
// Get dashboard overview statistics with hierarchical filtering
router.get("/overview", applyHierarchicalFilters, getOverviewStats);
module.exports = router;