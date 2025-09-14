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
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const childrenAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
childrenAllowanceRouter.use(checkToken);
// Apply submission workflow control middleware for read operations
childrenAllowanceRouter.use('/children-allowance', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
childrenAllowanceRouter.use('/children-allowance/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
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
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }),
  createChildrenAllowance
);
// Update an existing children allowance record
childrenAllowanceRouter.put(
  "/children-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  updateChildrenAllowance
);
// Delete a children allowance record
childrenAllowanceRouter.delete(
  "/children-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }),
  deleteChildrenAllowance
);
// Synchronize all children allowances with personnel services
childrenAllowanceRouter.post(
  "/children-allowance/sync-all",
  syncAllChildrenAllowances
);
module.exports = childrenAllowanceRouter;