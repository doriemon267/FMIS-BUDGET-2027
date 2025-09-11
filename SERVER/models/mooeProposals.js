const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mooeProposalSchema = new Schema({
  uacsCode: {
    type: String,
    required: true
  },
  accountingTitle: {
    type: String
  },
  sublineItem: {
    type: String
  },
  income: {
    type: Number,
    default: 0
  },
  subsidy: {
    type: Number,
    default: 0
  },  amount: {
    type: Number,
    default: 0
  },
  nis: {
    type: Number,
    default: 0
  },
  cis: {
    type: Number,
    default: 0
  },
  processBy: {
    type: String
  },
  processDate: {
    type: Date,
    default: Date.now
  },
  region: {
    type: String
  },
  department: {
    type: String
  },
  division: {
    type: String
  },
  status: {
    type: String,
    enum: ['Not Submitted', 'Draft', 'Submitted', 'Approved', 'Returned'],
    default: 'Not Submitted'
  },
  fiscalYear: {
    type: String
  },
  budgetType: {
    type: String
  },
  // Workflow audit fields
  divisionApproved: {
    by: { type: String },
    at: { type: Date }
  },
  departmentConsolidated: {
    by: { type: String },
    at: { type: Date }
  },
  departmentSubmitted: {
    by: { type: String },
    at: { type: Date }
  },
  regionFinalVerified: {
    by: { type: String },
    at: { type: Date }
  }
}, { timestamps: true });

// Create a compound index for upsert operations - includes region for proper isolation
mooeProposalSchema.index({ uacsCode: 1, fiscalYear: 1, region: 1 }, { unique: true });

module.exports = mongoose.model('MooeProposal', mooeProposalSchema);
