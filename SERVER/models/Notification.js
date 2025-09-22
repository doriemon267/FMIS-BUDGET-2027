const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientUserId: { type: String, required: true, index: true },
  title: { type: String },
  message: { type: String },
  entity: { type: String, enum: ['personnel','mooe','capital','income','budgetarySupport'], default: 'personnel' },
  recordIds: [{ type: mongoose.Schema.Types.ObjectId }],
  org: {
    region: String,
    department: String,
    division: String
  },
  status: { type: String, enum: ['UNREAD','READ'], default: 'UNREAD', index: true },
  createdBy: { userId: String, name: String },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
});

module.exports = mongoose.model('Notification', NotificationSchema);