const { getPersonnelByParams, bulkUpdatePersonnel } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const { enforceAccessRestrictions } = require('../middleware/accessRestrictions');
const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(tokenMiddleware);
// Get personnel by parameters - with submission workflow control
personnelParamsRouter.get("/getpersonnels/byParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Personnel getByParams - path is relative to /api mount, so use /personnel/getByParams (not /api/personnel/getByParams)
personnelParamsRouter.get("/personnel/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Bulk update personnel entries
personnelParamsRouter.put("/personnel/bulk-update", submissionWorkflowControl('update', { strictMode: true, enableConsolidation: true }), enforceAccessRestrictions({ checkBudgetType: true, checkFiscalYear: true, checkReadOnly: true }), bulkUpdatePersonnel);
module.exports = personnelParamsRouter;