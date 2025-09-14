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
const checkToken = require('../middleware/checkToken');
const {
  loadHierarchicalAssignment,
  applyHierarchicalFilters
} = require('../middleware/hierarchicalAssignmentMiddleware');
const employeeRouter = Router();
// Apply authentication middleware to all routes in this router
employeeRouter.use(checkToken);
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
