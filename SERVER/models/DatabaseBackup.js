const mongoose = require('mongoose');
const databaseBackupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['manual', 'scheduled', 'pre_restore', 'auto'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'in_progress'
  },
  filePath: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 0
  },
  schedule: {
    type: String, // Cron expression
    default: ''
  },
  enabled: {
    type: Boolean,
    default: true
  },
  parentScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DatabaseBackup',
    default: null
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  lastRestored: {
    type: Date,
    default: null
  },
  restoredBy: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  retentionDays: {
    type: Number,
    default: 30 // Keep backups for 30 days by default
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    databaseName: String,
    collections: [String],
    totalDocuments: Number,
    compressionRatio: Number
  }
}, {
  timestamps: true
});
// Index for faster queries
databaseBackupSchema.index({ createdAt: -1 });
databaseBackupSchema.index({ status: 1 });
databaseBackupSchema.index({ type: 1 });
databaseBackupSchema.index({ schedule: 1, enabled: 1 });
// Virtual for formatted file size
databaseBackupSchema.virtual('formattedSize').get(function() {
  if (!this.size) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});
// Virtual for backup age
databaseBackupSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
});
// Method to check if backup is expired
databaseBackupSchema.methods.isExpired = function() {
  if (!this.retentionDays) return false;
  const now = new Date();
  const expiryDate = new Date(this.createdAt);
  expiryDate.setDate(expiryDate.getDate() + this.retentionDays);
  return now > expiryDate;
};
// Static method to clean up expired backups
databaseBackupSchema.statics.cleanupExpired = async function() {
  const expiredBackups = await this.find({
    $expr: {
      $lt: [
        { $add: ['$createdAt', { $multiply: ['$retentionDays', 24 * 60 * 60 * 1000] }] },
        new Date()
      ]
    }
  });
  const fs = require('fs');
  let deletedCount = 0;
  for (const backup of expiredBackups) {
    try {
      // Delete backup file
      if (backup.filePath && fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
      // Delete database record
      await this.findByIdAndDelete(backup._id);
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting expired backup ${backup.name}:`, error);
    }
  }
  return deletedCount;
};
// Pre-save middleware to set default values
databaseBackupSchema.pre('save', function() {
  if (this.isNew && !this.name) {
    this.name = `backup_${Date.now()}`;
  }
});
// Set transform to include virtuals in JSON
databaseBackupSchema.set('toJSON', { virtuals: true });
databaseBackupSchema.set('toObject', { virtuals: true });
module.exports = mongoose.model('DatabaseBackup', databaseBackupSchema);
