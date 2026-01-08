const {
  getAllCategories,
  addCategory,
  editCategory,
  deleteCategory,
  getSublineItems, // ⬅️ Import the new controller
} = require("../controllers/category_controller"); // or update path if in a different controller
const checkToken = require("../middleware/check_token");
const Router = require("express").Router;
const categoryRouter = Router();
// Get all categories
categoryRouter.get("/categories", getAllCategories);
// Add a new category
categoryRouter.post("/categories",checkToken, addCategory);
// Edit an existing category
categoryRouter.put("/categories/:id",checkToken, editCategory);
// Delete a category
categoryRouter.delete("/categories/:id",checkToken, deleteCategory);
// ✅ Get subline items dynamically based on category name (from ChartOfAccounts)
categoryRouter.get("/categories/subline-items",checkToken, getSublineItems); // ?category=YourCategory
module.exports = categoryRouter;
