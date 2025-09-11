const {
    createMealAllowance,
    getAllMealAllowances,
    updateMealAllowance,
    deleteMealAllowance,
    getMealAllowanceStats
  } = require("../controllers/mealAllowanceController");
  const Router = require("express").Router;
  const checkToken = require('../middleware/checkToken');
// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
  const mealAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
mealAllowanceRouter.use(checkToken);
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
  // GET routes without authentication (like other allowance routes)
  mealAllowanceRouter.get("/meal-allowance", getAllMealAllowances);
  mealAllowanceRouter.get("/meal-allowance/stats", getMealAllowanceStats);
  // POST/PUT/DELETE routes with due date protection only (like other allowance routes)
  mealAllowanceRouter.post("/meal-allowance", checkDueDate, createMealAllowance);
  mealAllowanceRouter.put("/meal-allowance/:id", checkDueDate, updateMealAllowance);
  mealAllowanceRouter.delete("/meal-allowance/:id", checkDueDate, deleteMealAllowance);
  module.exports = mealAllowanceRouter;