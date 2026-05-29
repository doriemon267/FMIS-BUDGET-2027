const express = require('express');
const router = express.Router();

const isAuth = require('../middleware/is_auth');
const { loadHierarchicalAssignment, applyHierarchicalFilters } = require('../middleware/hierarchicalAssignmentMiddleware');
const { budgetRoleVisibilityControl } = require('../middleware/budgetRoleVisibilityControl');
const myProposalsController = require('../controllers/myProposalsController');

// All Proposals list - applies auth, organizational scope, and role visibility
router.get(
	'/all',
	isAuth,
	loadHierarchicalAssignment,
	applyHierarchicalFilters,
	budgetRoleVisibilityControl(),
	myProposalsController.getAllUserBudgetItems
);

module.exports = router;
