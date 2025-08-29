const {
    getProposalSummary,
    getAnalytics,
    getPersonnelAggregates,
  } = require("../controllers/proposalSummaryController");
  
  const Router = require("express").Router;
  const checkToken = require('../middleware/checkToken');
  
  const proposalSummaryRouter = Router();
  
  // Apply authentication middleware to all routes in this router
  proposalSummaryRouter.use(checkToken);
  
  // Get all proposal summaries
  proposalSummaryRouter.get("/proposalsummary", getProposalSummary);
  
  // Get analytics data para sa proposal summary
  proposalSummaryRouter.get("/analytics", getAnalytics);

  // Get personnel aggregates
  proposalSummaryRouter.get("/personnelAggregates", getPersonnelAggregates);
  
  module.exports = proposalSummaryRouter;
  