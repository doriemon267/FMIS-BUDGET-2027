const express = require("express");
const router = express.Router();
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
const cosSalaryController = require("../controllers/cosSalaryController");

router.use(tokenMiddleware);

router.get("/rate/:salaryGrade/:step", cosSalaryController.getRateBySalaryGradeAndStep);
router.get("/table", cosSalaryController.getTable);
router.get("/table/seed", cosSalaryController.seedTable);
router.put("/table/:id", cosSalaryController.updateRow);

module.exports = router;
