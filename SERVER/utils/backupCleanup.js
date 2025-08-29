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
    // console.log('🧹 Starting backup cleanup process...');
    
    const deletedCount = await DatabaseBackup.cleanupExpired();
    
    // console.log(`✅ Backup cleanup completed. Deleted ${deletedCount} expired backups.`);
    
    return {
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} expired backups`
    };
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
    // console.log('🔍 Checking for orphaned backup files...');
    
    const backupDir = getBackupStoragePath();
    if (!fs.existsSync(backupDir)) {
      // console.log('📁 Backup directory does not exist, skipping orphaned file cleanup');
      return { success: true, deletedCount: 0, message: 'No backup directory found' };
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
          // console.log(`🗑️ Deleted orphaned backup file: ${file}`);
        } catch (error) {
          // console.error(`❌ Failed to delete orphaned file ${file}:`, error.message);
        }
      }
    }
    
    // console.log(`✅ Orphaned file cleanup completed. Deleted ${deletedCount} files.`);
    
    return {
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} orphaned backup files`
    };
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
    // console.log('🏥 Performing backup health check...');
    
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
    
    // console.log('📊 Backup Health Report:');
    // console.log(`   Total Backups: ${healthReport.totalBackups}`);
    // console.log(`   Completed: ${healthReport.completedBackups}`);
    // console.log(`   Failed: ${healthReport.failedBackups}`);
    // console.log(`   In Progress: ${healthReport.inProgressBackups}`);
    // console.log(`   Scheduled: ${healthReport.scheduledBackups}`);
    // console.log(`   Missing Files: ${healthReport.missingFiles}`);
    // console.log(`   Total Size: ${(healthReport.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    
    if (healthReport.issues.length > 0) {
      // console.log('⚠️ Issues found:');
      healthReport.issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      // console.log('✅ No issues found');
    }
    
    return {
      success: true,
      healthReport,
      message: 'Health check completed successfully'
    };
  } catch (error) {
    console.error('❌ Backup health check failed:', error);
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
    console.error('Error getting storage stats:', error);
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
  console.log('⏰ Initializing backup cleanup scheduler...');
  
  // Daily cleanup at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('🕒 Running scheduled backup cleanup...');
    
    const expiredCleanup = await cleanupExpiredBackups();
    const orphanedCleanup = await cleanupOrphanedFiles();
    const healthCheck = await checkBackupHealth();
    
    console.log('📋 Scheduled cleanup summary:');
    console.log(`   Expired backups deleted: ${expiredCleanup.deletedCount || 0}`);
    console.log(`   Orphaned files deleted: ${orphanedCleanup.deletedCount || 0}`);
    console.log(`   Health check: ${healthCheck.success ? 'PASSED' : 'FAILED'}`);
  });
  
  // Weekly health check report (Sundays at 6:00 AM)
  cron.schedule('0 6 * * 0', async () => {
    console.log('📊 Running weekly backup health report...');
    await checkBackupHealth();
  });
  
  console.log('✅ Backup cleanup scheduler initialized');
};

/**
 * Manual cleanup function that can be called from API
 */
const runManualCleanup = async () => {
  console.log('🔧 Running manual backup cleanup...');
  
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