const { getAllIncomeSubcategories } = require('../controllers/incomeSubcategoryController');
const router = require('express').Router();
const checkToken = require("../middleware/check_token");
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const incomeSubcategoryRoutes = router;
incomeSubcategoryRoutes.use(tokenMiddleware);
incomeSubcategoryRoutes.get('/getAllIncomeSubcategories', getAllIncomeSubcategories);
module.exports = incomeSubcategoryRoutes;
