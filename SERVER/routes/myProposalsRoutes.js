const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const { loadHierarchicalAssignment } = require('../middleware/hierarchicalAssignmentMiddleware');
const { budgetRoleVisibilityControl } = require('../middleware/budgetRoleVisibilityControl');
const myProposalsController = require('../controllers/myProposalsController');

// All Proposals list - applies auth, organizational scope, and role visibility
router.get(
	'/all',
	auth,
	loadHierarchicalAssignment,
	budgetRoleVisibilityControl(),
	myProposalsController.getAllUserBudgetItems
);

module.exports = router;
