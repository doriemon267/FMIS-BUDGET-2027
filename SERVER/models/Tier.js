const mongoose = require('mongoose');

const TierItemSchema = new mongoose.Schema({
  lineItemId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    required: true,
    enum: ['Personnel', 'MOOE', 'Capital Outlay'],
  },
  tier1: {
    type: Number,
    default: 0,
  },
  tier2: {
    type: Number,
    default: 0,
  },
});

const TierSchema = new mongoose.Schema({
  fiscalYear: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  department: {
    type: String,
  },
  division: {
    type: String,
  },
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewProposalWorkflow',
  },
  items: [TierItemSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, { 
  timestamps: true,
  strict: false
});

TierSchema.index(
  { proposalId: 1 },
  {
    unique: true,
    partialFilterExpression: { proposalId: { $type: 'objectId' } },
  }
);

module.exports = mongoose.model('Tier', TierSchema);
