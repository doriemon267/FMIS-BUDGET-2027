const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');
const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;
const { logUserActivity } = require('../middleware/userLogs');

const {
  getFinalizedData,
  getTierData,
  getTierSavedItems,
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
router.get('/saved-items', getTierSavedItems);
router.post('/data', logUserActivity({ action: 'UPDATE', resource: 'Tier', getDetails: (req) => ({ subAction: 'save' }) }), saveTierData);
router.get('/current-version', getCurrentVersion);
router.get('/revisions', getRevisions);
router.get('/revisions/:id', getRevisionById);
router.post('/revisions/:id/restore', logUserActivity({ action: 'UPDATE', resource: 'Tier', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'restore-revision' }) }), restoreRevision);
router.post('/generate-pdf', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'PDF' }) }), generateTierPDF);
router.post('/export-excel', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'Excel' }) }), generateTierExcel);

module.exports = router;
