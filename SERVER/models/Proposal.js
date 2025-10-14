const mongoose = require('mongoose');
const proposalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
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
  department: {
    type: String
  },
  division: {
    type: String
  },
  originalDepartment: {
    type: String
  },
  originalDivision: {
    type: String
  },
  processBy: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: [
      "Draft",                    // Initial state - BUDGET_ANALYST creating
      "Division Submitted",       // BUDGET_ANALYST → BUDGET_COORDINATOR
      "Office",                   // BUDGET_COORDINATOR → BUDGET_OFFICER (optional)
      "Office Approved",          // BUDGET_COORDINATOR approved
      "Office Submitted",         // BUDGET_COORDINATOR/BUDGET_OFFICER → BUDGET_MANAGER
      "Returned",                 // Rejected at any level
      "Finalized"                 // BUDGET_MANAGER final approval
    ],
    default: "Draft"
  },
  // Enhanced workflow tracking for budget roles
  workflowLevel: {
    type: String,
    enum: ["ANALYST", "COORDINATOR", "OFFICER", "MANAGER", "FINALIZED"],
    default: "ANALYST"
  },
  // Workflow history with comments and user tracking
  workflowHistory: [{
    action: {
      type: String,
      enum: ["SUBMIT", "APPROVE", "RETURN", "CONSOLIDATE", "EDIT", "VERIFY", "SUBMIT_DIRECT_TO_MANAGER", "COORDINATOR_APPROVE", "COORDINATOR_RETURN", "COORDINATOR_SUBMIT_TO_OFFICER", "COORDINATOR_SUBMIT_TO_MANAGER"],
      required: true
    },
    comment: {
      type: String,
      required: function() {
        return ["APPROVE", "RETURN", "VERIFY"].includes(this.action);
      }
    },
    userId: {
      type: String,
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    previousStatus: String,
    newStatus: String
  }],
  // Budget role specific tracking
  submittedByRole: String, // BUDGET_ANALYST, BUDGET_COORDINATOR
  // BUDGET_COORDINATOR tracking
  approvedByCoordinator: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  returnedByCoordinator: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  // BUDGET_OFFICER tracking
  approvedByOfficer: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  returnedByOfficer: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  consolidatedByOfficer: {
    userId: String,
    userName: String,
    date: Date
  },
  verifiedByOfficer: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  // BUDGET_MANAGER tracking
  approvedByManager: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  returnedByManager: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  // Track if proposal bypassed officer review
  bypassedOfficerReview: {
    type: Boolean,
    default: false
  },
  // Track version for edit history
  version: {
    type: Number,
    default: 1
  },
  editHistory: [{
    version: Number,
    editedBy: String,
    editedByName: String,
    editedAt: Date,
    reason: String,
    previousStatus: String
  }],
  // Consolidation tracking
  isConsolidated: {
    type: Boolean,
    default: false
  },
  consolidatedOrigin: {
    type: String  // OFFICE/DEPARTMENT name after consolidation by Budget Officer
  },
  consolidatedProposals: [{
    proposalId: mongoose.Schema.Types.ObjectId,
    title: String,
    department: String,
    division: String
  }],
  // Notification tracking
  notificationsSent: [{
    notificationId: mongoose.Schema.Types.ObjectId,
    recipientUserId: String,
    type: String,
    sentAt: Date
  }],
  lastActionBy: String,
  lastActionDate: { type: Date, default: Date.now },
  departmentVerifiedBy: String,
  departmentVerifiedDate: Date,
  regionApprovedBy: String,
  regionApprovedDate: Date,
  rejectionReason: String,
  cobExpenditures: {
    type: String
  },
  totalExpenses: {
    type: Number,
    default: 0
  },
  totalIncome: {
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
  proposedBudget: {
    type: Number,
    default: 0
  },
  categoryBreakdown: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  submittedDate: {
    type: Date
  },
  approvedDate: {
    type: Date
  },
  rejectedDate: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  consolidationMetadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdByAssignmentLevel: {
    type: String
  },
  createdByUserId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
module.exports = mongoose.model("Proposal", proposalSchema);
