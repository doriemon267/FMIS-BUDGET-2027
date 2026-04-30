const {getIncomeCategories}= require('../controllers/incomeCategoriesController');
const router =require('express').Router();
const authMiddleware = require("../middleware/authMiddleware");

const incomeCategoryRoutes=router;
incomeCategoryRoutes.use(authMiddleware);
incomeCategoryRoutes.get('/getAllIncomeCategories', getIncomeCategories);
module.exports=incomeCategoryRoutes;