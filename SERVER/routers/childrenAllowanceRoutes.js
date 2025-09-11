const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const {
  getAllChildrenAllowances,
  getChildrenAllowance,
  createChildrenAllowance,
  updateChildrenAllowance,
  deleteChildrenAllowance,
  syncAllChildrenAllowances,
  getChildrenAllowanceStats,
} = require("../controllers/childrenAllowanceController");
const checkDueDate = require("../middleware/checkDueDate");
const childrenAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
childrenAllowanceRouter.use(checkToken);
// List all children allowance records
childrenAllowanceRouter.get("/children-allowance", getAllChildrenAllowances);
// Get children allowance statistics (must be before :id route)
childrenAllowanceRouter.get("/children-allowance/stats", getChildrenAllowanceStats);
// Retrieve a single children allowance record
childrenAllowanceRouter.get("/children-allowance/:id", getChildrenAllowance);
// Create a new children allowance record
childrenAllowanceRouter.post(
  "/children-allowance",
  checkDueDate,
  createChildrenAllowance
);
// Update an existing children allowance record
childrenAllowanceRouter.put(
  "/children-allowance/:id",
  checkDueDate,
  updateChildrenAllowance
);
// Delete a children allowance record
childrenAllowanceRouter.delete(
  "/children-allowance/:id",
  checkDueDate,
  deleteChildrenAllowance
);
// Synchronize all children allowances with personnel services
childrenAllowanceRouter.post(
  "/children-allowance/sync-all",
  syncAllChildrenAllowances
);
module.exports = childrenAllowanceRouter;