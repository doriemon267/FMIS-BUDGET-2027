const express = require('express');
const router = express.Router();

const auth = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
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
