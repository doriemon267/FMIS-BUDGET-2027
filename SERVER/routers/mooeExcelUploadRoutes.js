const express = require("express");
const multer = require("multer");
const isAuth = require('../middleware/is_auth');

const mooeExcelUploadController = require("../controllers/mooeExcelUploadController");
const { submissionWorkflowControl } = require("../middleware/submissionWorkflowControl");
const { budgetRoleVisibilityControl } = require("../middleware/budgetRoleVisibilityControl");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Route for uploading MOOE Excel file
router.post(
	"/mooe/upload",
	submissionWorkflowControl('create', { strictMode: true }),
	budgetRoleVisibilityControl(),
	upload.single("file"),
	mooeExcelUploadController.uploadMooe
);
// Route for downloading sample template
router.get("/mooe/template", mooeExcelUploadController.getSampleMooeTemplate);
module.exports = router;

