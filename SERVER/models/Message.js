const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: String, required: true, index: true },
  to: { type: String, required: true, index: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Message', MessageSchema);
