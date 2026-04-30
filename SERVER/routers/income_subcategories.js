const { getAllIncomeSubcategories } = require('../controllers/incomeSubcategoryController');
const router = require('express').Router();
const authMiddleware = require("../middleware/authMiddleware");

const incomeSubcategoryRoutes = router;
incomeSubcategoryRoutes.use(authMiddleware);
incomeSubcategoryRoutes.get('/getAllIncomeSubcategories', getAllIncomeSubcategories);
module.exports = incomeSubcategoryRoutes;
