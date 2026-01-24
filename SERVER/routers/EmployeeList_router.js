const {
  getAllEmployees,
  addEmployee,
  editEmployee,
  deleteEmployee,
  getEligibleForLoyaltyPay,
  getEligibleForRetirement,
  getEmployeeStats,
} = require("../controllers/employeelistController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const employeeRouter = Router();
// Apply authentication middleware to all routes in this router
employeeRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
employeeRouter.use('/employees', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
employeeRouter.use('/employees/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
employeeRouter.use('/employees/loyalty-pay', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
employeeRouter.use('/eligible-for-retirement', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// Get all employees
employeeRouter.get("/employees", getAllEmployees);
// Add a new employee
employeeRouter.post("/employees", addEmployee);
// Edit an existing employee
employeeRouter.put("/employees/:id", editEmployee);
// Delete an employee
employeeRouter.delete("/employees/:id", deleteEmployee);
// Get employees eligible for loyalty pay
employeeRouter.get("/employees/loyalty-pay", getEligibleForLoyaltyPay);
// Get employees eligible for retirement
employeeRouter.get("/eligible-for-retirement", getEligibleForRetirement);
// Get employee statistics
employeeRouter.get("/employees/stats", getEmployeeStats);
module.exports = employeeRouter;
