// routes/fiscalYearRoutes.js
const express = require('express');
const fiscalYearrouter = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const fiscalYearController = require('../controllers/fiscalYearController');
// Apply authentication to all fiscal year routes
fiscalYearrouter.use(tokenMiddleware);
// Route to create a new fiscal year
fiscalYearrouter.post('/create', fiscalYearController.createFiscalYear);
// Route to fetch all fiscal years
fiscalYearrouter.get('/getfy', fiscalYearController.getFiscalYears);
module.exports = fiscalYearrouter;
