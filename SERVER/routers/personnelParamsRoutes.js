const { getPersonnelByParams, bulkUpdatePersonnel } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(checkToken);
// Get personnel by parameters - with submission workflow control
personnelParamsRouter.get("/getpersonnels/byParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Legacy route for backward compatibility - with submission workflow control
personnelParamsRouter.get("/api/personnel/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Bulk update personnel entries
personnelParamsRouter.put("/api/personnel/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), bulkUpdatePersonnel);
module.exports = personnelParamsRouter;