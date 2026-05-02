const { getPersonnelByParams, bulkUpdatePersonnel } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(isAuth);
// Get personnel by parameters - with submission workflow control
personnelParamsRouter.get("/getpersonnels/byParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Personnel getByParams - path is relative to /api mount, so use /personnel/getByParams (not /api/personnel/getByParams)
personnelParamsRouter.get("/personnel/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Bulk update personnel entries
personnelParamsRouter.put("/personnel/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), bulkUpdatePersonnel);
module.exports = personnelParamsRouter;
