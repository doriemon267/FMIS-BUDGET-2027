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
router.post('/data', (req, res, next) => {
  // Bypass dynamic permission for valid budget roles who need to save NEP adjustments
  const rawRoles = Array.isArray(req.user?.Roles)
    ? req.user.Roles
    : [req.user?.Roles].filter(Boolean);
  const userRoles = rawRoles.map(r => String(r).toUpperCase().replace(/\s+/g, '_'));
  const allowedRoles = ['BUDGET_PLANNING_ANALYST', 'SUPER_ADMIN'];
  if (userRoles.includes('BUDGET_PREPARER') && !req.body?.proposalId) {
    return res.status(403).json({
      success: false,
      message: 'Budget Preparers can save Tier only from a linked NEP proposal'
    });
  }
  if (userRoles.includes('BUDGET_PREPARER')) {
    return next();
  }
  if (userRoles.some(role => allowedRoles.includes(role))) {
    return next();
  }
  return requireDynamicPermission('/tier')(req, res, next);
}, logUserActivity({ action: 'UPDATE', resource: 'Tier', getDetails: (req) => ({ subAction: 'save' }) }), saveTierData);
router.get('/current-version', getCurrentVersion);
router.get('/revisions', getRevisions);
router.get('/revisions/:id', getRevisionById);
router.post('/revisions/:id/restore', (req, res, next) => {
  const rawRoles = Array.isArray(req.user?.Roles)
    ? req.user.Roles
    : [req.user?.Roles].filter(Boolean);
  const userRoles = rawRoles.map(r => String(r).toUpperCase().replace(/\s+/g, '_'));
  const allowedRoles = ['BUDGET_PLANNING_ANALYST', 'SUPER_ADMIN'];
  if (userRoles.some(role => allowedRoles.includes(role))) {
    return next();
  }
  return requireDynamicPermission('/tier')(req, res, next);
}, logUserActivity({ action: 'UPDATE', resource: 'Tier', getResourceId: (req) => req.params.id, getDetails: () => ({ subAction: 'restore-revision' }) }), restoreRevision);
router.post('/generate-pdf', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'PDF' }) }), generateTierPDF);
router.post('/export-excel', logUserActivity({ action: 'EXPORT', resource: 'Tier', getDetails: () => ({ format: 'Excel' }) }), generateTierExcel);

module.exports = router;
