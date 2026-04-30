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
const authMiddleware = require("../middleware/authMiddleware");

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const employeeRouter = Router();
// Apply authentication middleware to all routes in this router
employeeRouter.use(authMiddleware);
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
