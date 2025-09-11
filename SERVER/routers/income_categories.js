const {getIncomeCategories}= require('../controllers/incomeCategoriesController');
const router =require('express').Router();
const checkToken = require("../middleware/checkToken");
const incomeCategoryRoutes=router;
incomeCategoryRoutes.use(checkToken);
incomeCategoryRoutes.get('/getAllIncomeCategories', getIncomeCategories);
module.exports=incomeCategoryRoutes;