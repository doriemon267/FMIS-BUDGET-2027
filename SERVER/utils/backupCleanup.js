const DatabaseBackup = require('../models/DatabaseBackup');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { getBackupStoragePath } = require('./backupPaths');
/**
 * Clean up expired backups based on retention policy
 */
const cleanupExpiredBackups = async () => {
  try {
    // const deletedCount = await DatabaseBackup.cleanupExpired();
    // return {
    //   success: true,
    //   deletedCount,
    //   message: `Successfully deleted ${deletedCount} expired backups`
    // };
  } catch (error) {
    // console.error('❌ Backup cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Backup cleanup failed'
    };
  }
};
/**
 * Clean up orphaned backup files (files without database records)
 */
const cleanupOrphanedFiles = async () => {
  try {
    // const backupDir = getBackupStoragePath();
    if (!fs.existsSync(backupDir)) {
      // return { success: true, deletedCount: 0, message: 'No backup directory found' };
    }
    const files = fs.readdirSync(backupDir);
    let deletedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.gz')) continue;
      const filePath = path.join(backupDir, file);
      // Check if this file has a corresponding database record
      const backupRecord = await DatabaseBackup.findOne({ filePath });
      if (!backupRecord) {
        // Orphaned file - delete it
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          // Failed to delete orphaned file
        }
      }
    }
    // return {
    //   success: true,
    //   deletedCount,
    //   message: `Successfully deleted ${deletedCount} orphaned backup files`
    // };
  } catch (error) {
    // console.error('❌ Orphaned file cleanup failed:', error);
    return {
      success: false,
      error: error.message,
      message: 'Orphaned file cleanup failed'
    };
  }
};
/**
 * Check backup health and report issues
 */
const checkBackupHealth = async () => {
  try {
    const healthReport = {
      totalBackups: 0,
      completedBackups: 0,
      failedBackups: 0,
      inProgressBackups: 0,
      scheduledBackups: 0,
      missingFiles: 0,
      totalSize: 0,
      issues: []
    };
    const allBackups = await DatabaseBackup.find({});
    healthReport.totalBackups = allBackups.length;
    for (const backup of allBackups) {
      // Count by status
      switch (backup.status) {
        case 'completed':
          healthReport.completedBackups++;
          break;
        case 'failed':
          healthReport.failedBackups++;
          break;
        case 'in_progress':
          healthReport.inProgressBackups++;
          break;
        case 'scheduled':
          healthReport.scheduledBackups++;
          break;
      }
      // Check if file exists for completed backups
      if (backup.status === 'completed' && backup.filePath) {
        if (fs.existsSync(backup.filePath)) {
          const stats = fs.statSync(backup.filePath);
          healthReport.totalSize += stats.size;
        } else {
          healthReport.missingFiles++;
          healthReport.issues.push(`Missing backup file: ${backup.name} (${backup.filePath})`);
        }
      }
      // Check for old in-progress backups (likely stuck)
      if (backup.status === 'in_progress') {
        const ageInHours = (new Date() - backup.createdAt) / (1000 * 60 * 60);
        if (ageInHours > 2) { // If backup has been in progress for more than 2 hours
          healthReport.issues.push(`Stuck backup detected: ${backup.name} (in progress for ${Math.round(ageInHours)} hours)`);
        }
      }
    }
    // // // // // // // // ).toFixed(2)} MB`);
    if (healthReport.issues.length > 0) {
      // healthReport.issues.forEach(issue => );
    } else {
      // No issues found
    }
    return {
      success: true,
      healthReport,
      message: 'Health check completed successfully'
    };
  } catch (error) {
    // Backup health check failed
    return {
      success: false,
      error: error.message,
      message: 'Backup health check failed'
    };
  }
};
/**
 * Get storage statistics
 */
const getStorageStats = async () => {
  try {
    const backupDir = getBackupStoragePath();
    if (!fs.existsSync(backupDir)) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null,
        averageSize: 0
      };
    }
    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.gz'));
    let totalSize = 0;
    let oldestDate = new Date();
    let newestDate = new Date(0);
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      if (stats.birthtime < oldestDate) {
        oldestDate = stats.birthtime;
      }
      if (stats.birthtime > newestDate) {
        newestDate = stats.birthtime;
      }
    }
    return {
      totalFiles: files.length,
      totalSize,
      formattedSize: formatBytes(totalSize),
      oldestBackup: files.length > 0 ? oldestDate : null,
      newestBackup: files.length > 0 ? newestDate : null,
      averageSize: files.length > 0 ? totalSize / files.length : 0,
      formattedAverageSize: files.length > 0 ? formatBytes(totalSize / files.length) : '0 B'
    };
  } catch (error) {
    // Error getting storage stats
    return null;
  }
};
/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};
/**
 * Initialize backup cleanup scheduler
 * Runs daily at 3:00 AM
 */
const initializeCleanupScheduler = () => {
  // Daily cleanup at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    const expiredCleanup = await cleanupExpiredBackups();
    const orphanedCleanup = await cleanupOrphanedFiles();
    const healthCheck = await checkBackupHealth();
    });
  // Weekly health check report (Sundays at 6:00 AM)
  cron.schedule('0 6 * * 0', async () => {
    await checkBackupHealth();
  });
  };
/**
 * Manual cleanup function that can be called from API
 */
const runManualCleanup = async () => {
  const results = {
    expiredCleanup: await cleanupExpiredBackups(),
    orphanedCleanup: await cleanupOrphanedFiles(),
    healthCheck: await checkBackupHealth(),
    storageStats: await getStorageStats()
  };
  return results;
};
module.exports = {
  cleanupExpiredBackups,
  cleanupOrphanedFiles,
  checkBackupHealth,
  getStorageStats,
  initializeCleanupScheduler,
  runManualCleanup,
  formatBytes
};