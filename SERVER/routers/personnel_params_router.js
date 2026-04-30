const { getPersonnelByParams } = require("../controllers/personnel_params_controller");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

const personnelParamsRouter = Router();
// Apply authentication middleware to all routes in this router
personnelParamsRouter.use(authMiddleware);
// Get personnel by parameters
personnelParamsRouter.get("/getpersonnels/byParams", getPersonnelByParams);
// Legacy route for backward compatibility
personnelParamsRouter.get("/api/personnel/getByParams", getPersonnelByParams);
module.exports = personnelParamsRouter;