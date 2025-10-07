const mongoose = require('mongoose');

/**
 * Schema for logging all changes made to proposals
 * This provides a complete audit trail of who changed what and when
 */
const proposalEditLogSchema = new mongoose.Schema({
  // Reference to the proposal
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  
  // Reference to Budget Officer Edit if applicable
  budgetOfficerEditId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetOfficerEdit'
  },
  
  // Proposal identification
  fiscalYear: {
    type: String,
    required: true
  },
  budgetType: {
    type: String,
    required: true
  },
  region: {
    type: String,
    required: true
  },
  department: String,
  division: String,
  
  // Type of change
  changeType: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'BULK_EDIT'],
    required: true
  },
  
  // Entity type that was changed
  entityType: {
    type: String,
    enum: ['Proposal', 'Income', 'PersonnelServices', 'MOOE', 'CapitalOutlay'],
    required: true
  },
  
  // Entity ID (if applicable)
  entityId: mongoose.Schema.Types.ObjectId,
  
  // User who made the change
  changedBy: {
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    email: String,
    role: String
  },
  
  // Field-level changes
  changes: [{
    field: {
      type: String,
      required: true
    },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    valueType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date', 'object', 'array']
    }
  }],
  
  // Summary of the change
  summary: String,
  
  // Additional context
  comments: String,
  reason: String,
  
  // IP address and user agent for security
  ipAddress: String,
  userAgent: String,
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: false // We're using our own timestamp field
});

// Indexes for efficient querying
proposalEditLogSchema.index({ proposalId: 1, timestamp: -1 });
proposalEditLogSchema.index({ budgetOfficerEditId: 1 });
proposalEditLogSchema.index({ fiscalYear: 1, budgetType: 1 });
proposalEditLogSchema.index({ 'changedBy.userId': 1, timestamp: -1 });
proposalEditLogSchema.index({ entityType: 1, entityId: 1 });
proposalEditLogSchema.index({ timestamp: -1 });

// Static method to log a change
proposalEditLogSchema.statics.logChange = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging change:', error);
    throw error;
  }
};

// Static method to get change history for a proposal
proposalEditLogSchema.statics.getProposalHistory = async function(proposalId, options = {}) {
  const query = { proposalId };
  
  if (options.entityType) {
    query.entityType = options.entityType;
  }
  
  if (options.startDate) {
    query.timestamp = { $gte: new Date(options.startDate) };
  }
  
  if (options.endDate) {
    query.timestamp = query.timestamp || {};
    query.timestamp.$lte = new Date(options.endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .lean();
};

// Static method to get user activity
proposalEditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const query = { 'changedBy.userId': userId };
  
  if (options.startDate) {
    query.timestamp = { $gte: new Date(options.startDate) };
  }
  
  if (options.endDate) {
    query.timestamp = query.timestamp || {};
    query.timestamp.$lte = new Date(options.endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100)
    .lean();
};

// Method to format change for display
proposalEditLogSchema.methods.formatForDisplay = function() {
  return {
    id: this._id,
    timestamp: this.timestamp,
    user: this.changedBy.userName,
    action: this.changeType,
    entity: this.entityType,
    summary: this.summary || this.generateSummary(),
    changes: this.changes.map(c => ({
      field: c.field,
      from: c.oldValue,
      to: c.newValue
    }))
  };
};

// Generate a human-readable summary
proposalEditLogSchema.methods.generateSummary = function() {
  const changeCount = this.changes.length;
  const entityName = this.entityType.replace(/([A-Z])/g, ' $1').trim();
  
  switch (this.changeType) {
    case 'CREATE':
      return `Created new ${entityName}`;
    case 'UPDATE':
      return `Updated ${changeCount} field${changeCount !== 1 ? 's' : ''} in ${entityName}`;
    case 'DELETE':
      return `Deleted ${entityName}`;
    case 'STATUS_CHANGE':
      const statusChange = this.changes.find(c => c.field === 'status');
      if (statusChange) {
        return `Changed status from ${statusChange.oldValue} to ${statusChange.newValue}`;
      }
      return 'Changed status';
    case 'BULK_EDIT':
      return `Bulk edited ${changeCount} item${changeCount !== 1 ? 's' : ''}`;
    default:
      return `Modified ${entityName}`;
  }
};

module.exports = mongoose.model('ProposalEditLog', proposalEditLogSchema);