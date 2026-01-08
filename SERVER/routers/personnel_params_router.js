const { getPersonnelByParams } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(checkToken);
// Get personnel by parameters
personnelParamsRouter.get("/getpersonnels/byParams", getPersonnelByParams);
// Legacy route for backward compatibility
personnelParamsRouter.get("/api/personnel/getByParams", getPersonnelByParams);
module.exports = personnelParamsRouter;