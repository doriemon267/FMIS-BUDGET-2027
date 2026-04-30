const express = require("express");
const router = express.Router();
const checkToken = require("../middleware/check_token");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
const cpcsSalaryController = require("../controllers/cpcsSalaryController");

router.use(tokenMiddleware);

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
