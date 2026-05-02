const express = require("express");
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const cosSalaryController = require("../controllers/cosSalaryController");

router.use(isAuth);

router.get("/rate/:salaryGrade/:step", cosSalaryController.getRateBySalaryGradeAndStep);
router.get("/table", cosSalaryController.getTable);
router.get("/table/seed", cosSalaryController.seedTable);
router.put("/table/:id", cosSalaryController.updateRow);

module.exports = router;

