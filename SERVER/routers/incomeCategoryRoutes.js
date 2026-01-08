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
    copyCategory,
  } = require("../controllers/IncomeCategoryController");
  const Router = require("express").Router;
  const checkToken = require('../middleware/check_token');
  const incomeCategoryRouter = Router();
  // Apply authentication middleware to all routes in this router
  incomeCategoryRouter.use(checkToken);
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
  // Copy category with new name
  incomeCategoryRouter.post("/income-categories/:sourceId/copy", copyCategory);
  module.exports = incomeCategoryRouter;
