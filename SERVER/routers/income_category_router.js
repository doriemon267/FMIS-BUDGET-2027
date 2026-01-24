const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    addIncomeCategory,
    editIncomeCategory,
    deleteIncomeCategory,
    getSubcategories,
    getAllCategoriesFiltered,
  } = require("../controllers/IncomeCategoryController");
  const Router = require("express").Router;
  const checkToken = require('../middleware/check_token');
  const check_token_dev = require("../middlewares/check_token_dev");
  const check_token_prod = require("../middlewares/check_token_prod");
  const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
  const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
  
  const incomeCategoryRouter = Router();
  // Apply authentication middleware to all routes in this router
  incomeCategoryRouter.use(tokenMiddleware);
  incomeCategoryRouter.post("/income-categories/add", addIncomeCategory);
  incomeCategoryRouter.put("/income-categories/edit/:id", editIncomeCategory);
  incomeCategoryRouter.delete("/income-categories/delete/:id", deleteIncomeCategory); 
  incomeCategoryRouter.get("/income-categories/subcategories", getSubcategories);
  incomeCategoryRouter.post("/income-categories/add-subcategory/:id", addIncomeCategory);
  // Get all categories with region filtering
  incomeCategoryRouter.get("/income-categories/filtered", getAllCategoriesFiltered);
  // Get all categories
  incomeCategoryRouter.get("/income-categories", getAllCategories);
  // Get category by ID
  incomeCategoryRouter.get("/income-categories/:id", getCategoryById);
  // Create new category
  incomeCategoryRouter.post("/income-categories", createCategory);
  // Update category
  incomeCategoryRouter.put("/income-categories/:id", updateCategory);
  // Delete category
  incomeCategoryRouter.delete("/income-categories/:id", deleteCategory);
  module.exports = incomeCategoryRouter;
