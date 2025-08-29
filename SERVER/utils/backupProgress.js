const EventEmitter = require('events');

class BackupProgressTracker extends EventEmitter {
  constructor() {
    super();
    this.activeBackups = new Map();
    this.completedBackups = new Map();
  }

  /**
   * Start tracking a backup operation
   */
  startBackup(backupId, metadata = {}) {
    const backupInfo = {
      id: backupId,
      startTime: new Date(),
      status: 'starting',
      progress: 0,
      currentStep: 'Initializing backup...',
      totalSteps: 5,
      currentStepNumber: 0,
      estimatedTimeRemaining: null,
      speed: null,
      metadata: {
        type: metadata.type || 'manual',
        description: metadata.description || '',
        estimatedSize: metadata.estimatedSize || null,
        ...metadata
      },
      steps: [
        'Initializing backup...',
        'Connecting to database...',
        'Exporting collections...',
        'Compressing data...',
        'Finalizing backup...'
      ],
      logs: []
    };

    this.activeBackups.set(backupId, backupInfo);
    this.emit('backupStarted', backupInfo);
    
    // console.log(`📋 Started tracking backup: ${backupId}`);
    return backupInfo;
  }

  /**
   * Update backup progress
   */
  updateProgress(backupId, progress, currentStep = null, additionalInfo = {}) {
    const backup = this.activeBackups.get(backupId);
    if (!backup) {
      // console.warn(`⚠️ Attempted to update non-existent backup: ${backupId}`);
      return null;
    }

    const previousProgress = backup.progress;
    const now = new Date();
    
    // Calculate speed and ETA
    const timeElapsed = (now - backup.startTime) / 1000; // seconds
    const progressDelta = progress - previousProgress;
    
    if (progressDelta > 0 && timeElapsed > 0) {
      backup.speed = (progressDelta / timeElapsed).toFixed(2) + '%/sec';
      
      if (progress < 100) {
        const remainingProgress = 100 - progress;
        const estimatedRemainingTime = (remainingProgress / progressDelta) * timeElapsed;
        backup.estimatedTimeRemaining = this.formatDuration(estimatedRemainingTime);
      }
    }

    // Update backup info
    backup.progress = Math.min(100, Math.max(0, progress));
    backup.lastUpdate = now;
    
    if (currentStep) {
      backup.currentStep = currentStep;
      
      // Update step number based on current step
      const stepIndex = backup.steps.indexOf(currentStep);
      if (stepIndex !== -1) {
        backup.currentStepNumber = stepIndex + 1;
      }
    }

    // Add additional info
    Object.assign(backup, additionalInfo);

    // Add log entry
    backup.logs.push({
      timestamp: now,
      progress: backup.progress,
      step: backup.currentStep,
      message: additionalInfo.message || `Progress: ${backup.progress.toFixed(1)}%`
    });

    // Keep only last 50 log entries
    if (backup.logs.length > 50) {
      backup.logs = backup.logs.slice(-50);
    }

    this.emit('progressUpdated', backup);
    
    return backup;
  }

  /**
   * Complete a backup operation
   */
  completeBackup(backupId, result = {}) {
    const backup = this.activeBackups.get(backupId);
    if (!backup) {
      // console.warn(`⚠️ Attempted to complete non-existent backup: ${backupId}`);
      return null;
    }

    backup.endTime = new Date();
    backup.duration = ((backup.endTime - backup.startTime) / 1000).toFixed(2) + ' seconds';
    backup.status = result.success ? 'completed' : 'failed';
    backup.progress = result.success ? 100 : backup.progress;
    backup.currentStep = result.success ? 'Backup completed successfully' : 'Backup failed';
    backup.result = result;

    // Add final log entry
    backup.logs.push({
      timestamp: backup.endTime,
      progress: backup.progress,
      step: backup.currentStep,
      message: result.success ? 'Backup completed successfully' : `Backup failed: ${result.error || 'Unknown error'}`
    });

    // Move to completed backups
    this.completedBackups.set(backupId, backup);
    this.activeBackups.delete(backupId);

    this.emit('backupCompleted', backup);
    
    // console.log(`✅ Completed tracking backup: ${backupId} (${backup.status})`);
    return backup;
  }

  /**
   * Fail a backup operation
   */
  failBackup(backupId, error) {
    return this.completeBackup(backupId, {
      success: false,
      error: error.message || error,
      errorDetails: error
    });
  }

  /**
   * Get active backup info
   */
  getActiveBackup(backupId) {
    return this.activeBackups.get(backupId);
  }

