const mongoose = require('mongoose');
const { RRule } = require('rrule');

const EventSchema = new mongoose.Schema({
  owner: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String },
  dateTime: { type: Date, required: true, index: true }, // stored in UTC
  timezone: { type: String, default: 'UTC' },
  // whether to notify or not
  notify: { type: Boolean, default: true },
  channels: [{ type: String, enum: ['in-app', 'email', 'push'], default: 'in-app' }],
  preReminders: [{ type: Number }], // minutes before event
  recurrence: {
    rrule: { type: String }, // RFC rrule text for recurring events
    // we can optionally store nextOccurrence, lastTriggered and other metadata
    lastTriggeredAt: { type: Date },
  },
  status: { type: String, enum: ['PENDING', 'TRIGGERED', 'CANCELLED'], default: 'PENDING' },
  jobIds: [{ type: String }],
  createdBy: { userId: String, name: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

EventSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Helper: compute next occurrence using rrule if available
EventSchema.methods.nextOccurrenceFrom = function (fromDate = new Date()) {
  if (!this.recurrence || !this.recurrence.rrule) return null;
  try {
    const rule = RRule.fromString(this.recurrence.rrule);
    const next = rule.after(fromDate, true);
    return next || null;
  } catch (e) {
    return null;
  }
};

module.exports = mongoose.model('Event', EventSchema);
