const Router = require("express").Router;
const checkToken = require('../middleware/checkToken');
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

const medicalAllowanceRouter = Router();

// Apply authentication middleware to all routes in this router
medicalAllowanceRouter.use(checkToken);

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
  createMedicalAllowance
);

// Update an existing medical allowance record
medicalAllowanceRouter.put(
  "/medical-allowance/:id",
  checkDueDate,
  updateMedicalAllowance
);

// Delete a medical allowance record
medicalAllowanceRouter.delete(
  "/medical-allowance/:id",
  checkDueDate,
  deleteMedicalAllowance
);

// Bulk add medical allowances for eligible employees
medicalAllowanceRouter.post(
  "/medical-allowance/bulk-add",
  checkDueDate,
  bulkAddMedicalAllowances
);

// Synchronize all medical allowances with personnel services
medicalAllowanceRouter.post(
  "/medical-allowance/sync-all",
  syncAllMedicalAllowances
);

module.exports = medicalAllowanceRouter;