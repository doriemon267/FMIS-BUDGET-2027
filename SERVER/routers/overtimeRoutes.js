const {
  createOvertimePay,
  getAllOvertimePays,
  updateOvertimePay,
  deleteOvertimePay,
  getSumOfOvertimeAmount,
  getOvertimeByRegion,
} = require("../controllers/overtimePayController");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const overtimeRouter = Router();
// Apply authentication middleware to all routes in this router
overtimeRouter.use(authMiddleware);
// Apply submission workflow control middleware for read operations
overtimeRouter.use('/overtime-pay', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
overtimeRouter.get("/overtime-pay", getAllOvertimePays);
overtimeRouter.post("/overtime-pay", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createOvertimePay);
overtimeRouter.put("/overtime-pay/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateOvertimePay);
overtimeRouter.delete("/overtime-pay/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteOvertimePay);
overtimeRouter.get("/overtime-pay/sum", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getSumOfOvertimeAmount);
overtimeRouter.get("/overtime-pay/by-region", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getOvertimeByRegion);
module.exports = overtimeRouter;
