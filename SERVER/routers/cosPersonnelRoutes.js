const {
  bulkAddCOSPersonnel,
  getAllCOSPersonnel,
  updateCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS,
  getCOSByParams
} = require("../controllers/cospersonnelController");
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const checkToken = require("../middleware/checkToken");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const cosPersonnelRouter = Router();
// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(checkToken);
cosPersonnelRouter.get("/cosPersonnels", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getAllCOSPersonnel);
cosPersonnelRouter.get("/api/cos/getByParams", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getCOSByParams);
cosPersonnelRouter.post("/cos-personnel/bulk-add", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), bulkAddCOSPersonnel);
cosPersonnelRouter.put("/cos-personnel/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateCOSPersonnel);
cosPersonnelRouter.delete("/cos-personnel/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteCOSPersonnel);
cosPersonnelRouter.get("/grandtotalCOS", submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }), getGrandTotalCOS);
module.exports = cosPersonnelRouter;
