const {
  getAllSpecialCounselAllowances,
  getSpecialCounselAllowanceById,
  createSpecialCounselAllowance,
  updateSpecialCounselAllowance,
  deleteSpecialCounselAllowance,
} = require("../controllers/SpecialCounselAllowanceController");

const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");

const specialCounselAllowanceRouter = Router();

// Apply authentication middleware to all routes in this router
specialCounselAllowanceRouter.use(checkToken);

// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)

// GET routes without authentication (like other allowance routes)
specialCounselAllowanceRouter.get("/specialCounselAllowances", getAllSpecialCounselAllowances);
specialCounselAllowanceRouter.get("/specialCounselAllowances/:id", getSpecialCounselAllowanceById);

// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
specialCounselAllowanceRouter.post("/specialCounselAllowances", checkDueDate, createSpecialCounselAllowance);
specialCounselAllowanceRouter.put("/specialCounselAllowances/:id", checkDueDate, updateSpecialCounselAllowance);
specialCounselAllowanceRouter.delete("/specialCounselAllowances/:id", checkDueDate, deleteSpecialCounselAllowance);

module.exports = specialCounselAllowanceRouter;
