const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');
const requireDynamicPermission = require('../middleware/requireDynamicPermission');
const { requireTierAccess } = require('../middleware/tierAccessControl');
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
router.use(requireTierAccess);
router.use(requireDynamicPermission('/tier'));

router.get('/finalized-data', getFinalizedData);
router.get('/data', getTierData);
router.get('/saved-items', getTierSavedItems);
router.post('/data', (req, res, next) => {
  const profile = req.tierAccessProfile || {};
  if (profile.isPreparer && !req.body?.proposalId) {
    return res.status(403).json({
      success: false,
      message: 'Budget Preparers can save Tier only from a linked NEP proposal'
    });
  }
  if (profile.isPreparer || profile.isAnalyst || profile.isSuperAdmin) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Tier adjustments can only be saved by the linked Budget Preparer, Budget Planning Analyst, or Super Admin.'
  });
}, logUserActivity({ action: 'UPDATE', resource: 'Tier', getDetails: (req) => ({ subAction: 'save' }) }), saveTierData);
router.get('/current-version', getCurrentVersion);
router.get('/revisions', getRevisions);
router.get('/revisions/:id', getRevisionById);
router.post('/revisions/:id/restore', (req, res, next) => {
  const profile = req.tierAccessProfile || {};
  if (profile.isAnalyst || profile.isSuperAdmin) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Only the Budget Planning Analyst or Super Admin can restore a Tier revision.'
  });
}, logUserActivity({ action: 'UPDATE', resource: 'Tier', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'restore-revision' }) }), restoreRevision);
router.post('/generate-pdf', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'PDF' }) }), generateTierPDF);
router.post('/export-excel', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'Excel' }) }), generateTierExcel);

module.exports = router;
