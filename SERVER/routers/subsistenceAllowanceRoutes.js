const {
  createSubsistenceAllowance,
  bulkCreateSubsistenceAllowance,
  getAllSubsistenceAllowances,
  updateSubsistenceAllowance,
  deleteSubsistenceAllowance,
  getAllPerServicesSubsistence,
  getAllPerServicesSubsistenceByParams,
} = require("../controllers/subsistenceAllowanceController");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");

const subsistenceAllowanceRouter = Router();
subsistenceAllowanceRouter.use(authMiddleware);
subsistenceAllowanceRouter.use("/subsistence-allowance", submissionWorkflowControl("read", { enforceSubmissionWorkflow: true }));
subsistenceAllowanceRouter.use("/getpersonnelssubsistence", submissionWorkflowControl("read", { enforceSubmissionWorkflow: true }));

subsistenceAllowanceRouter.get("/subsistence-allowance", getAllSubsistenceAllowances);
subsistenceAllowanceRouter.get("/getpersonnelssubsistence", getAllPerServicesSubsistence);
subsistenceAllowanceRouter.get("/getpersonnelssubsistence/byParams", getAllPerServicesSubsistenceByParams);
subsistenceAllowanceRouter.post("/subsistence-allowance", checkDueDate, submissionWorkflowControl("create", { enforceSubmissionWorkflow: true }), createSubsistenceAllowance);
subsistenceAllowanceRouter.post("/subsistence-allowance/bulk", checkDueDate, submissionWorkflowControl("create", { enforceSubmissionWorkflow: true }), bulkCreateSubsistenceAllowance);
subsistenceAllowanceRouter.put("/subsistence-allowance/:id", checkDueDate, submissionWorkflowControl("update", { enforceSubmissionWorkflow: true }), updateSubsistenceAllowance);
subsistenceAllowanceRouter.delete("/subsistence-allowance/:id", checkDueDate, submissionWorkflowControl("delete", { enforceSubmissionWorkflow: true }), deleteSubsistenceAllowance);

module.exports = subsistenceAllowanceRouter;
