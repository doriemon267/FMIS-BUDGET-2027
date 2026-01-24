const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const {
  getAllBudgetarySupport,
  getBudgetarySupportById,
  createBudgetarySupport,
  updateBudgetarySupport,
  deleteBudgetarySupport,
  calculateBudgetarySupport
} = require('../controllers/budgetarySupportController');



const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Get all budgetary support entries - USE SUBMISSION WORKFLOW CONTROL
router.get('/budgetary-support', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllBudgetarySupport);
// Calculate total budgetary support - USE SUBMISSION WORKFLOW CONTROL INSTEAD OF BASIC HIERARCHICAL
router.get('/budgetary-support/calculate', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), calculateBudgetarySupport);
// Get budgetary support by ID
router.get('/budgetary-support/:id',  getBudgetarySupportById);
// Create new budgetary support entry
router.post('/budgetary-support', submissionWorkflowControl('create', { strictMode: false, enforceSubmissionWorkflow: true, enableConsolidation: true }), createBudgetarySupport);
// Update budgetary support entry
router.put('/budgetary-support/:id', submissionWorkflowControl('update', { strictMode: false, enforceSubmissionWorkflow: true, enableConsolidation: true }), updateBudgetarySupport);
// Delete budgetary support entry
router.delete('/budgetary-support/:id',  deleteBudgetarySupport);
module.exports = router;
