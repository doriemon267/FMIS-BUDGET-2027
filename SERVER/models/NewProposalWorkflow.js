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
      'RETURNED_TO_OFFICER',
      'MERGED' // Source proposal archived after being merged into a consolidated proposal
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
  // Explicit ownership for system-generated NEP drafts. `createdBy` remains the
  // audit actor that generated the record, while these fields identify the
  // Budget Preparer(s) allowed to work on the draft.
  assignedPreparerUserIds: [{
    type: String,
    trim: true
  }],
  assignedPreparerNames: [{
    type: String,
    trim: true
  }],
  sourceInitialProposalIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewProposalWorkflow'
  }],
  budgetCeilingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetCeiling',
    index: true
  },
  budgetCeilingAllocationId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  nepAdjustmentMode: {
    type: String,
    enum: ['PREPARER', 'BRD'],
    default: 'PREPARER'
  },
  adjustmentAssignedBy: {
    type: String,
    trim: true
  },
  adjustmentAssignedByName: {
    type: String,
    trim: true
  },
  adjustmentAssignedAt: {
    type: Date
  },
  region: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'region' // Align with actual model name export in models/Region.js
  },
  // Organizational fields - captured at proposal submission
  division: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  assignmentLevel: {
    type: String,
    trim: true
  },
  office: {
    type: String,
    trim: true,
    default: null
  },
  isCentralOffice: {
    type: Boolean,
    default: false
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
    stepSubmissionPassword: {
      hash: {
        type: String
      },
      setAt: {
        type: Date
      },
      setBy: {
        type: String
      },
      setByName: {
        type: String
      }
    },
    eSignature: {
      imageDataUrl: {
        type: String
      },
      signedAt: {
        type: Date
      },
      signedBy: {
        type: String
      },
      signerName: {
        type: String
      }
    },
    digitalSignature: {
      signatureAlgorithm: {
        type: String
      },
      signedAt: {
        type: Date
      },
      signedPayloadHash: {
        type: String
      },
      certificateSubject: {
        type: String
      },
      certificateIssuer: {
        type: String
      },
      certificateSerialNumber: {
        type: String
      },
      certificateFingerprint256: {
        type: String
      },
      certificateValidFrom: {
        type: Date
      },
      certificateValidTo: {
        type: Date
      },
      trustBundleConfigured: {
        type: Boolean,
        default: false
      }
    },
    // Optional: snapshot of Tier version used when this action was performed
    // This links the workflow step to the specific Tier revision (Tier 1 / Tier 2 split)
    tierVersion: {
      type: Number
    },
    tierRevisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TierRevision'
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
  },
  cosJoPremium: {
    enabled: { type: Boolean, default: false },
    percentage: { type: Number, default: 10, min: 0, max: 100 },
    effectiveDate: { type: Date, default: () => new Date('2026-07-01T00:00:00.000Z') },
    updatedBy: { type: String },
    updatedByName: { type: String },
    updatedAt: { type: Date }
  },
  // Attachments array for storing uploaded files
  attachments: [{
    attachmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    },
    module: {
      type: String,
      enum: ['general', 'income', 'personnel', 'mooe', 'capital'],
      default: 'general'
    },
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    mimeType: {
      type: String
    },
    size: {
      type: Number
    },
    url: {
      type: String
    },
    uploadedBy: {
      type: String
    },
    uploadedByName: {
      type: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Concurrency control - pessimistic locking for safe multi-user editing
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedBy: {
    userId: { type: String },
    userName: { type: String },
    userRole: { type: String },
    userEmail: { type: String }
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lockExpiry: {
    type: Date,
    default: null
  },
  lockTimeout: {
    type: Number,
    default: 900000 // 15 minutes in ms
  },
  // ── Merge / Consolidation tracking ─────────────────────────────────────────
  // Fields used when the Budget Approver merges multiple proposals into one
  isConsolidated: {
    type: Boolean,
    default: false // true on the NEW merged/consolidated proposal
  },
  mergedFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewProposalWorkflow' // IDs of the source proposals that were merged
  }],
  consolidatedBy: {
    type: String // userId of the Budget Approver who performed the merge
  },
  consolidatedByName: {
    type: String
  },
  consolidatedAt: {
    type: Date
  },
  // Fields set on each SOURCE proposal after being merged
  isMergedSource: {
    type: Boolean,
    default: false // true when this proposal has been merged into another
  },
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewProposalWorkflow' // ID of the consolidated proposal this was merged into
  },
  mergedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
newProposalWorkflowSchema.index({ createdBy: 1, status: 1 });
newProposalWorkflowSchema.index({ status: 1, region: 1 });
newProposalWorkflowSchema.index({ fiscalYear: 1 });
newProposalWorkflowSchema.index({ modelType: 1 });
newProposalWorkflowSchema.index(
  { budgetCeilingId: 1, budgetCeilingAllocationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      budgetCeilingId: { $exists: true },
      budgetCeilingAllocationId: { $exists: true }
    }
  }
);

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
// Provide a simple paginate fallback in case mongoose-paginate plugin is not installed
newProposalWorkflowSchema.statics.paginate = async function(query = {}, options = {}) {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const sort = options.sort || { createdAt: -1 };
  const skip = (page - 1) * limit;

  const q = this.find(query).sort(sort).skip(skip).limit(limit);
  if (Array.isArray(options.populate)) {
    options.populate.forEach(p => q.populate(p));
  }

  const docs = await q.exec();
  const totalDocs = await this.countDocuments(query);
  return {
    docs,
    page,
    limit,
    totalDocs,
    totalPages: Math.ceil(totalDocs / limit)
  };
};

module.exports = mongoose.model('NewProposalWorkflow', newProposalWorkflowSchema);
