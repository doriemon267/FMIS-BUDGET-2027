const {
  getAllSpecialCounselAllowances,
  getSpecialCounselAllowanceById,
  createSpecialCounselAllowance,
  updateSpecialCounselAllowance,
  deleteSpecialCounselAllowance,
} = require("../controllers/SpecialCounselAllowanceController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middlewares/check_token_dev");
const check_token_prod = require("../middlewares/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const specialCounselAllowanceRouter = Router();
// Apply authentication middleware to all routes in this router
specialCounselAllowanceRouter.use(tokenMiddleware);
// Apply submission workflow control middleware for read operations
specialCounselAllowanceRouter.use('/specialCounselAllowances', submissionWorkflowControl('read', { enforceSubmissionWorkflow: true }));
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
specialCounselAllowanceRouter.get("/specialCounselAllowances", getAllSpecialCounselAllowances);
specialCounselAllowanceRouter.get("/specialCounselAllowances/:id", getSpecialCounselAllowanceById);
// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
specialCounselAllowanceRouter.post("/specialCounselAllowances", checkDueDate, submissionWorkflowControl('create', { enforceSubmissionWorkflow: true }), createSpecialCounselAllowance);
specialCounselAllowanceRouter.put("/specialCounselAllowances/:id", checkDueDate, submissionWorkflowControl('update', { enforceSubmissionWorkflow: true }), updateSpecialCounselAllowance);
specialCounselAllowanceRouter.delete("/specialCounselAllowances/:id", checkDueDate, submissionWorkflowControl('delete', { enforceSubmissionWorkflow: true }), deleteSpecialCounselAllowance);
module.exports = specialCounselAllowanceRouter;
