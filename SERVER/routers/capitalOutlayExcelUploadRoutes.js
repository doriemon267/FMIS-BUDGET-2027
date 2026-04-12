const express = require("express");
const multer = require("multer");
const capitalOutlayExcelUploadController = require("../controllers/capitalOutlayExcelUploadController");
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const router = express.Router();
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream"
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files are allowed."));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(tokenMiddleware);

/**
 * POST /capitaloutlay/upload
 * Upload Capital Outlay data from Excel file
 * Only Super Admin can upload
 */
router.post("/upload", upload.single("file"), (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded",
      message: "Please select an Excel file to upload"
    });
  }
  next();
}, capitalOutlayExcelUploadController.uploadCapitalOutlay);

/**
 * GET /capitaloutlay/template
 * Download Capital Outlay Excel template
 */
router.get("/template", capitalOutlayExcelUploadController.getSampleCapitalOutlayTemplate);

/**
 * GET /capitaloutlay/export
 * Export Capital Outlay data to Excel
 */
router.get("/export", capitalOutlayExcelUploadController.exportCapitalOutlayToExcel);

module.exports = router;
