const {
  getAllPersonnelServices,
  getAllPerServices,
  getPersonnelByParams,
  PersonnelServices,
  getPersonnelHiredBeforeJune1988,
} = require("../controllers/personnel_service_controller_case_sensitive");
const Router = require("express").Router;
const isAuth = require('../middleware/is_auth');

const personnelServicesRouter = Router();
// Apply authentication to all personnel services routes
personnelServicesRouter.use(isAuth);
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

