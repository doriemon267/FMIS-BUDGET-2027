const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is_auth');

const {
  createBackup,
  scheduleBackup,
  getBackupHistory,
  getBackupSettings,
  updateBackupSettings,
  deleteBackup,
  restoreBackup,
  downloadBackup,
  getBackupStatus,
  cleanupBackups,
  getStorageStatistics,
  verifyBackup
} = require('../controllers/databaseBackupController');
// Apply authentication to all database backup routes
router.use(isAuth);

// Super Admin only — all backup operations are restricted to Super Admins
const superAdminOnly = (req, res, next) => {
  const roles = (req.user?.Roles || []).map(r =>
    String(r || '').trim().replace(/\s+/g, '_').toUpperCase()
  );
  const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('SUPERADMIN');
  if (!isSuperAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super Admin role required for database backup operations.'
    });
  }
  return next();
};
router.use(superAdminOnly);

// Create manual backup
router.post('/backup/create', createBackup);
// Schedule backup
router.post('/backup/schedule', scheduleBackup);
// Get backup history
router.get('/backup/history', getBackupHistory);
// Get backup settings
router.get('/backup/settings', getBackupSettings);
// Update backup settings
router.put('/backup/settings', updateBackupSettings);
// Delete backup
router.delete('/backup/:id', deleteBackup);
// Restore from backup
router.post('/backup/restore/:id', restoreBackup);
// Download backup file
router.get('/backup/download/:id', downloadBackup);
// Get backup status
router.get('/backup/status', getBackupStatus);
// Cleanup expired backups
router.post('/backup/cleanup', cleanupBackups);
// Get storage statistics
router.get('/backup/storage-stats', getStorageStatistics);
// Verify backup integrity (returns report with summary.recommendations)
router.get('/backup/verify/:id', verifyBackup);
module.exports = router;
