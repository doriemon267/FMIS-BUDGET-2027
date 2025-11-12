const mongoose = require('mongoose');

const newProposalWorkflowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  modelType: {
    type: String,
    enum: ['Initial', 'NEP', 'GAA'],
    required: true
  },
  fiscalYear: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    default: 0
  },
  projectedCorporateIncome: {
    type: Number,
    default: 0
  },
  projectedSubsidy: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: [
      'DRAFT',
      'FORWARDED_TO_REVIEWER',
      'FORWARDED_TO_APPROVER',
      'FORWARDED_TO_BRD_ANALYST',
      'FORWARDED_TO_BRD_OFFICER',
      'FORWARDED_TO_BRD_MANAGER',
      'FINALIZED',
      'RETURNED_TO_PREPARER',
      'RETURNED_TO_REVIEWER',
      'RETURNED_TO_APPROVER',
      'RETURNED_TO_PLANNING_ANALYST',
      'RETURNED_TO_OFFICER'
    ],
    default: 'DRAFT'
  },
  createdBy: {
    type: String,
    required: true
  },
  createdByName: {
    type: String
  },
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region'
  },
  currentAssigneeRole: {
    type: String,
    enum: [
      'BUDGET PREPARER',
      'BUDGET REVIEWER',
      'BUDGET APPROVER',
      'BUDGET PLANNING ANALYST',
      'BUDGET OFFICER',
      'BUDGET MANAGER'
    ]
  },
  workflowHistory: [{
    action: {
      type: String,
      required: true
    },
    fromStatus: {
      type: String,
      required: true
    },
    toStatus: {
      type: String,
      required: true
    },
    performedBy: {
      type: String,
      required: true
    },
    performedByName: {
      type: String
    },
    comment: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Additional fields for different proposal types
  mooeData: {
    type: mongoose.Schema.Types.Mixed
  },
  capitalData: {
    type: mongoose.Schema.Types.Mixed
  },
  incomeData: {
    type: mongoose.Schema.Types.Mixed
  },
  personnelData: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better performance
newProposalWorkflowSchema.index({ createdBy: 1, status: 1 });
newProposalWorkflowSchema.index({ status: 1, region: 1 });
newProposalWorkflowSchema.index({ fiscalYear: 1 });
newProposalWorkflowSchema.index({ modelType: 1 });

// Pre-save middleware to set currentAssigneeRole based on status
newProposalWorkflowSchema.pre('save', function(next) {
  const statusToRoleMap = {
    'DRAFT': 'BUDGET PREPARER',
    'FORWARDED_TO_REVIEWER': 'BUDGET REVIEWER',
    'FORWARDED_TO_APPROVER': 'BUDGET APPROVER',
    'FORWARDED_TO_BRD_ANALYST': 'BUDGET PLANNING ANALYST',
    'FORWARDED_TO_BRD_OFFICER': 'BUDGET OFFICER',
    'FORWARDED_TO_BRD_MANAGER': 'BUDGET MANAGER',
    'FINALIZED': null,
    'RETURNED_TO_PREPARER': 'BUDGET PREPARER',
    'RETURNED_TO_REVIEWER': 'BUDGET REVIEWER',
    'RETURNED_TO_APPROVER': 'BUDGET APPROVER',
    'RETURNED_TO_PLANNING_ANALYST': 'BUDGET PLANNING ANALYST',
    'RETURNED_TO_OFFICER': 'BUDGET OFFICER'
  };

  this.currentAssigneeRole = statusToRoleMap[this.status] || this.currentAssigneeRole;
  next();
});

module.exports = mongoose.model('NewProposalWorkflow', newProposalWorkflowSchema);