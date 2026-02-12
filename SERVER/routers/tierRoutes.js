const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

const {
  getFinalizedData,
  getTierData,
  saveTierData,
  getCurrentVersion,
  getRevisions,
  getRevisionById,
  restoreRevision,
  generateTierPDF,
  generateTierExcel,
} = require('../controllers/tierController');

router.use(tokenMiddleware);

router.get('/finalized-data', getFinalizedData);
router.get('/data', getTierData);
router.post('/data', saveTierData);
router.get('/current-version', getCurrentVersion);
router.get('/revisions', getRevisions);
router.get('/revisions/:id', getRevisionById);
router.post('/revisions/:id/restore', restoreRevision);
router.post('/generate-pdf', generateTierPDF);
router.post('/export-excel', generateTierExcel);

module.exports = router;
