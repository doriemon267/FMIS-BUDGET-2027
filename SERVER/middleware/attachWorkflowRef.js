// Middleware to ensure line item endpoints receive a proposalId/workflowRef
// Sources (priority):
// 1. X-Workflow-Ref header
// 2. workflowRef query param
// 3. proposalId query param
// 4. X-Proposal-Id header (legacy)
// If body.proposalId is absent, we inject it.
// Also mirrors value to req.workflowRef for convenience.
module.exports = function attachWorkflowRef(req, _res, next) {
  try {
    const headerRef = req.headers['x-workflow-ref'] || req.headers['x-proposal-id'];
    const queryRef = req.query.workflowRef || req.query.proposalId;
    const existing = req.body && (req.body.proposalId || req.body.workflowRef);
    const chosen = existing || headerRef || queryRef;
    if (chosen) {
      // Normalize to proposalId in body
      if (!req.body) req.body = {};
      if (!req.body.proposalId) req.body.proposalId = chosen;
      // Mirror to workflowRef for controllers expecting that name
      if (!req.body.workflowRef) req.body.workflowRef = chosen;
      // Convenience for downstream
      req.workflowRef = chosen;
    }
  } catch (_e) {
    // Silent fail – do not block request
  }
  next();
};