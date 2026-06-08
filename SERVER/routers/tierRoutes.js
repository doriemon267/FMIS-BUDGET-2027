const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
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

router.use(isAuth);

router.get('/finalized-data', getFinalizedData);
router.get('/data', getTierData);
router.get('/saved-items', getTierSavedItems);
router.post('/data', requireDynamicPermission('/tier'), logUserActivity({ action: 'UPDATE', resource: 'Tier', getDetails: (req) => ({ subAction: 'save' }) }), saveTierData);
router.get('/current-version', getCurrentVersion);
router.get('/revisions', getRevisions);
router.get('/revisions/:id', getRevisionById);
router.post('/revisions/:id/restore', requireDynamicPermission('/tier'), logUserActivity({ action: 'UPDATE', resource: 'Tier', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'restore-revision' }) }), restoreRevision);
router.post('/generate-pdf', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'PDF' }) }), generateTierPDF);
router.post('/export-excel', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'Excel' }) }), generateTierExcel);

module.exports = router;

