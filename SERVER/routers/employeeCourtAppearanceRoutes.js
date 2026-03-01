const {
  getAllAppearances,
  addAppearance,
  editAppearance,
  deleteAppearance,
  getSumOfCourtAppearanceAmount,
} = require("../controllers/employeeCourtAppearanceController");
const { exportCourtAppearancePDF } = require("../controllers/courtAppearancePDFController");
const Router = require("express").Router;
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { hierarchicalAccessControl } = require("../middleware/hierarchicalAccessControl");
const logUserActivity = require("../middleware/logUserActivity");
const appearanceRouter = Router();
// Apply authentication middleware to all routes in this router
appearanceRouter.use(tokenMiddleware);
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
appearanceRouter.get("/court-appearances", getAllAppearances);
appearanceRouter.get("/court-appearances/sum", getSumOfCourtAppearanceAmount);

// PDF Export route with hierarchical access control
appearanceRouter.post("/court-appearances/export-pdf", 
  hierarchicalAccessControl('read', { allowedFields: ['region', 'department', 'division'] }), 
  logUserActivity("Export Court Appearance PDF"),
  exportCourtAppearancePDF
);

// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
appearanceRouter.post("/court-appearances", checkDueDate, addAppearance);
appearanceRouter.put("/court-appearances/:id", checkDueDate, editAppearance);
appearanceRouter.delete("/court-appearances/:id", checkDueDate, deleteAppearance);
module.exports = appearanceRouter;
