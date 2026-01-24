const {getIncomeCategories}= require('../controllers/incomeCategoriesController');
const router =require('express').Router();
const checkToken = require("../middleware/check_token");
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const incomeCategoryRoutes=router;
incomeCategoryRoutes.use(tokenMiddleware);
incomeCategoryRoutes.get('/getAllIncomeCategories', getIncomeCategories);
module.exports=incomeCategoryRoutes;