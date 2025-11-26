const express = require('express');
const router = express.Router();
const mssqlSalaryTableController = require('../controllers/mssqlSalaryTableController');
const checkToken = require('../middleware/checkToken');

// List
router.get('/', checkToken, mssqlSalaryTableController.list);
// Search q param
router.get('/search', checkToken, mssqlSalaryTableController.search);
// Get single
router.get('/:id', checkToken, mssqlSalaryTableController.getById);

module.exports = router;
