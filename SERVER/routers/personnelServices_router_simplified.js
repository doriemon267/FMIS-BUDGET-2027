const {
  getAllPersonnelServices,
  getAllPerServices,
  getPersonnelByParams,
  PersonnelServices,
  getPersonnelHiredBeforeJune1988,
} = require("../controllers/personnel_service_controller_case_sensitive");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const personnelServicesRouter = Router();
// Apply authentication to all personnel services routes
personnelServicesRouter.use(tokenMiddleware);
// Basic routes
personnelServicesRouter.get("/personnelServices", getAllPersonnelServices);
personnelServicesRouter.get("/getpersonnels", getAllPerServices);
// Get personnel by parameters
personnelServicesRouter.get("/getpersonnels/byParams", getPersonnelByParams);
// Legacy route for backward compatibility
personnelServicesRouter.get("/api/personnel/getByParams", getPersonnelByParams);
// Get personnel hired before June 1988
personnelServicesRouter.get("/getpersonnels/hiredBeforeJune1988", 
  getPersonnelHiredBeforeJune1988 || 
    ((req, res) => res.status(500).json({ message: "Function not available" }))
);
module.exports = personnelServicesRouter;
