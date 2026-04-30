const {
  getAllAppearances,
  addAppearance,
  editAppearance,
  deleteAppearance,
  getSumOfCourtAppearanceAmount,
} = require("../controllers/employeeCourtAppearanceController");
const { exportCourtAppearancePDF } = require("../controllers/courtAppearancePDFController");
const Router = require("express").Router;
const authMiddleware = require("../middleware/authMiddleware");

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const { hierarchicalAccessControl } = require("../middleware/hierarchicalAccessControl");
const { logUserActivity } = require("../middleware/userLogs");
const appearanceRouter = Router();
// Apply authentication middleware to all routes in this router
appearanceRouter.use(authMiddleware);
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
appearanceRouter.get("/court-appearances", getAllAppearances);
appearanceRouter.get("/court-appearances/sum", getSumOfCourtAppearanceAmount);

// PDF Export route with hierarchical access control
appearanceRouter.post("/court-appearances/export-pdf", 
  hierarchicalAccessControl('read', { allowedFields: ['region', 'department', 'division'] }), 
  logUserActivity({ 
    action: 'EXPORT', 
    resource: 'CourtAppearance', 
    getDetails: (req) => ({ 
      format: 'PDF',
      subAction: 'export-court-appearance',
      filters: req.body.filters
    }) 
  }),
  exportCourtAppearancePDF
);

// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
appearanceRouter.post("/court-appearances", checkDueDate, addAppearance);
appearanceRouter.put("/court-appearances/:id", checkDueDate, editAppearance);
appearanceRouter.delete("/court-appearances/:id", checkDueDate, deleteAppearance);
module.exports = appearanceRouter;
