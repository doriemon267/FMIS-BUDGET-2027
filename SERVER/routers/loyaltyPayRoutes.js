const {
  createLoyaltyPay,
  getAllLoyaltyPays,
  updateLoyaltyPay,
  deleteLoyaltyPay,
  getLoyaltyPayStats,
} = require("../controllers/loyaltyPayController");
const { getEligibleForLoyaltyPay } = require("../controllers/employeelistController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const loyaltyPayRouter = Router();
// Apply authentication middleware to all routes in this router
loyaltyPayRouter.use(checkToken);
// Apply submission workflow control middleware for read operations
loyaltyPayRouter.use('/loyalty-pay', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
loyaltyPayRouter.use('/loyalty-pay/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
loyaltyPayRouter.use('/loyalty-pay/eligible', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
loyaltyPayRouter.get("/loyalty-pay", getAllLoyaltyPays);
// Get loyalty pay statistics (must be before :id route)
loyaltyPayRouter.get("/loyalty-pay/stats", getLoyaltyPayStats);
// Get eligible employees for loyalty pay
loyaltyPayRouter.get("/loyalty-pay/eligible", getEligibleForLoyaltyPay);
loyaltyPayRouter.post("/loyalty-pay", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createLoyaltyPay);
loyaltyPayRouter.put("/loyalty-pay/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateLoyaltyPay);
loyaltyPayRouter.delete("/loyalty-pay/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteLoyaltyPay);
module.exports = loyaltyPayRouter;
