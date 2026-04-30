const {
    getProposalSummary,
    getAnalytics,
    getPersonnelAggregates,
    getPersonnelServicesTotalWithBreakdown,
  } = require("../controllers/proposalSummaryController");
  const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");
  
  const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
  const proposalSummaryRouter = Router();
  // Apply authentication middleware to all routes in this router
  proposalSummaryRouter.use(authMiddleware);
  // Get all proposal summaries (respect submission workflow)
  proposalSummaryRouter.get(
    "/proposalsummary",
    submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
    getProposalSummary
  );
  // Get analytics data para sa proposal summary (respect submission workflow)
  proposalSummaryRouter.get(
    "/analytics",
    submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
    getAnalytics
  );
  // Get personnel aggregates (respect submission workflow)
  proposalSummaryRouter.get(
    "/personnelAggregates",
    submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
    getPersonnelAggregates
  );

  // Get Personnel Services SUBTOTAL with breakdown (respect submission workflow)
  proposalSummaryRouter.get(
    "/personnelServicesTotalWithBreakdown",
    submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
    getPersonnelServicesTotalWithBreakdown
  );

  module.exports = proposalSummaryRouter;
