const {
    getAllPersonnelServicesAnnexes,
    addPersonnelServicesAnnex,
    editPersonnelServicesAnnex,
    deletePersonnelServicesAnnex,
    getPersonnelServices,
    getPersonnelServicesLegal,
  } = require("../controllers/ps_annexes_controller");
  const Router = require("express").Router;
  const isAuth = require('../middleware/is_auth');
  
  const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
  const psAnnexesRouter = Router();
  // Apply authentication middleware to all routes in this router
  psAnnexesRouter.use(isAuth);
  // Get all PsAnnex - with submission workflow control
  psAnnexesRouter.get("/ps_annexes", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllPersonnelServicesAnnexes);
  // Add a new PS_Annex - with submission workflow control
  psAnnexesRouter.post("/ps_annexes", submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), addPersonnelServicesAnnex);
  // Edit an existing PS_Annex - with submission workflow control
  psAnnexesRouter.put("/ps_annexes/:id", submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), editPersonnelServicesAnnex);
  // Delete a PS_Annex - with submission workflow control
  psAnnexesRouter.delete("/ps_annexes/:id", submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deletePersonnelServicesAnnex);
  psAnnexesRouter.get("/ps_employeename", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelServices);
  psAnnexesRouter.get("/ps_legal", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getPersonnelServicesLegal);
  module.exports = psAnnexesRouter;
