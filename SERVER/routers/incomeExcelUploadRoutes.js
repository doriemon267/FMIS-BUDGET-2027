const express = require("express");
const multer = require("multer");
const router = express.Router();
const checkToken = require('../middleware/check_token');
const corporateIncomeController = require("../controllers/corporateIncomeController");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(checkToken);
// Route for uploading corporate income Excel file
router.post(
	"/corporate-income/upload",
	submissionWorkflowControl('create', { strictMode: true }),
	upload.single("file"),
	corporateIncomeController.uploadCorporateIncome
);
// Route for downloading sample template
router.get("/corporate-income/template", corporateIncomeController.generateTemplate);
// Route for getting corporate income data
router.get(
	"/corporate-income",
	submissionWorkflowControl('read'),
	corporateIncomeController.getCorporateIncome
);
// Route for getting consolidated corporate income data
router.get(
	"/corporate-income/consolidated",
	submissionWorkflowControl('read'),
	corporateIncomeController.getConsolidatedCorporateIncome
);
module.exports = router;