// routes/fiscalYearRoutes.js
const express = require('express');
const fiscalYearrouter = express.Router();
const isAuth = require('../middleware/is_auth');

const fiscalYearController = require('../controllers/fiscalYearController');
// Apply authentication to all fiscal year routes
fiscalYearrouter.use(isAuth);
// Route to create a new fiscal year
fiscalYearrouter.post('/create', fiscalYearController.createFiscalYear);
// Route to fetch all fiscal years
fiscalYearrouter.get('/getfy', fiscalYearController.getFiscalYears);
module.exports = fiscalYearrouter;

