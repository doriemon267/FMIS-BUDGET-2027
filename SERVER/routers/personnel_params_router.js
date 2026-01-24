const { getPersonnelByParams } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(tokenMiddleware);
// Get personnel by parameters
personnelParamsRouter.get("/getpersonnels/byParams", getPersonnelByParams);
// Legacy route for backward compatibility
personnelParamsRouter.get("/api/personnel/getByParams", getPersonnelByParams);
module.exports = personnelParamsRouter;