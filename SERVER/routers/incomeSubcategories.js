const { getAllIncomeSubcategories } = require('../controllers/incomeSubcategoryController');
const router = require('express').Router();
const isAuth = require('../middleware/is_auth');

const incomeSubcategoryRoutes = router;
incomeSubcategoryRoutes.use(isAuth);
incomeSubcategoryRoutes.get('/getAllIncomeSubcategories', getAllIncomeSubcategories);
module.exports = incomeSubcategoryRoutes;

