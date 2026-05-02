const express = require("express");
const multer = require("multer");
const isAuth = require('../middleware/is_auth');

const { uploadCorporateIncome, getSampleTemplate } = require("../controllers/incomeExcelUploadController");
const router = express.Router();
// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(isAuth);
// Upload corporate income data
router.post("/upload", upload.single("file"), uploadCorporateIncome);
// Download template
router.get("/template", getSampleTemplate);
module.exports = router;

