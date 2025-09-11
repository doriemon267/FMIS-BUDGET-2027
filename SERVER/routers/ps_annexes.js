const {
    getAllPersonnelServicesAnnexes,
    addPersonnelServicesAnnex,
    editPersonnelServicesAnnex,
    deletePersonnelServicesAnnex,
    getPersonnelServices,
    getPersonnelServicesLegal,
  } = require("../controllers/ps_annexes_controller");
  const Router = require("express").Router;
  const checkToken = require('../middleware/checkToken');
  const psAnnexesRouter = Router();
  // Apply authentication middleware to all routes in this router
  psAnnexesRouter.use(checkToken);
  // Get all PS_Annexes
  psAnnexesRouter.get("/ps_annexes", getAllPersonnelServicesAnnexes);
  // Add a new PS_Annex
  psAnnexesRouter.post("/ps_annexes", addPersonnelServicesAnnex);
  // Edit an existing PS_Annex
  psAnnexesRouter.put("/ps_annexes/:id", editPersonnelServicesAnnex);
  // Delete a PS_Annex
  psAnnexesRouter.delete("/ps_annexes/:id", deletePersonnelServicesAnnex);
  psAnnexesRouter.get("/ps_employeename", getPersonnelServices);
  psAnnexesRouter.get("/ps_legal", getPersonnelServicesLegal);
  module.exports = psAnnexesRouter;