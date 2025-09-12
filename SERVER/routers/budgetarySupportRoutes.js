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
// Apply authentication middleware to all routes in this router
router.use(checkToken);
// Get all budgetary support entries - USE SUBMISSION WORKFLOW CONTROL
router.get('/budgetary-support', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllBudgetarySupport);
// Calculate total budgetary support - USE SUBMISSION WORKFLOW CONTROL INSTEAD OF BASIC HIERARCHICAL
router.get('/budgetary-support/calculate', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), calculateBudgetarySupport);
// Get budgetary support by ID
router.get('/budgetary-support/:id',  getBudgetarySupportById);
// Create new budgetary support entry
router.post('/budgetary-support', hierarchicalAccessControl('create', { strictMode: false, enableConsolidation: true }), createBudgetarySupport);
// Update budgetary support entry
router.put('/budgetary-support/:id', hierarchicalAccessControl('update', { strictMode: false, enableConsolidation: true }), updateBudgetarySupport);
// Delete budgetary support entry
router.delete('/budgetary-support/:id',  deleteBudgetarySupport);
module.exports = router;
