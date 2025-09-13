const { getPersonnelByParams } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(checkToken);
// Get personnel by parameters - with submission workflow control
personnelParamsRouter.get("/getpersonnels/byParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
// Legacy route for backward compatibility - with submission workflow control
personnelParamsRouter.get("/api/personnel/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelByParams);
module.exports = personnelParamsRouter;