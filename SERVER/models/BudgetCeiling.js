const mongoose = require('mongoose');

/**
 * BudgetCeiling Model
 * 
 * Purpose: Store budget ceilings set by BRD (Budget Revenue Division) staff
 * for each division/department for NEP and GAA budget phases.
 * 
 * Flow:
 * 1. Initial proposals are finalized
 * 2. BRD (Officer/Manager) reviews consolidated amounts
 * 3. BRD sets ceiling per division/department
 * 4. Divisions adjust their NEP proposals to fit ceiling
 * 5. NEP proposals go through same workflow
 */
const budgetCeilingSchema = new mongoose.Schema({
  // Fiscal year and budget phase
  fiscalYear: {
    type: Number,
    required: true,
    index: true
  },
  
  budgetPhase: {
    type: String,
    enum: ['NEP', 'GAA'],
    required: true,
    default: 'NEP'
  },
  
  // Region scope
  region: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  // Ceiling allocations per organizational unit
  allocations: [{
    // Organizational unit identification
    division: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    office: {
      type: String,
      trim: true
    },
    
    // Reference to the finalized Initial proposal
    initialProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow'
    },
    initialProposalIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow'
    }],
    
    // Initial proposal amounts (reference/read-only)
    initialRequestAmount: {
      type: Number,
      default: 0
    },
    initialSubsidy: {
      type: Number,
      default: 0
    },
    initialIncome: {
      type: Number,
      default: 0
    },
    
    // Breakdown by expense type for initial request
    initialBreakdown: {
      personnelServices: { type: Number, default: 0 },
      mooe: { type: Number, default: 0 },
      capitalOutlay: { type: Number, default: 0 }
    },
    
    // BRD-set ceiling amounts
    ceilingAmount: {
      type: Number,
      default: 0
    },
    ceilingSubsidy: {
      type: Number,
      default: 0
    },
    ceilingIncome: {
      type: Number,
      default: 0
    },
    
    // Breakdown by expense type (optional detailed ceiling)
    ceilingBreakdown: {
      personnelServices: { type: Number, default: 0 },
      mooe: { type: Number, default: 0 },
      capitalOutlay: { type: Number, default: 0 }
    },
    
    // Variance tracking
    variance: {
      type: Number,
      default: 0  // ceilingAmount - initialRequestAmount
    },
    variancePercent: {
      type: Number,
      default: 0
    },
    
    // Priority and remarks
    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium'
    },
    remarks: {
      type: String,
      trim: true
    },
    
    // NEP proposal reference (created after ceiling is set)
    nepProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow'
    },
    nepProposalStatus: {
      type: String,
      trim: true
    },
    nepLegacyProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal'
    },
    assignedPreparerUserIds: [{
      type: String,
      trim: true
    }],
    assignedPreparerNames: [{
      type: String,
      trim: true
    }],
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
    
    // Allocation status
    allocationStatus: {
      type: String,
      enum: ['Pending', 'Published', 'Acknowledged', 'NEP_Created', 'NEP_Submitted', 'NEP_Finalized'],
      default: 'Pending'
    }
  }],
  
  // Total budget pool for this region
  totalBudgetPool: {
    type: Number,
    default: 0
  },
  totalAllocated: {
    type: Number,
    default: 0
  },
  remainingToAllocate: {
    type: Number,
    default: 0
  },
  
  // Summary of initial requests
  totalInitialRequested: {
    type: Number,
    default: 0
  },
  
  // Ceiling status
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Locked', 'Archived'],
    default: 'Draft'
    // Draft: BRD is still setting ceilings
    // Published: Ceilings are visible to divisions
    // Locked: No more changes allowed, NEP workflow in progress
    // Archived: NEP phase completed
  },
  
  // Publication tracking
  publishedAt: {
    type: Date
  },
  publishedBy: {
    type: String,
    trim: true
  },
  publishedByName: {
    type: String,
    trim: true
  },
  
  // Lock tracking
  lockedAt: {
    type: Date
  },
  lockedBy: {
    type: String,
    trim: true
  },
  
  // Audit trail
  createdBy: {
    type: String,
    trim: true
  },
  createdByName: {
    type: String,
    trim: true
  },
  lastModifiedBy: {
    type: String,
    trim: true
  },
  lastModifiedByName: {
    type: String,
    trim: true
  },
  
  // History of changes
  changeHistory: [{
    action: {
      type: String,
      enum: ['CREATED', 'CEILING_SET', 'CEILING_UPDATED', 'PUBLISHED', 'LOCKED', 'NEP_GENERATED', 'ARCHIVED']
    },
    division: String,
    previousAmount: Number,
    newAmount: Number,
    changedBy: String,
    changedByName: String,
    changedAt: {
      type: Date,
      default: Date.now
    },
    remarks: String
  }]

}, {
  timestamps: true,
  collection: 'budget_ceilings'
});

