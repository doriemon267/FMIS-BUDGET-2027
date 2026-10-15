const mongoose = require('mongoose');

/**
 * Tier2Proposal Model
 * 
 * Purpose: Store editable Tier 2 proposals that are copied from finalized Tier 1 proposals.
 * Tier 1 proposals are read-only finalized data.
 * Tier 2 proposals are editable working copies for BRD planning and adjustments.
 */
const tier2ProposalSchema = new mongoose.Schema({
  // Reference to original Tier 1 data (multiple sources possible)
  tier1References: [{
    sourceType: {
      type: String,
      enum: ['personnel', 'mooe', 'capital', 'income', 'budgetarySupport'],
      required: true
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  }],
  
  // Basic identification fields
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  
  // Organizational context
  region: {
    type: String,
    required: true,
    index: true
  },
  department: {
    type: String
  },
  division: {
    type: String
  },
  
  // Budget planning fields
  fiscalYear: {
    type: String,
    required: true,
    index: true
  },
  budgetType: {
    type: String,
    required: true
  },
  
  // Financial data (editable in Tier 2)
  tier1Amount: {
    type: Number,
    default: 0,
    comment: 'Original Tier 1 amount (for reference)'
  },
  tier2Amount: {
    type: Number,
    default: 0,
    comment: 'Adjusted Tier 2 amount'
  },
  adjustmentAmount: {
    type: Number,
    default: 0,
    comment: 'Difference between Tier 2 and Tier 1'
  },
  adjustmentPercentage: {
    type: Number,
    default: 0,
    comment: 'Percentage change from Tier 1'
  },
  
  // Detailed breakdown (editable)
  categoryBreakdown: {
    personnelServices: { type: Number, default: 0 },
    mooe: { type: Number, default: 0 },
    capitalOutlay: { type: Number, default: 0 },
    income: { type: Number, default: 0 },
    budgetarySupport: { type: Number, default: 0 }
  },
  
  // Planning and remarks
  tier2Remarks: {
    type: String,
    comment: 'Notes and justifications for Tier 2 adjustments'
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low', 'Critical'],
    default: 'Medium'
  },
  
  // Status tracking for Tier 2
  tier2Status: {
    type: String,
    enum: ['Draft', 'Under Review', 'Approved', 'Rejected', 'Finalized'],
    default: 'Draft'
  },
  
  // Workflow tracking
  createdBy: {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userRole: { type: String }
  },
  lastModifiedBy: {
    userId: { type: String },
    userName: { type: String },
    userRole: { type: String },
    modifiedAt: { type: Date }
  },
  
  // Approval workflow for Tier 2
  tier2ApprovalHistory: [{
    action: {
      type: String,
      enum: ['Created', 'Edited', 'Submitted', 'Approved', 'Rejected', 'Returned']
    },
    userId: String,
    userName: String,
    userRole: String,
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Tier 2 specific metadata
  tier2Metadata: {
    copiedFromTier1At: { type: Date },
    lastSyncedWithTier1At: { type: Date },
    isDraft: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  collection: 'tier2proposals'
});

// Indexes for efficient querying
tier2ProposalSchema.index({ region: 1, fiscalYear: 1, tier2Status: 1 });
tier2ProposalSchema.index({ 'createdBy.userId': 1 });
tier2ProposalSchema.index({ tier2Status: 1 });

// Virtual for calculating adjustment automatically
tier2ProposalSchema.pre('save', function(next) {
  if (this.tier1Amount !== undefined && this.tier2Amount !== undefined) {
    this.adjustmentAmount = this.tier2Amount - this.tier1Amount;
    if (this.tier1Amount !== 0) {
      this.adjustmentPercentage = ((this.adjustmentAmount / this.tier1Amount) * 100).toFixed(2);
    }
  }
  next();
});

module.exports = mongoose.model('Tier2Proposal', tier2ProposalSchema);
