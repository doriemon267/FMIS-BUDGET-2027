const { getAllIncomeSubcategories } = require('../controllers/incomeSubcategoryController');
const router = require('express').Router();
const checkToken = require("../middleware/checkToken");
const incomeSubcategoryRoutes = router;
incomeSubcategoryRoutes.use(checkToken);
incomeSubcategoryRoutes.get('/getAllIncomeSubcategories', getAllIncomeSubcategories);
module.exports = incomeSubcategoryRoutes;