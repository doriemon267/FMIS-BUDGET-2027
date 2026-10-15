const {
  getAllCategories,
  addCategory,
  editCategory,
  deleteCategory,
  getSublineItems, // ⬅️ Import the new controller
} = require("../controllers/category_controller"); // or update path if in a different controller
const isAuth = require('../middleware/is_auth');

const Router = require("express").Router;
const categoryRouter = Router();
// Get all categories
categoryRouter.get("/categories", getAllCategories);
// Add a new category
categoryRouter.post("/categories",isAuth, addCategory);
// Edit an existing category
categoryRouter.put("/categories/:id",isAuth, editCategory);
// Delete a category
categoryRouter.delete("/categories/:id",isAuth, deleteCategory);
// ✅ Get subline items dynamically based on category name (from ChartOfAccounts)
categoryRouter.get("/categories/subline-items",isAuth, getSublineItems); // ?category=YourCategory
module.exports = categoryRouter;

