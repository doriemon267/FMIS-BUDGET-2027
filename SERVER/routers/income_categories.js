const {getIncomeCategories}= require('../controllers/incomeCategoriesController');
const router =require('express').Router();
const isAuth = require('../middleware/is_auth');

const incomeCategoryRoutes=router;
incomeCategoryRoutes.use(isAuth);
incomeCategoryRoutes.get('/getAllIncomeCategories', getIncomeCategories);
module.exports=incomeCategoryRoutes;
