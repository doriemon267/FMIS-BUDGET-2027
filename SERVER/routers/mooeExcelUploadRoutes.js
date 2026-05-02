const express = require("express");
const multer = require("multer");
const isAuth = require('../middleware/is_auth');

const mooeExcelUploadController = require("../controllers/mooeExcelUploadController");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Route for uploading MOOE Excel file
router.post("/mooe/upload", upload.single("file"), mooeExcelUploadController.uploadMooe);
// Route for downloading sample template
router.get("/mooe/template", mooeExcelUploadController.getSampleMooeTemplate);
module.exports = router;

