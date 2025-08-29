const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/checkToken');
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
  getStorageStatistics
} = require('../controllers/databaseBackupController');

// Apply authentication to all database backup routes
router.use(checkToken);

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

module.exports = router;