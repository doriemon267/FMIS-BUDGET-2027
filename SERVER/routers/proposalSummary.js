const {
    getProposalSummary,
    getAnalytics,
    getPersonnelAggregates,
  } = require("../controllers/proposalSummaryController");
  const Router = require("express").Router;
  const checkToken = require('../middleware/checkToken');
  const { strictHierarchicalControl, hierarchicalAccessControl } = require('../middleware/hierarchicalAccessControl');
  const proposalSummaryRouter = Router();
  // Apply authentication middleware to all routes in this router
  proposalSummaryRouter.use(checkToken);
  // Get all proposal summaries
  proposalSummaryRouter.get("/proposalsummary", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getProposalSummary);
  // Get analytics data para sa proposal summary
  proposalSummaryRouter.get("/analytics", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getAnalytics);
  // Get personnel aggregates
  proposalSummaryRouter.get("/personnelAggregates", hierarchicalAccessControl('read', { allowedFields: ['region'] }), getPersonnelAggregates);
  module.exports = proposalSummaryRouter;