  /**
   * Get all active backups
   */
  getAllActiveBackups() {
    return Array.from(this.activeBackups.values());
  }

  /**
   * Get completed backup info
   */
  getCompletedBackup(backupId) {
    return this.completedBackups.get(backupId);
  }

  /**
   * Get recent completed backups
   */
  getRecentCompletedBackups(limit = 10) {
    const completed = Array.from(this.completedBackups.values());
    return completed.sort((a, b) => b.endTime - a.endTime).slice(0, limit);
  }

  /**
   * Cancel a backup operation
   */
  cancelBackup(backupId, reason = 'Cancelled by user') {
    const backup = this.activeBackups.get(backupId);
    if (!backup) {
      return null;
    }

    backup.status = 'cancelled';
    backup.currentStep = 'Backup cancelled';
    backup.cancelReason = reason;
    backup.endTime = new Date();
    backup.duration = ((backup.endTime - backup.startTime) / 1000).toFixed(2) + ' seconds';

    backup.logs.push({
      timestamp: backup.endTime,
      progress: backup.progress,
      step: backup.currentStep,
      message: `Backup cancelled: ${reason}`
    });

    this.completedBackups.set(backupId, backup);
    this.activeBackups.delete(backupId);

    this.emit('backupCancelled', backup);
    
    // console.log(`🚫 Cancelled backup: ${backupId} - ${reason}`);
    return backup;
  }

  /**
   * Get backup statistics
   */
  getStatistics() {
    const active = this.getAllActiveBackups();
    const recentCompleted = this.getRecentCompletedBackups(50);
    
    const stats = {
      active: {
        count: active.length,
        backups: active
      },
      recent: {
        count: recentCompleted.length,
        successful: recentCompleted.filter(b => b.status === 'completed').length,
        failed: recentCompleted.filter(b => b.status === 'failed').length,
        cancelled: recentCompleted.filter(b => b.status === 'cancelled').length
      },
      performance: {
        averageDuration: this.calculateAverageDuration(recentCompleted),
        successRate: this.calculateSuccessRate(recentCompleted),
        totalBackupsTracked: this.activeBackups.size + this.completedBackups.size
      }
    };

    return stats;
  }

  /**
   * Calculate average duration of completed backups
   */
  calculateAverageDuration(backups) {
    const completed = backups.filter(b => b.duration && b.status === 'completed');
    if (completed.length === 0) return '0 seconds';

    const totalSeconds = completed.reduce((sum, backup) => {
      const seconds = parseFloat(backup.duration.replace(' seconds', ''));
      return sum + seconds;
    }, 0);

    const averageSeconds = totalSeconds / completed.length;
    return this.formatDuration(averageSeconds);
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate(backups) {
    if (backups.length === 0) return '0%';
    
    const successful = backups.filter(b => b.status === 'completed').length;
    const rate = (successful / backups.length) * 100;
    return rate.toFixed(1) + '%';
  }

  /**
   * Format duration in seconds to human readable format
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return Math.round(seconds) + ' seconds';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Clean up old completed backups (keep last 100)
   */
  cleanup() {
    const completedArray = Array.from(this.completedBackups.entries());
    if (completedArray.length > 100) {
      // Sort by end time and keep the most recent 100
      completedArray.sort((a, b) => b[1].endTime - a[1].endTime);
      
      // Clear the map and add back the most recent 100
      this.completedBackups.clear();
      completedArray.slice(0, 100).forEach(([id, backup]) => {
        this.completedBackups.set(id, backup);
      });
      
      // console.log(`🧹 Cleaned up old backup tracking records, kept ${this.completedBackups.size} recent entries`);
    }
  }

  /**
   * Export tracking data for persistence
   */
  exportData() {
    return {
      activeBackups: Array.from(this.activeBackups.entries()),
      completedBackups: Array.from(this.completedBackups.entries()),
      exportedAt: new Date()
    };
  }

  /**
   * Import tracking data
   */
  importData(data) {
    if (data.activeBackups) {
      this.activeBackups = new Map(data.activeBackups);
    }
    if (data.completedBackups) {
      this.completedBackups = new Map(data.completedBackups);
    }
    // console.log(`📥 Imported tracking data: ${this.activeBackups.size} active, ${this.completedBackups.size} completed`);
  }
}

// Singleton instance
const progressTracker = new BackupProgressTracker();

// Auto cleanup every hour
setInterval(() => {
  progressTracker.cleanup();
}, 60 * 60 * 1000);

module.exports = progressTracker;