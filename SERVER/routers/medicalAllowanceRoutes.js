const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getAllMedicalAllowances,
  getMedicalAllowance,
  createMedicalAllowance,
  updateMedicalAllowance,
  deleteMedicalAllowance,
  bulkAddMedicalAllowances,
  syncAllMedicalAllowances,
  getMedicalAllowanceStats,
} = require("../controllers/medicalAllowanceController");
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require('../middleware/submissionWorkflowControl');
const medicalAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
medicalAllowanceRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
medicalAllowanceRouter.use('/medical-allowance', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
medicalAllowanceRouter.use('/medical-allowance/stats', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// List all medical allowance records
medicalAllowanceRouter.get("/medical-allowance", getAllMedicalAllowances);
// Get medical allowance statistics (must be before :id route)
medicalAllowanceRouter.get("/medical-allowance/stats", getMedicalAllowanceStats);
// Retrieve a single medical allowance record
medicalAllowanceRouter.get("/medical-allowance/:id", getMedicalAllowance);
// Create a new medical allowance record
medicalAllowanceRouter.post(
  "/medical-allowance",
  checkDueDate,
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }),
  createMedicalAllowance
);
// Update an existing medical allowance record
medicalAllowanceRouter.put(
  "/medical-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('update', { strictMode: true, enforceSubmissionWorkflow: true }),
  updateMedicalAllowance
);
// Delete a medical allowance record
medicalAllowanceRouter.delete(
  "/medical-allowance/:id",
  checkDueDate,
  submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }),
  deleteMedicalAllowance
);
// Bulk add medical allowances for eligible employees
medicalAllowanceRouter.post(
  "/medical-allowance/bulk-add",
  checkDueDate,
  submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }),
  bulkAddMedicalAllowances
);
// Synchronize all medical allowances with personnel services
medicalAllowanceRouter.post(
  "/medical-allowance/sync-all",
  syncAllMedicalAllowances
);
module.exports = medicalAllowanceRouter;