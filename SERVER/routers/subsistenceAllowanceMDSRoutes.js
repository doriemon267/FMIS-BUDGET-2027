const {
  createSubsistenceAllowance,
  getAllSubsistenceAllowances,
  updateSubsistenceAllowance,
  deleteSubsistenceAllowance,
  getAllPerServicesMDS,
  getAllPerServicesMDSByParams,
} = require("../controllers/subsistenceAllowanceMDSController");

const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');

// Import old middleware for consistency with other allowance routes
const checkDueDate = require("../middleware/checkDueDate");

const subsistenceAllowanceRouter = Router();

// Apply authentication middleware to all routes in this router
subsistenceAllowanceRouter.use(checkToken);

// 🔓 ROUTES (Consistent with other allowance routes like medical-allowance, children-allowance)

// GET routes without authentication (like other allowance routes)
subsistenceAllowanceRouter.get("/subsistence-allowance-mds", getAllSubsistenceAllowances);
subsistenceAllowanceRouter.get("/getpersonnelsmds", getAllPerServicesMDS);
subsistenceAllowanceRouter.get("/getpersonnelsmds/byParams", getAllPerServicesMDSByParams);

// POST/PUT/DELETE routes with due date protection only (like other allowance routes)
subsistenceAllowanceRouter.post("/subsistence-allowance-mds", checkDueDate, createSubsistenceAllowance);
subsistenceAllowanceRouter.put("/subsistence-allowance-mds/:id", checkDueDate, updateSubsistenceAllowance);
subsistenceAllowanceRouter.delete("/subsistence-allowance-mds/:id", checkDueDate, deleteSubsistenceAllowance);

module.exports = subsistenceAllowanceRouter;