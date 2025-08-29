const express = require("express");
const multer = require("multer");
const router = express.Router();
const checkToken = require('../middleware/checkToken');
const corporateIncomeController = require("../controllers/corporateIncomeController");

// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Apply authentication middleware to all routes in this router
router.use(checkToken);

// Route for uploading corporate income Excel file
router.post("/corporate-income/upload", upload.single("file"), corporateIncomeController.uploadCorporateIncome);

// Route for downloading sample template
router.get("/corporate-income/template", corporateIncomeController.generateTemplate);

// Route for getting corporate income data
router.get("/corporate-income", corporateIncomeController.getCorporateIncome);

// Route for getting consolidated corporate income data
router.get("/corporate-income/consolidated", corporateIncomeController.getConsolidatedCorporateIncome);

module.exports = router;