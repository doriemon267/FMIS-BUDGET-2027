const express = require('express');
const router = express.Router();
const checkToken = require('../middleware/check_token');

const check_token_dev = require("../middleware/check_token_dev");
const check_token_prod = require("../middleware/check_token_prod");
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
const tokenMiddleware = IS_PRODUCTION ? check_token_prod : check_token_dev;

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
router.use(tokenMiddleware);
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