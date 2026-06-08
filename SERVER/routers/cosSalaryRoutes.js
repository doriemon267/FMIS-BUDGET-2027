const express = require("express");
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
const cosSalaryController = require("../controllers/cosSalaryController");

router.use(isAuth);

router.get("/rate/:salaryGrade/:step", cosSalaryController.getRateBySalaryGradeAndStep);
router.get("/table", cosSalaryController.getTable);
router.get("/table/seed", requireDynamicPermission(['/salary-table', '/cos-salary-table']), cosSalaryController.seedTable);
router.put("/table/:id", requireDynamicPermission(['/salary-table', '/cos-salary-table']), cosSalaryController.updateRow);

module.exports = router;

