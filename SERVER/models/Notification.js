const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientUserId: { type: String, required: true, index: true },
  // Canonical normalized recipient ID (e.g., BUDGET_MANAGER) to make role matching consistent
  recipientUserIdNormalized: { type: String, index: true },
  // Preserve original string for audit
  recipientUserIdOriginal: { type: String },
  title: { type: String },
  message: { type: String },
  entity: { type: String, enum: ['personnel','mooe','capital','income','budgetarySupport','proposal'], default: 'personnel' },
  recordIds: [{ type: mongoose.Schema.Types.ObjectId }],
  org: {
    region: String,
    department: String,
    division: String
  },
  status: { type: String, enum: ['UNREAD','READ'], default: 'UNREAD', index: true },
  createdBy: { userId: String, name: String },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date },
  archived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date },
  // Deep linking support - route user to specific proposal or page
  relatedLink: { type: String },
  // Type and related ID for routing logic
  type: { type: String },
  relatedEntityId: { type: String },
  relatedEntityType: { type: String },
  metadata: mongoose.Schema.Types.Mixed
});

// Query performance indexes for inbox endpoints (recipient/status/archive + newest first).
NotificationSchema.index({ recipientUserId: 1, status: 1, archived: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserIdNormalized: 1, status: 1, archived: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, archived: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserIdNormalized: 1, archived: 1, createdAt: -1 });

// Normalization helper
const normalizeRecipientId = (val) => {
  if (!val || typeof val !== 'string') return null;
  if (val.includes('@')) return null; // skip emails
  if (/^[0-9a-fA-F\-]{8,}$/.test(val)) return null; // likely UUID
  return val.trim().toUpperCase().replace(/\s+/g, '_').replace(/[\/\-]+/g, '_').replace(/[^A-Z0-9_]/g, '_');
};

// Pre-save hook to ensure normalized recipient ID is set
NotificationSchema.pre('save', function () {
  try {
    if (this.recipientUserId && !this.recipientUserIdNormalized) {
      this.recipientUserIdOriginal = this.recipientUserId;
      this.recipientUserIdNormalized = normalizeRecipientId(this.recipientUserId);
    }
  } catch (e) {
    throw e;
  }
});

// Pre-insertMany hook
NotificationSchema.pre('insertMany', function (docs) {
  try {
    docs.forEach(doc => {
      if (doc.recipientUserId && !doc.recipientUserIdNormalized) {
        doc.recipientUserIdOriginal = doc.recipientUserId;
        doc.recipientUserIdNormalized = normalizeRecipientId(doc.recipientUserId);
      }
    });
  } catch (e) {
    throw e;
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
