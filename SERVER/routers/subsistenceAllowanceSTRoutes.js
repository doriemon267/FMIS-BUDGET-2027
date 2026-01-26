const {
  createSubsistenceST,
  getAllSubsistenceST,
  updateSubsistenceST,
  deleteSubsistenceST,
} = require("../controllers/subsistenceAllowanceSTController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const subsistenceSTRouter = Router();
// Apply authentication middleware to all routes in this router
subsistenceSTRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
subsistenceSTRouter.use('/subsistence-allowance-st', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
subsistenceSTRouter.get("/subsistence-allowance-st", getAllSubsistenceST);
// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
subsistenceSTRouter.post("/subsistence-allowance-st", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createSubsistenceST);
subsistenceSTRouter.put("/subsistence-allowance-st/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateSubsistenceST);
subsistenceSTRouter.delete("/subsistence-allowance-st/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteSubsistenceST);
module.exports = subsistenceSTRouter;
