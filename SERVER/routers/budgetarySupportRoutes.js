const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
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

// Get all budgetary support entries
router.get('/budgetary-support',  getAllBudgetarySupport);

// Calculate total budgetary support
router.get('/budgetary-support/calculate',  calculateBudgetarySupport);

// Get budgetary support by ID
router.get('/budgetary-support/:id',  getBudgetarySupportById);

// Create new budgetary support entry
router.post('/budgetary-support',  createBudgetarySupport);

// Update budgetary support entry
router.put('/budgetary-support/:id',  updateBudgetarySupport);

// Delete budgetary support entry
router.delete('/budgetary-support/:id',  deleteBudgetarySupport);

module.exports = router;


