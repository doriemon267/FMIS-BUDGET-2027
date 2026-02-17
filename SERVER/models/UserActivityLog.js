/**
 * User Activity Log – immutable, append-only.
 * Use for user activity and audit-style logs with optional "snapshot" for updates (before/after).
 * Do not update or delete records; only insert.
 */

const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: '',
    },
    userRoles: {
      type: [String],
      default: [],
    },
    action: {
      type: String,
      required: true,
      index: true,
      // e.g. CREATE, READ, UPDATE, DELETE, LOGIN, EXPORT, SUBMIT, APPROVE, or custom
    },
    resource: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      index: true,
    },
    /** Snapshot for UPDATE: { before: doc, after: doc } or full document state at time of action */
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      default: null,
    },
    path: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// Indexes for querying
userActivityLogSchema.index({ userId: 1, timestamp: -1 });
userActivityLogSchema.index({ action: 1, timestamp: -1 });
userActivityLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
userActivityLogSchema.index({ timestamp: -1 });

// Optional TTL (e.g. 2 years). Set to 0 or remove to keep forever.
const TTL_SECONDS = process.env.USER_ACTIVITY_LOG_TTL_DAYS
  ? Number(process.env.USER_ACTIVITY_LOG_TTL_DAYS) * 86400
  : 0;
if (TTL_SECONDS > 0) {
  userActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: TTL_SECONDS });
}

// Prevent accidental updates/deletes at application level (DB still allows; use read-only roles for strict immutability)
userActivityLogSchema.pre('updateOne', function () {
  throw new Error('UserActivityLog is immutable; do not update.');
});
userActivityLogSchema.pre('deleteOne', function () {
  throw new Error('UserActivityLog is immutable; do not delete.');
});

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);
