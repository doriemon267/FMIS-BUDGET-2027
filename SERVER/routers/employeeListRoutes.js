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
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  loadHierarchicalAssignment,
  applyHierarchicalFilters
} = require('../middleware/hierarchicalAssignmentMiddleware');
const employeeRouter = Router();
// Apply authentication middleware to all routes in this router
employeeRouter.use(tokenMiddleware);
// Load hierarchical assignments for all routes
employeeRouter.use(loadHierarchicalAssignment);
// Get all employees with hierarchical filtering
employeeRouter.get("/employees", applyHierarchicalFilters, getAllEmployees);
// Add a new employee
employeeRouter.post("/employees", addEmployee);
// Edit an existing employee
employeeRouter.put("/employees/:id", editEmployee);
// Delete an employee
employeeRouter.delete("/employees/:id", deleteEmployee);
// Get employees eligible for loyalty pay with hierarchical filtering
employeeRouter.get("/employees/loyalty-pay", applyHierarchicalFilters, getEligibleForLoyaltyPay);
// Get employees eligible for retirement with hierarchical filtering
employeeRouter.get("/eligible-for-retirement", applyHierarchicalFilters, getEligibleForRetirement);
// Get employee statistics with hierarchical filtering
employeeRouter.get("/employees/stats", applyHierarchicalFilters, getEmployeeStats);
module.exports = employeeRouter;
