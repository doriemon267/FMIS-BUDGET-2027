/**
 * Workflow Template Model
 * 
 * Stores reusable workflow templates for creating proposals
 */

const mongoose = require('mongoose');

const workflowTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Initial', 'NEP', 'GAA', 'Custom'],
      default: 'Initial',
      index: true,
    },
    fiscalYear: {
      type: Number,
      index: true,
    },
    budgetType: {
      type: String,
      enum: ['Initial', 'NEP', 'GAA'],
      index: true,
    },
    // Template structure - stores default values for proposal creation
    templateData: {
      // Default proposal fields
      title: String,
      description: String,
      amount: { type: Number, default: 0 },
      projectedCorporateIncome: { type: Number, default: 0 },
      projectedSubsidy: { type: Number, default: 0 },
      
      // Default organizational context
      region: String,
      department: String,
      division: String,
      office: String,
      
      // Default budget data structure
      personnelData: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      mooeData: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      capitalData: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      incomeData: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
      budgetarySupportData: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
    },
    // Workflow configuration
    workflowConfig: {
      // Default assignee roles
      defaultAssigneeRole: {
        type: String,
        enum: [
          'BUDGET PREPARER',
          'BUDGET REVIEWER',
          'BUDGET APPROVER',
          'BUDGET PLANNING ANALYST',
          'BUDGET OFFICER',
          'BUDGET MANAGER',
        ],
        default: 'BUDGET PREPARER',
      },
      // Required approvals
      requiredApprovals: [
        {
          role: String,
          order: Number,
        },
      ],
      // Auto-assign settings
      autoAssign: {
        type: Boolean,
        default: false,
      },
    },
    // Template metadata
    tags: [String],
    isPublic: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    // Ownership
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    createdByName: {
      type: String,
    },
    // Sharing
    sharedWith: [
      {
        userId: String,
        userName: String,
        permission: {
          type: String,
          enum: ['view', 'use', 'edit'],
          default: 'view',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
workflowTemplateSchema.index({ name: 1, fiscalYear: 1, budgetType: 1 });
workflowTemplateSchema.index({ category: 1, isActive: 1 });
workflowTemplateSchema.index({ createdBy: 1, isActive: 1 });
workflowTemplateSchema.index({ tags: 1 });

// Increment usage count
workflowTemplateSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Check if user can use template
workflowTemplateSchema.methods.canUse = function (userId) {
  if (this.isPublic) return true;
  if (this.createdBy === userId) return true;
  return this.sharedWith.some(
    (share) => share.userId === userId && ['view', 'use', 'edit'].includes(share.permission)
  );
};

// Check if user can edit template
workflowTemplateSchema.methods.canEdit = function (userId) {
  if (this.createdBy === userId) return true;
  return this.sharedWith.some((share) => share.userId === userId && share.permission === 'edit');
};

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