// Compound indexes for efficient querying
budgetCeilingSchema.index({ fiscalYear: 1, region: 1, budgetPhase: 1 }, { unique: true });
budgetCeilingSchema.index({ status: 1, fiscalYear: 1 });
budgetCeilingSchema.index({ 'allocations.division': 1 });
budgetCeilingSchema.index({ 'allocations.initialProposalId': 1 });
budgetCeilingSchema.index({ 'allocations.nepProposalId': 1 });
budgetCeilingSchema.index({ 'allocations.assignedPreparerUserIds': 1 });

// Virtual for calculating remaining budget
budgetCeilingSchema.virtual('calculatedRemaining').get(function() {
  return this.totalBudgetPool - this.totalAllocated;
});

// Pre-save middleware to update totals
budgetCeilingSchema.pre('save', function(next) {
  // First update individual allocations
  this.allocations.forEach(alloc => {
    // If breakdown is used, ensure the total amount reflects it
    if (alloc.ceilingBreakdown && (alloc.ceilingBreakdown.personnelServices > 0 || alloc.ceilingBreakdown.mooe > 0 || alloc.ceilingBreakdown.capitalOutlay > 0)) {
      alloc.ceilingAmount = (alloc.ceilingBreakdown.personnelServices || 0) + (alloc.ceilingBreakdown.mooe || 0) + (alloc.ceilingBreakdown.capitalOutlay || 0);
    }
    
    if (alloc.initialBreakdown && (alloc.initialBreakdown.personnelServices > 0 || alloc.initialBreakdown.mooe > 0 || alloc.initialBreakdown.capitalOutlay > 0)) {
      alloc.initialRequestAmount = (alloc.initialBreakdown.personnelServices || 0) + (alloc.initialBreakdown.mooe || 0) + (alloc.initialBreakdown.capitalOutlay || 0);
    }

    alloc.variance = (alloc.ceilingAmount || 0) - (alloc.initialRequestAmount || 0);
    if (alloc.initialRequestAmount > 0) {
      alloc.variancePercent = ((alloc.variance / alloc.initialRequestAmount) * 100).toFixed(2);
    } else {
      alloc.variancePercent = 0;
    }
  });

  // Calculate total allocated from allocations
  this.totalAllocated = this.allocations.reduce((sum, alloc) => sum + (alloc.ceilingAmount || 0), 0);
  this.remainingToAllocate = this.totalBudgetPool - this.totalAllocated;
  
  // Calculate total initial requested
  this.totalInitialRequested = this.allocations.reduce((sum, alloc) => sum + (alloc.initialRequestAmount || 0), 0);
  
  next();
});

// Method to add change to history
budgetCeilingSchema.methods.addChangeHistory = function(action, details) {
  this.changeHistory.push({
    action,
    ...details,
    changedAt: new Date()
  });
};

// Static method to get or create ceiling for fiscal year and region
budgetCeilingSchema.statics.getOrCreate = async function(fiscalYear, region, budgetPhase = 'NEP', userId, userName) {
  let ceiling = await this.findOne({ fiscalYear, region, budgetPhase });
  
  if (!ceiling) {
    ceiling = new this({
      fiscalYear,
      region,
      budgetPhase,
      createdBy: userId,
      createdByName: userName,
      allocations: [],
      changeHistory: [{
        action: 'CREATED',
        changedBy: userId,
        changedByName: userName,
        changedAt: new Date()
      }]
    });
    await ceiling.save();
  }
  
  return ceiling;
};

module.exports = mongoose.model('BudgetCeiling', budgetCeilingSchema);
