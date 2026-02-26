const {
  createSubsistenceAllowance,
  getAllSubsistenceAllowances,
  updateSubsistenceAllowance,
  deleteSubsistenceAllowance,
  getAllPerServicesSubsistence,
  getAllPerServicesSubsistenceByParams,
} = require("../controllers/subsistenceAllowanceController");
const Router = require("express").Router;
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");

const subsistenceAllowanceRouter = Router();
subsistenceAllowanceRouter.use(tokenMiddleware);
subsistenceAllowanceRouter.use("/subsistence-allowance", submissionWorkflowControl("read", { enforceSubmissionWorkflow: true }));
subsistenceAllowanceRouter.use("/getpersonnelssubsistence", submissionWorkflowControl("read", { enforceSubmissionWorkflow: true }));

subsistenceAllowanceRouter.get("/subsistence-allowance", getAllSubsistenceAllowances);
subsistenceAllowanceRouter.get("/getpersonnelssubsistence", getAllPerServicesSubsistence);
subsistenceAllowanceRouter.get("/getpersonnelssubsistence/byParams", getAllPerServicesSubsistenceByParams);
subsistenceAllowanceRouter.post("/subsistence-allowance", checkDueDate, submissionWorkflowControl("create", { enforceSubmissionWorkflow: true }), createSubsistenceAllowance);
subsistenceAllowanceRouter.put("/subsistence-allowance/:id", checkDueDate, submissionWorkflowControl("update", { enforceSubmissionWorkflow: true }), updateSubsistenceAllowance);
subsistenceAllowanceRouter.delete("/subsistence-allowance/:id", checkDueDate, submissionWorkflowControl("delete", { enforceSubmissionWorkflow: true }), deleteSubsistenceAllowance);

module.exports = subsistenceAllowanceRouter;
