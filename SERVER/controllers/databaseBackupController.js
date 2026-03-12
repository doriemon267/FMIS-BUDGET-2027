const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');
const mongoose = require('mongoose');
const DatabaseBackup = require('../models/DatabaseBackup');
const archiver = require('archiver');
const { runManualCleanup, getStorageStats, checkBackupHealth } = require('../utils/backupCleanup');
const progressTracker = require('../utils/backupProgress');
const { getBackupFilePath, ensureBackupDirectory, getBackupStoragePath } = require('../utils/backupPaths');
const { generateBackupReport } = require('../utils/backupVerification');
// Store active backup processes
const activeBackups = new Map();
const scheduledJobs = new Map();
// Create manual backup
const createBackup = async (req, res) => {
  try {
    const { description, type = 'manual' } = req.body;
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}`;
    const backupPath = getBackupFilePath(`${backupName}.gz`);
    // Ensure backup directory exists (handled by getBackupFilePath)
    ensureBackupDirectory();
    // Create backup record
    const backup = new DatabaseBackup({
      name: backupName,
      description: description || `${type} backup created on ${new Date().toLocaleString()}`,
      type,
      status: 'in_progress',
      filePath: backupPath,
      createdBy: req.user?.id || 'system'
    });
    await backup.save();
    // Set backup as active
    activeBackups.set(backup._id.toString(), { status: 'in_progress', progress: 0 });
    // Get MongoDB connection details from environment or mongoose connection
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017';
    const dbName = mongoose.connection.db.databaseName;
    // Parse MongoDB URI to extract connection details for mongodump
    let dumpCommand;
    try {
      const url = new URL(mongoUri);
      // Build mongodump command with proper connection details
      const hostPart = url.hostname !== 'localhost' ? `--host ${url.hostname}` : '';
      const portPart = url.port ? `--port ${url.port}` : '';
      const userPart = url.username ? `--username ${url.username}` : '';
      const passwordPart = url.password ? `--password ${url.password}` : '';
      const authDbPart = url.searchParams.get('authSource') ? `--authenticationDatabase ${url.searchParams.get('authSource')}` : '';
      dumpCommand = `mongodump --db ${dbName} ${hostPart} ${portPart} ${userPart} ${passwordPart} ${authDbPart} --archive=${backupPath} --gzip`.replace(/\s+/g, ' ').trim();
    } catch (uriError) {
      // Fallback for simple connection strings
      dumpCommand = `mongodump --db ${dbName} --archive=${backupPath} --gzip`;
    }
    // Execute backup
    const childProcess = exec(dumpCommand, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('Backup error:', error);
          backup.status = 'failed';
          backup.error = error.message;
          activeBackups.delete(backup._id.toString());
        } else {
          // Get file size
          const stats = fs.statSync(backupPath);
          backup.size = stats.size;
          backup.status = 'completed';
          backup.completedAt = new Date();
          activeBackups.delete(backup._id.toString());
        }
        await backup.save();
      } catch (saveError) {
        console.error('Error saving backup status:', saveError);
      }
    });
    // Update progress periodically
    const progressInterval = setInterval(() => {
      if (activeBackups.has(backup._id.toString())) {
        const currentProgress = activeBackups.get(backup._id.toString()).progress;
        if (currentProgress < 90) {
          activeBackups.set(backup._id.toString(), { 
            status: 'in_progress', 
            progress: Math.min(currentProgress + 10, 90) 
          });
        }
      } else {
        clearInterval(progressInterval);
      }
    }, 1000);
    res.status(200).json({
      success: true,
      message: 'Backup started successfully',
      backupId: backup._id,
      data: backup
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
};
// Schedule backup
const scheduleBackup = async (req, res) => {
  try {
    const { schedule, description, enabled = true } = req.body;
    // Validate cron expression
    if (!cron.validate(schedule)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cron schedule format'
      });
    }
    // Create scheduled backup record
    const scheduledBackup = new DatabaseBackup({
      name: `scheduled_backup_${Date.now()}`,
      description: description || 'Scheduled backup',
      type: 'scheduled',
      status: 'scheduled',
      schedule,
      enabled,
      createdBy: req.user?.id || 'system'
    });
    await scheduledBackup.save();
    if (enabled) {
      // Create cron job
      const task = cron.schedule(schedule, async () => {
        try {
          // Trigger backup creation
          await createScheduledBackup(scheduledBackup._id);
        } catch (error) {
          console.error('Scheduled backup failed:', error);
        }
      }, {
        scheduled: false
      });
      // Store the job
      scheduledJobs.set(scheduledBackup._id.toString(), task);
      task.start();
    }
    res.status(200).json({
      success: true,
      message: 'Backup scheduled successfully',
      data: scheduledBackup
    });
  } catch (error) {
    console.error('Error scheduling backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule backup',
      error: error.message
    });
  }
};
// Helper function for scheduled backups
const createScheduledBackup = async (scheduledBackupId) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `scheduled_backup_${timestamp}`;
    const backupPath = getBackupFilePath(`${backupName}.gz`);
    ensureBackupDirectory();
    const backup = new DatabaseBackup({
      name: backupName,
      description: `Scheduled backup created on ${new Date().toLocaleString()}`,
      type: 'scheduled',
      status: 'in_progress',
      filePath: backupPath,
      parentScheduleId: scheduledBackupId,
      createdBy: 'system'
    });
    await backup.save();
    // Get MongoDB connection details from environment or mongoose connection
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017';
    const dbName = mongoose.connection.db.databaseName;
    // Parse MongoDB URI to extract connection details for mongodump
    let dumpCommand;
    try {
      const url = new URL(mongoUri);
      // Build mongodump command with proper connection details
      const hostPart = url.hostname !== 'localhost' ? `--host ${url.hostname}` : '';
      const portPart = url.port ? `--port ${url.port}` : '';
      const userPart = url.username ? `--username ${url.username}` : '';
      const passwordPart = url.password ? `--password ${url.password}` : '';
      const authDbPart = url.searchParams.get('authSource') ? `--authenticationDatabase ${url.searchParams.get('authSource')}` : '';
      dumpCommand = `mongodump --db ${dbName} ${hostPart} ${portPart} ${userPart} ${passwordPart} ${authDbPart} --archive=${backupPath} --gzip`.replace(/\s+/g, ' ').trim();
    } catch (uriError) {
      // Fallback for simple connection strings
      dumpCommand = `mongodump --db ${dbName} --archive=${backupPath} --gzip`;
    }
    exec(dumpCommand, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('Scheduled backup error:', error);
          backup.status = 'failed';
          backup.error = error.message;
        } else {
          const stats = fs.statSync(backupPath);
          backup.size = stats.size;
          backup.status = 'completed';
          backup.completedAt = new Date();
        }
        await backup.save();
      } catch (saveError) {
        console.error('Error saving scheduled backup status:', saveError);
      }
    });
  } catch (error) {
    console.error('Error creating scheduled backup:', error);
  }
};
// Get backup history
const getBackupHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, status } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const backups = await DatabaseBackup.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    const total = await DatabaseBackup.countDocuments(query);
    res.status(200).json({
      success: true,
      data: backups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup history',
      error: error.message
    });
  }
};
// Get backup settings
const getBackupSettings = async (req, res) => {
  try {
    // Get scheduled backups
    const scheduledBackups = await DatabaseBackup.find({ type: 'scheduled' })
      .sort({ createdAt: -1 });
    // Get backup statistics
    const stats = await DatabaseBackup.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' }
        }
      }
    ]);
    // Get recent backups
    const recentBackups = await DatabaseBackup.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5);
    res.status(200).json({
      success: true,
      data: {
        scheduledBackups,
        statistics: stats,
        recentBackups,
        backupDirectory: getBackupStoragePath()
      }
    });
  } catch (error) {
    console.error('Error fetching backup settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup settings',
      error: error.message
    });
  }
};
// Update backup settings
const updateBackupSettings = async (req, res) => {
  try {
    const id = req.params?.id || req.body?.id;
    const { schedule, description, enabled } = req.body;

    let backup = null;
    if (id) {
      backup = await DatabaseBackup.findById(id);
    } else {
      backup = await DatabaseBackup.findOne({ type: 'scheduled' }).sort({ createdAt: -1 });
    }

    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup configuration not found'
      });
    }

    if (schedule && !cron.validate(schedule)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cron schedule format'
      });
    }

    // Update backup settings
    if (schedule) backup.schedule = schedule;
    if (description) backup.description = description;
    if (enabled !== undefined) backup.enabled = enabled;
    await backup.save();

    const jobKey = backup._id.toString();

    // Update cron job
    if (scheduledJobs.has(jobKey)) {
      const existingJob = scheduledJobs.get(jobKey);
      existingJob.stop();
      scheduledJobs.delete(jobKey);
    }

    if (backup.enabled && backup.schedule) {
      const task = cron.schedule(backup.schedule, async () => {
        await createScheduledBackup(backup._id);
      }, { scheduled: false });
      scheduledJobs.set(jobKey, task);
      task.start();
    }
    res.status(200).json({
      success: true,
      message: 'Backup settings updated successfully',
      data: backup
    });
  } catch (error) {
    console.error('Error updating backup settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update backup settings',
      error: error.message
    });
  }
};
// Delete backup
const deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await DatabaseBackup.findById(id);
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    // Delete backup file if it exists
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }
    // Stop scheduled job if it's a scheduled backup
    if (backup.type === 'scheduled' && scheduledJobs.has(id)) {
      const job = scheduledJobs.get(id);
      job.stop();
      scheduledJobs.delete(id);
    }
    await DatabaseBackup.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error.message
    });
  }
};
// Restore from backup
const restoreBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmRestore } = req.body;
    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Restore operation must be confirmed'
      });
    }
    const backup = await DatabaseBackup.findById(id);
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    if (!fs.existsSync(backup.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }
    // Create a backup of current state before restore
    const preRestoreBackup = new DatabaseBackup({
      name: `pre_restore_backup_${Date.now()}`,
      description: `Backup created before restore operation on ${new Date().toLocaleString()}`,
      type: 'pre_restore',
      status: 'in_progress',
      createdBy: req.user?.id || 'system'
    });
    await preRestoreBackup.save();
    // Get MongoDB connection details from environment or mongoose connection
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL || 'mongodb://localhost:27017';
    const dbName = mongoose.connection.db.databaseName;
    // Parse MongoDB URI to extract connection details for mongorestore
    let restoreCommand;
    try {
      const url = new URL(mongoUri);
      // Build mongorestore command with proper connection details
      const hostPart = url.hostname !== 'localhost' ? `--host ${url.hostname}` : '';
      const portPart = url.port ? `--port ${url.port}` : '';
      const userPart = url.username ? `--username ${url.username}` : '';
      const passwordPart = url.password ? `--password ${url.password}` : '';
      const authDbPart = url.searchParams.get('authSource') ? `--authenticationDatabase ${url.searchParams.get('authSource')}` : '';
      restoreCommand = `mongorestore --db ${dbName} ${hostPart} ${portPart} ${userPart} ${passwordPart} ${authDbPart} --archive=${backup.filePath} --gzip --drop`.replace(/\s+/g, ' ').trim();
    } catch (uriError) {
      // Fallback for simple connection strings
      restoreCommand = `mongorestore --db ${dbName} --archive=${backup.filePath} --gzip --drop`;
    }
    exec(restoreCommand, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('Restore error:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to restore backup',
            error: error.message
          });
        }
        // Update restore record
        backup.lastRestored = new Date();
        backup.restoredBy = req.user?.id || 'system';
        await backup.save();
        res.status(200).json({
          success: true,
          message: 'Database restored successfully',
          data: backup
        });
      } catch (saveError) {
        console.error('Error updating restore record:', saveError);
        res.status(500).json({
          success: false,
          message: 'Restore completed but failed to update record',
          error: saveError.message
        });
      }
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore backup',
      error: error.message
    });
  }
};
// Download backup file
const downloadBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await DatabaseBackup.findById(id);
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    if (!fs.existsSync(backup.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }
    const filename = `${backup.name}.gz`;
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/gzip');
    const fileStream = fs.createReadStream(backup.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download backup',
      error: error.message
    });
  }
};
// Get backup status
const getBackupStatus = async (req, res) => {
  try {
    const activeBackupsList = Array.from(activeBackups.entries()).map(([id, status]) => ({
      id,
      ...status
    }));
    const scheduledJobsList = Array.from(scheduledJobs.keys()).map(id => ({
      id,
      status: 'scheduled',
      nextRun: 'calculated_based_on_cron' // You can implement cron next run calculation
    }));
    // Get additional data from progress tracker
    const trackedActiveBackups = progressTracker.getAllActiveBackups();
    const recentCompleted = progressTracker.getRecentCompletedBackups(5);
    const statistics = progressTracker.getStatistics();
    res.status(200).json({
      success: true,
      data: {
        activeBackups: activeBackupsList,
        scheduledJobs: scheduledJobsList,
        totalActiveBackups: activeBackups.size,
        totalScheduledJobs: scheduledJobs.size,
        trackedBackups: trackedActiveBackups,
        recentCompleted,
        statistics
      }
    });
  } catch (error) {
    console.error('Error fetching backup status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backup status',
      error: error.message
    });
  }
};
// Cleanup expired backups
const cleanupBackups = async (req, res) => {
  try {
    const results = await runManualCleanup();
    res.status(200).json({
      success: true,
      message: 'Backup cleanup completed successfully',
      data: results
    });
  } catch (error) {
    console.error('Error during backup cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup backups',
      error: error.message
    });
  }
};
// Get storage statistics
const getStorageStatistics = async (req, res) => {
  try {
    const stats = await getStorageStats();
    const healthReport = await checkBackupHealth();
    res.status(200).json({
      success: true,
      data: {
        storage: stats,
        health: healthReport.healthReport
      }
    });
  } catch (error) {
    console.error('Error fetching storage statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage statistics',
      error: error.message
    });
  }
};
// Initialize scheduled jobs from database
const initializeScheduledJobs = async () => {
  try {
    const scheduledBackups = await DatabaseBackup.find({ type: 'scheduled', enabled: true });
    console.log(`[Backup] Initializing ${scheduledBackups.length} scheduled backup jobs`);
    
    for (const backup of scheduledBackups) {
      if (backup.schedule && cron.validate(backup.schedule)) {
        const task = cron.schedule(backup.schedule, async () => {
          try {
            await createScheduledBackup(backup._id);
          } catch (error) {
            console.error(`[Backup] Scheduled job failed for ${backup.name}:`, error);
          }
        }, {
          scheduled: false
        });
        
        scheduledJobs.set(backup._id.toString(), task);
        task.start();
      }
    }
  } catch (error) {
    console.error('[Backup] Failed to initialize scheduled jobs:', error);
  }
};

/**
 * Verify backup integrity and return report with recommendations (data/API only).
 * GET /backup/verify/:id returns report.summary.recommendations for clients to display or log.
 */
const verifyBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await DatabaseBackup.findById(id);
    if (!backup) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }
    if (backup.status !== 'completed' || !backup.filePath) {
      return res.status(400).json({
        success: false,
        message: 'Backup is not completed or has no file path',
        recommendations: ['Create a new backup and verify again.']
      });
    }
    if (!fs.existsSync(backup.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on disk',
        recommendations: ['Backup record exists but file is missing. Create a new backup.']
      });
    }
    const report = await generateBackupReport(backup.filePath);
    return res.status(200).json({
      success: true,
      data: report,
      summary: report.summary,
      recommendations: report.summary?.recommendations || []
    });
  } catch (error) {
    console.error('Error verifying backup:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify backup',
      error: error.message,
      recommendations: ['Check server logs; consider recreating the backup.']
    });
  }
};

module.exports = {
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
  verifyBackup,
  initializeScheduledJobs
};