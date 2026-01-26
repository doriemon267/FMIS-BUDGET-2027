const {
    createMealAllowance,
    getAllMealAllowances,
    updateMealAllowance,
    deleteMealAllowance,
    getMealAllowanceStats
  } = require("../controllers/mealAllowanceController");
  const Router = require("express").Router;
  const checkToken = require('../middleware/check_token');
  const check_token_dev = require("../middleware/check_token_dev");
  const check_token_prod = require("../middleware/check_token_prod");
  const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
  const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
  
// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
  const mealAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
mealAllowanceRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
mealAllowanceRouter.use('/meal-allowance', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
mealAllowanceRouter.use('/meal-allowance/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
  // GET routes without authentication (like other allowance routes)
  mealAllowanceRouter.get("/meal-allowance", getAllMealAllowances);
  mealAllowanceRouter.get("/meal-allowance/stats", getMealAllowanceStats);
  // POST/PUT/DELETE routes with due date protection only (like other allowance routes)
  mealAllowanceRouter.post("/meal-allowance", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createMealAllowance);
  mealAllowanceRouter.put("/meal-allowance/:id", checkDueDate, submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true }), updateMealAllowance);
  mealAllowanceRouter.delete("/meal-allowance/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteMealAllowance);
  module.exports = mealAllowanceRouter;
