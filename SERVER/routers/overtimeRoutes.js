const {
  createOvertimePay,
  getAllOvertimePays,
  updateOvertimePay,
  deleteOvertimePay,
  getSumOfOvertimeAmount,
  getOvertimeByRegion,
} = require("../controllers/overtimePayController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const overtimeRouter = Router();
// Apply authentication middleware to all routes in this router
overtimeRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
overtimeRouter.use('/overtime-pay', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
overtimeRouter.get("/overtime-pay", getAllOvertimePays);
overtimeRouter.post("/overtime-pay", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createOvertimePay);
overtimeRouter.put("/overtime-pay/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateOvertimePay);
overtimeRouter.delete("/overtime-pay/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteOvertimePay);
overtimeRouter.get("/overtime-pay/sum", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getSumOfOvertimeAmount);
overtimeRouter.get("/overtime-pay/by-region", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getOvertimeByRegion);
module.exports = overtimeRouter;
