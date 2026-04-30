const mongoose = require('mongoose');

const reportAuditLogSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true
  },
  reportType: {
    type: String,
    required: true
  },
  fiscalYear: {
    type: String
  },
  budgetType: {
    type: String
  },
  regions: {
    type: [String]
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generatedBy: {
    type: String,
    required: true
  },
  fileHash: {
    type: String
  },
  signatories: [{
    fullName: String,
    position: String,
    workflowRole: String,
    signedAt: Date,
    verificationStatus: String,
    verificationReason: String,
    signatureType: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('ReportAuditLog', reportAuditLogSchema);
