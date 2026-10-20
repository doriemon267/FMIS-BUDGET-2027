const {
  getAllIncomeSubcategories,
  addIncomeSubcategory,
  editIncomeSubcategory,
  deleteIncomeSubcategory,
  getSubcategoriesByCategory,
  updateSubcategoryRegions,
  getSubcategoriesByRegion,
  assignSubcategoryToRegion
} = require("../controllers/incomeSubcategoryControllerNew");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const incomeSubcategoryRouter = Router();
// Apply authentication to all income subcategory routes
incomeSubcategoryRouter.use(isAuth);
// Get all income subcategories
incomeSubcategoryRouter.get("/income-subcategories", getAllIncomeSubcategories);
// Add a new income subcategory
incomeSubcategoryRouter.post("/income-subcategories", addIncomeSubcategory);
// Edit an existing income subcategory
incomeSubcategoryRouter.put("/income-subcategories/:id", editIncomeSubcategory);
// Delete an income subcategory
incomeSubcategoryRouter.delete("/income-subcategories/:id", deleteIncomeSubcategory);
// Removed seed functions - everything should be dynamic from database
// Get subcategories by category and region
incomeSubcategoryRouter.get("/income-subcategories/by-category", getSubcategoriesByCategory);
// Get subcategories by region (strict filtering)
incomeSubcategoryRouter.get("/income-subcategories/by-region", getSubcategoriesByRegion);
// Update region assignments for a subcategory
incomeSubcategoryRouter.patch("/income-subcategories/:id/regions", updateSubcategoryRegions);
// Assign a subcategory to a specific region
incomeSubcategoryRouter.post("/income-subcategories/assign-to-region", assignSubcategoryToRegion);
// Removed eligibility check - everything should be dynamic from database
module.exports = incomeSubcategoryRouter;
