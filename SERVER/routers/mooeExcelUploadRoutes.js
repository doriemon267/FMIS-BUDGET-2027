const express = require("express");
const multer = require("multer");
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const mooeExcelUploadController = require("../controllers/mooeExcelUploadController");
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
// Apply authentication middleware to all routes in this router
router.use(tokenMiddleware);
// Route for uploading MOOE Excel file
router.post("/mooe/upload", upload.single("file"), mooeExcelUploadController.uploadMooe);
// Route for downloading sample template
router.get("/mooe/template", mooeExcelUploadController.getSampleMooeTemplate);
module.exports = router;
