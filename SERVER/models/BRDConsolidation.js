const mongoose = require('mongoose');

const brdConsolidationSchema = new mongoose.Schema({
  // Reference to the proposal in workflow
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewProposalWorkflow',
    required: true,
    unique: true
  },

  // Organizational hierarchy
  region: {
    type: String,
    required: true,
    trim: true
    // Examples: "NCR", "Region II", "Region III", "Central Office"
  },

  division: {
    type: String,
    trim: true
    // For regional proposals: division name
    // Null for Central Office proposals
  },

  department: {
    type: String,
    trim: true
    // For Central Office proposals: department name
    // Optional for regional proposals
  },

  // Consolidated path for easy querying
  // Format: "Region/Division" or "Central Office/Department"
  consolidationPath: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // For Central Office, special handling
  isCentralOffice: {
    type: Boolean,
    default: false
  },

  // Proposal details snapshot at consolidation time
  proposalTitle: {
    type: String,
    trim: true
  },

  proposalAmount: {
    type: Number,
    default: 0
  },

  modelType: {
    type: String,
    enum: ['Initial', 'NEP', 'GAA'],
    default: 'Initial'
  },

  fiscalYear: {
    type: Number
  },

  // Legacy proposal reference (if linked)
  legacyProposalId: {
    type: String,
    trim: true
  },

  // Timestamps
  consolidatedAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Metadata for tracking
  consolidatedBy: {
    type: String,
    trim: true
    // User ID who triggered consolidation (system or analyst)
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'ARCHIVED', 'MOVED'],
    default: 'ACTIVE'
    // ACTIVE: Currently in BRD consolidation
    // ARCHIVED: Moved to finalized storage
    // MOVED: Transferred to next level
  },

  // Notes for tracking changes
  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true,
  collection: 'brd_consolidations'
});

// Indexes for efficient querying
brdConsolidationSchema.index({ region: 1, division: 1 });
brdConsolidationSchema.index({ region: 1, department: 1 });
brdConsolidationSchema.index({ consolidationPath: 1 });
brdConsolidationSchema.index({ fiscalYear: 1, region: 1 });
brdConsolidationSchema.index({ proposalId: 1 });
brdConsolidationSchema.index({ isCentralOffice: 1 });
brdConsolidationSchema.index({ status: 1 });

// Pre-save middleware to update timestamp
brdConsolidationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BRDConsolidation', brdConsolidationSchema);
