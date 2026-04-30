const express = require('express');
const router = express.Router();

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getComprehensiveReportData,
  getAvailableRegionsComprehensive,
  getAvailableOfficesComprehensive,
  getAvailableResponsibilityCentersComprehensive,
  getAvailableFiscalYears,
  getAvailableBudgetTypes,
  getActiveSettings,
  getComprehensiveReportPdf,
  verifyDocument,
  verifyDocumentUpload
} = require('../controllers/comprehensiveReportsController');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Public route for verifying documents
router.get('/verify/:documentId', verifyDocument);
router.post('/verify-upload', upload.single('pdfFile'), verifyDocumentUpload);

// Apply authentication middleware to all routes below in this router
router.use(tokenMiddleware);
// Routes for comprehensive reports
router.get('/comprehensive-data', getComprehensiveReportData);
router.get('/available-regions-comprehensive', getAvailableRegionsComprehensive);
router.get('/available-offices-comprehensive', getAvailableOfficesComprehensive);
router.get('/available-responsibility-centers-comprehensive', getAvailableResponsibilityCentersComprehensive);
router.get('/available-fiscal-years', getAvailableFiscalYears);
router.get('/available-budget-types', getAvailableBudgetTypes);
router.get('/active-settings', getActiveSettings);
router.get('/comprehensive-pdf', getComprehensiveReportPdf);
module.exports = router;