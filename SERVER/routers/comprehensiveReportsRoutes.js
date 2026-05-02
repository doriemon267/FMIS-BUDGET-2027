const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');

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
router.use(isAuth);
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
