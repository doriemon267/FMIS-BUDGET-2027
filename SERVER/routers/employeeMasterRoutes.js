const express = require("express");
const isAuth = require('../middleware/is_auth');

const {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
  checkEmployeeRegions,
  fixEmployeeRegions,
  checkEmployeeDuplicate
} = require("../controllers/employeeMasterController");
const employeeMasterRouter = express.Router();
// Apply authentication middleware to all routes in this router
employeeMasterRouter.use(isAuth);
// Get employee statistics - MUST be before other routes to avoid conflict with :id
employeeMasterRouter.get("/employees/stats", getEmployeeStats);
// Check for duplicate employee - MUST be before other routes to avoid conflict with :id
employeeMasterRouter.get("/employees/check-duplicate", checkEmployeeDuplicate);
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
