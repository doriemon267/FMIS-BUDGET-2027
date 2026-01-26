const express = require('express');
const router = express.Router();
const mssqlSalaryTableController = require('../controllers/mssqlSalaryTableController');
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);

// List
router.get('/', mssqlSalaryTableController.list);
// Search q param
router.get('/search', mssqlSalaryTableController.search);
// Get single
router.get('/:id', mssqlSalaryTableController.getById);

module.exports = router;
