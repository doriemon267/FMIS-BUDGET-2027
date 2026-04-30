const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const cosSalaryController = require("../controllers/cosSalaryController");

router.use(authMiddleware);

router.get("/rate/:salaryGrade/:step", cosSalaryController.getRateBySalaryGradeAndStep);
router.get("/table", cosSalaryController.getTable);
router.get("/table/seed", cosSalaryController.seedTable);
router.put("/table/:id", cosSalaryController.updateRow);

module.exports = router;
