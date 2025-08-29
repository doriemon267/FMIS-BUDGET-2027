const {
  createSubsistenceST,
  getAllSubsistenceST,
  updateSubsistenceST,
  deleteSubsistenceST,
} = require("../controllers/subsistenceAllowanceSTController");

const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");

const subsistenceSTRouter = Router();

// Apply authentication middleware to all routes in this router
subsistenceSTRouter.use(checkToken);

// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)

// GET routes without authentication (like other allowance routes)
subsistenceSTRouter.get("/subsistence-allowance-st", getAllSubsistenceST);

// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
subsistenceSTRouter.post("/subsistence-allowance-st", checkDueDate, createSubsistenceST);
subsistenceSTRouter.put("/subsistence-allowance-st/:id", checkDueDate, updateSubsistenceST);
subsistenceSTRouter.delete("/subsistence-allowance-st/:id", checkDueDate, deleteSubsistenceST);

module.exports = subsistenceSTRouter;
