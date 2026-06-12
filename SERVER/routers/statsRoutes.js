const express = require("express");
const isAuth = require('../middleware/is_auth');

const { getOverviewStats, cleanupCorruptedRegions } = require("../controllers/statsController");
const { loadHierarchicalAssignment, applyHierarchicalFilters } = require('../middleware/hierarchicalAssignmentMiddleware');
const { budgetRoleVisibilityControl } = require('../middleware/budgetRoleVisibilityControl');
const router = express.Router();

router.get("/cleanup", cleanupCorruptedRegions);

// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Load hierarchical assignment for the authenticated user
router.use(loadHierarchicalAssignment);
// Get dashboard overview statistics with hierarchical filtering and role visibility
router.get("/overview", applyHierarchicalFilters, budgetRoleVisibilityControl(), getOverviewStats);
module.exports = router;
