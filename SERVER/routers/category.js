const {
  getAllCategories,
  addCategory,
  editCategory,
  deleteCategory,
  getSublineItems, // ⬅️ Import the new controller
} = require("../controllers/category_controller"); // or update path if in a different controller
const checkToken = require("../middleware/check_token");

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const Router = require("express").Router;
const categoryRouter = Router();
// Get all categories
categoryRouter.get("/categories", getAllCategories);
// Add a new category
categoryRouter.post("/categories",tokenMiddleware, addCategory);
// Edit an existing category
categoryRouter.put("/categories/:id",tokenMiddleware, editCategory);
// Delete a category
categoryRouter.delete("/categories/:id",tokenMiddleware, deleteCategory);
// ✅ Get subline items dynamically based on category name (from ChartOfAccounts)
categoryRouter.get("/categories/subline-items",tokenMiddleware, getSublineItems); // ?category=YourCategory
module.exports = categoryRouter;
