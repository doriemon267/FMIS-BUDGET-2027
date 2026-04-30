const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");

const mooeExcelUploadController = require("../controllers/mooeExcelUploadController");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(authMiddleware);
// Route for uploading MOOE Excel file
router.post("/mooe/upload", upload.single("file"), mooeExcelUploadController.uploadMooe);
// Route for downloading sample template
router.get("/mooe/template", mooeExcelUploadController.getSampleMooeTemplate);
module.exports = router;
