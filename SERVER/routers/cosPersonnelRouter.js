const {
  bulkAddCOSPersonnel,
  getAllCOSPersonnel,
  updateCOSPersonnel,
  deleteCOSPersonnel,
  getGrandTotalCOS,
  getCOSByParams
} = require("../controllers/cosPersonnelController");
const Router = require("express").Router;
const checkDueDate = require("../middleware/checkDueDate");
const isAuth = require('../middleware/is_auth');

const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const cosPersonnelRouter = Router();
// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(isAuth);

// Enforce submission-based visibility for reads
cosPersonnelRouter.get(
  "/cosPersonnels",
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getAllCOSPersonnel
);
cosPersonnelRouter.get(
  "/api/cos/getByParams",
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getCOSByParams
);
cosPersonnelRouter.get(
  "/grandtotalCOS",
  submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }),
  getGrandTotalCOS
);

// Protect writes (create/update/delete)
cosPersonnelRouter.post(
  "/cos-personnel/bulk-add",
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }),
  checkDueDate,
  bulkAddCOSPersonnel
);
cosPersonnelRouter.put(
  "/cos-personnel/:id",
  submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }),
  checkDueDate,
  updateCOSPersonnel
);
cosPersonnelRouter.delete(
  "/cos-personnel/:id",
  submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }),
  checkDueDate,
  deleteCOSPersonnel
);

module.exports = cosPersonnelRouter;

