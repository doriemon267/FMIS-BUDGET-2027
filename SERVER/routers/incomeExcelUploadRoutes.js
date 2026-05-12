const express = require("express");
const multer = require("multer");
const router = express.Router();
const isAuth = require('../middleware/is_auth');

const corporateIncomeController = require("../controllers/corporateIncomeController");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const { budgetRoleVisibilityControl } = require("../middleware/budgetRoleVisibilityControl");
// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Route for uploading corporate income Excel file
router.post(
	"/corporate-income/upload",
	submissionWorkflowControl('create', { strictMode: true }),
	budgetRoleVisibilityControl(),
	upload.single("file"),
	corporateIncomeController.uploadCorporateIncome
);
// Route for downloading sample template
router.get("/corporate-income/template", corporateIncomeController.generateTemplate);
// Route for getting corporate income data
router.get(
	"/corporate-income",
	submissionWorkflowControl('read'),
	budgetRoleVisibilityControl(),
	corporateIncomeController.getCorporateIncome
);
// Route for getting consolidated corporate income data
router.get(
	"/corporate-income/consolidated",
	submissionWorkflowControl('read'),
	budgetRoleVisibilityControl(),
	corporateIncomeController.getConsolidatedCorporateIncome
);
module.exports = router;
