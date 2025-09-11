const {
  getAllAppearances,
  addAppearance,
  editAppearance,
  deleteAppearance,
  getSumOfCourtAppearanceAmount,
} = require("../controllers/employeeCourtAppearanceController");
const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");
const appearanceRouter = Router();
// Apply authentication middleware to all routes in this router
appearanceRouter.use(checkToken);
// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)
// GET routes without authentication (like other allowance routes)
appearanceRouter.get("/court-appearances", getAllAppearances);
appearanceRouter.get("/court-appearances/sum", getSumOfCourtAppearanceAmount);
// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
appearanceRouter.post("/court-appearances", checkDueDate, addAppearance);
appearanceRouter.put("/court-appearances/:id", checkDueDate, editAppearance);
appearanceRouter.delete("/court-appearances/:id", checkDueDate, deleteAppearance);
module.exports = appearanceRouter;