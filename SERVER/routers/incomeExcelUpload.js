const express = require("express");
const multer = require("multer");
const checkToken = require("../middleware/check_token");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const { uploadCorporateIncome, getSampleTemplate } = require("../controllers/incomeExcelUploadController");
const router = express.Router();
// Configure Multer (Store file in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Upload corporate income data
router.post("/upload", upload.single("file"), uploadCorporateIncome);
// Download template
router.get("/template", getSampleTemplate);
module.exports = router;
