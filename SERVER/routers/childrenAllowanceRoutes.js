const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const {
  getAllChildrenAllowances,
  getChildrenAllowance,
  createChildrenAllowance,
  updateChildrenAllowance,
  deleteChildrenAllowance,
  syncAllChildrenAllowances,
  getChildrenAllowanceStats,
} = require("../controllers/ChildrenAllowanceController");
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const ChildrenAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
ChildrenAllowanceRouter.use(isAuth);
// Apply submission workflow control middleware for read operations
ChildrenAllowanceRouter.use('/children-allowance', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
ChildrenAllowanceRouter.use('/children-allowance/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// List all children allowance records
ChildrenAllowanceRouter.get("/children-allowance", getAllChildrenAllowances);
// Get children allowance statistics (must be before :id route)
ChildrenAllowanceRouter.get("/children-allowance/stats", getChildrenAllowanceStats);
// Retrieve a single children allowance record
ChildrenAllowanceRouter.get("/children-allowance/:id", getChildrenAllowance);
// Create a new children allowance record
ChildrenAllowanceRouter.post(
  "/children-allowance",
  checkDueDate,
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }),
  createChildrenAllowance
);
// Update an existing children allowance record
ChildrenAllowanceRouter.put(
  "/children-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true }),
  updateChildrenAllowance
);
// Delete a children allowance record
ChildrenAllowanceRouter.delete(
  "/children-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }),
  deleteChildrenAllowance
);
// Synchronize all children allowances with personnel services
ChildrenAllowanceRouter.post(
  "/children-allowance/sync-all",
  syncAllChildrenAllowances
);
module.exports = ChildrenAllowanceRouter;
