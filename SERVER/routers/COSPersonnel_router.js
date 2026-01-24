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
const checkToken = require("../middleware/check_token");

const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const cosPersonnelRouter = Router();
// Apply authentication middleware to all routes in this router
cosPersonnelRouter.use(tokenMiddleware);

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
