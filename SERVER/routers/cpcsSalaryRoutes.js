const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const cpcsSalaryController = require("../controllers/cpcsSalaryController");

router.use(authMiddleware);

// Settings
router.get("/settings", cpcsSalaryController.getSettings);
router.put("/settings", cpcsSalaryController.updateSettings);
router.get("/use-cpcs", cpcsSalaryController.getUseCPCS);

// Table CRUD
router.get("/table", cpcsSalaryController.getTable);
router.get("/table/seed", cpcsSalaryController.seedTable);
router.post("/table/seed-from-excel", cpcsSalaryController.seedFromExcel);
router.get("/table/:id", cpcsSalaryController.getRowById);
router.post("/table", cpcsSalaryController.createRow);
router.put("/table/:id", cpcsSalaryController.updateRow);
router.delete("/table/:id", cpcsSalaryController.deleteRow);

// Rate lookup (for employee add / bulk) - same shape as existing salary APIs when useCPCS is on
router.get("/grades", cpcsSalaryController.getGradesBySalaryGrade);
router.get("/rate-by-job-grade-and-step/:job_grade/:step", cpcsSalaryController.getRateByJobGradeAndStep);
router.get("/rate", cpcsSalaryController.getRateByCPCS);

module.exports = router;
