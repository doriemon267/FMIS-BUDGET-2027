// routes/fiscalYearRoutes.js
const express = require('express');
const fiscalYearrouter = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const fiscalYearController = require('../controllers/fiscalYearController');
// Apply authentication to all fiscal year routes
fiscalYearrouter.use(authMiddleware);
// Route to create a new fiscal year
fiscalYearrouter.post('/create', fiscalYearController.createFiscalYear);
// Route to fetch all fiscal years
fiscalYearrouter.get('/getfy', fiscalYearController.getFiscalYears);
module.exports = fiscalYearrouter;
