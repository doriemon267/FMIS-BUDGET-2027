const express = require("express");
const isAuth = require('../middleware/is_auth');

const { getOverviewStats } = require("../controllers/statsController");
const { loadHierarchicalAssignment, applyHierarchicalFilters } = require('../middleware/hierarchicalAssignmentMiddleware');
const router = express.Router();
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Load hierarchical assignment for the authenticated user
router.use(loadHierarchicalAssignment);
// Get dashboard overview statistics with hierarchical filtering
router.get("/overview", applyHierarchicalFilters, getOverviewStats);
module.exports = router;
