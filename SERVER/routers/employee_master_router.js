const express = require("express");
const checkToken = require('../middleware/check_token');
const {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
  checkEmployeeRegions,
  fixEmployeeRegions
} = require("../controllers/employee_master_controller");
const employeeMasterRouter = express.Router();
// Apply authentication middleware to all routes in this router
employeeMasterRouter.use(checkToken);
// Get employee statistics - MUST be before other routes to avoid conflict with :id
employeeMasterRouter.get("/employees/stats", getEmployeeStats);
// Utility endpoints to check and fix employee regions
employeeMasterRouter.get("/employees/check-regions", checkEmployeeRegions);
employeeMasterRouter.post("/employees/fix-regions", fixEmployeeRegions);
// Standard CRUD routes
employeeMasterRouter.get("/employees", getAllEmployees);
employeeMasterRouter.post("/employees", createEmployee);
employeeMasterRouter.get("/employees/:id", getEmployeeById);
employeeMasterRouter.put("/employees/:id", updateEmployee);
employeeMasterRouter.delete("/employees/:id", deleteEmployee);
module.exports = employeeMasterRouter;