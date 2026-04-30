const {
  getAllCategories,
  addCategory,
  editCategory,
  deleteCategory,
  getSublineItems, // ⬅️ Import the new controller
} = require("../controllers/category_controller"); // or update path if in a different controller
const authMiddleware = require("../middleware/authMiddleware");



const Router = require("express").Router;
const categoryRouter = Router();
// Get all categories
categoryRouter.get("/categories", getAllCategories);
// Add a new category
categoryRouter.post("/categories",authMiddleware, addCategory);
// Edit an existing category
categoryRouter.put("/categories/:id",authMiddleware, editCategory);
// Delete a category
categoryRouter.delete("/categories/:id",authMiddleware, deleteCategory);
// ✅ Get subline items dynamically based on category name (from ChartOfAccounts)
categoryRouter.get("/categories/subline-items",authMiddleware, getSublineItems); // ?category=YourCategory
module.exports = categoryRouter;
