const {
  createSubsistenceAllowance,
  getAllSubsistenceAllowances,
  updateSubsistenceAllowance,
  deleteSubsistenceAllowance,
  getAllPerServicesMDS,
  getAllPerServicesMDSByParams,
} = require("../controllers/subsistenceAllowanceMDSController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const subsistenceAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
subsistenceAllowanceRouter.use(checkToken);
// Apply submission workflow control middleware for read operations
subsistenceAllowanceRouter.use('/subsistence-allowance-mds', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
subsistenceAllowanceRouter.use('/getpersonnelsmds', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
subsistenceAllowanceRouter.get("/subsistence-allowance-mds", getAllSubsistenceAllowances);
subsistenceAllowanceRouter.get("/getpersonnelsmds", getAllPerServicesMDS);
subsistenceAllowanceRouter.get("/getpersonnelsmds/byParams", getAllPerServicesMDSByParams);
// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
subsistenceAllowanceRouter.post("/subsistence-allowance-mds", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createSubsistenceAllowance);
subsistenceAllowanceRouter.put("/subsistence-allowance-mds/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateSubsistenceAllowance);
subsistenceAllowanceRouter.delete("/subsistence-allowance-mds/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteSubsistenceAllowance);
module.exports = subsistenceAllowanceRouter;