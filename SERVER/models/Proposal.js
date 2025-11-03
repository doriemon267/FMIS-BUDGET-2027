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
      "Draft",                          // ANALYST creates
      "Forwarded to Reviewer",          // PREPARER submits to BUDGET REVIEWER
      "Division Submitted",             // ANALYST submits
      "Forwarded to Approver",           // BUDGET REVIEWER approves and forwards to APPROVER
      "Approver Approved",              // APPROVER approves and forwards to BUDGET_PLANNING_ANALYST
      "Forwarded to Budget Officer",    // BUDGET_ANALYST submits to BUDGET_OFFICER
      "Forwarded to Analyst",           // APPROVER approves and forwards to Analyst
      "Officer Approved",               // OFFICER approves
      "Forwarded to Manager",           // OFFICER submits to Manager
      "Finalized",                      // MANAGER approves
      "Returned",                       // Rejected at any level
      // Legacy statuses (for backward compatibility during migration)
      "Forwarded to Officer",           // Legacy: maps to "Forwarded to Approver"
      "Under Review by Reviewer",
      "Reviewer Approved",
      "Under Review by Officer",
      "Under Review by Manager",
      "Office",                         // Legacy: will be mapped to "Forwarded to Officer"
      "Office Approved",                // Legacy: will be mapped to "Officer Approved"
      "Office Submitted"                // Legacy: will be mapped to "Forwarded to Manager"
    ],
    default: "Draft"
  },
  // Enhanced workflow tracking for budget roles
  workflowLevel: {
    type: String,
    enum: ["BUDGET PREPARER", "ANALYST", "BUDGET REVIEWER", "APPROVER", "BUDGET_PLANNING_ANALYST", "OFFICER", "MANAGER", "FINALIZED"],
    default: "ANALYST"
  },
  currentStep: {
    type: String,
    enum: [
      "ANALYST_DRAFT",
      "BUDGET_REVIEWER_REVIEW",
      "APPROVER_REVIEW",
      "BUDGET_PLANNING_ANALYST_REVIEW",
      "OFFICER_REVIEW",
      "ANALYST_REVIEW",
      "MANAGER_REVIEW",
      "RETURNED",
      "FINALIZED"
    ],
    default: "ANALYST_DRAFT"
  },
  currentAssigneeRole: {
    type: String,
    enum: [
      "BUDGET PREPARER",
      "BUDGET_PLANNING_ANALYST",
      "APPROVER",
      "BUDGET_OFFICER",
      "OVERALL_BUDGET_APPROVER",
      "OVERALL_BUDGET_APPROVER",
      "BUDGET_ADMIN"
    ],
    default: "BUDGET PREPARER"
  },
  pendingWithRoles: {
    type: [String],
    default: function() {
      return ["BUDGET PREPARER"];
    }
  },
  // Workflow history with comments and user tracking
  workflowHistory: [{
    action: {
      type: String,
      enum: [
        "SUBMIT",
        "APPROVE",
        "RETURN",
        "CONSOLIDATE",
        "EDIT",
        "VERIFY",
        "SUBMIT_DIRECT_TO_MANAGER",
        "BUDGET_REVIEWER_APPROVE",
        "BUDGET_REVIEWER_RETURN",
        "BUDGET_REVIEWER_SUBMIT_TO_OFFICER",
        "BUDGET_REVIEWER_SUBMIT_TO_MANAGER",
        "BUDGET_REVIEWER_SAVE_EDITS",
        "OFFICER_APPROVE",
        "OFFICER_RETURN",
        "OFFICER_SUBMIT_TO_MANAGER",
        "OFFICER_SAVE_EDITS",
        "APPROVER_APPROVE_TO_ANALYST",
        "APPROVER_APPROVE_FORWARD_ANALYST",
        "APPROVER_SUBMIT_TO_OFFICER",
        "APPROVER_RETURN",
        "APPROVER_SAVE_EDITS",
        "PREPARER_SUBMIT_TO_BUDGET_REVIEWER",
        "MANAGER_APPROVE",
        "MANAGER_RETURN",
        "MANAGER_SAVE_EDITS",
        "ANALYST_SUBMIT_TO_BUDGET_REVIEWER",
        "ANALYST_SUBMIT_TO_OFFICER",
        "SAVE_DRAFT",
        "AUTO_SYNC"
      ],
      required: true
    },
    comment: {
      type: String,
      required: function() {
        const actionsRequiringComment = [
          "SUBMIT",
          "APPROVE",
          "RETURN",
          "VERIFY",
          "SUBMIT_DIRECT_TO_MANAGER",
          "BUDGET_REVIEWER_APPROVE",
          "BUDGET_REVIEWER_RETURN",
          "BUDGET_REVIEWER_SUBMIT_TO_OFFICER",
          "BUDGET_REVIEWER_SUBMIT_TO_MANAGER",
          "OFFICER_APPROVE",
          "OFFICER_RETURN",
          "OFFICER_SUBMIT_TO_MANAGER",
          "APPROVER_APPROVE_FORWARD_ANALYST",
          "APPROVER_SUBMIT_TO_OFFICER",
          "APPROVER_RETURN",
          "MANAGER_APPROVE",
          "MANAGER_RETURN",
          "ANALYST_SUBMIT_TO_BUDGET_REVIEWER"
        ];
        return actionsRequiringComment.includes(this.action);
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
    newStatus: String,
    targetRole: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  // Budget role specific tracking
  submittedByRole: String, // PREPARER, APPROVER, BUDGET_PLANNING_ANALYST, BUDGET_OFFICER
  // BUDGET_REVIEWER tracking
  approvedByBudgetReviewer: {
    userId: String,
    userName: String,
    date: Date,
    comment: String
  },
  returnedByBudgetReviewer: {
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
  // OVERALL_BUDGET_APPROVER tracking
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
  draftState: {
    lastSavedBy: String,
    lastSavedByName: String,
    lastSavedAt: Date,
    note: String
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
    editedByRole: String,
    editedAt: Date,
    reason: String,
    previousStatus: String,
    newStatus: String,
    changesDescription: String
  }],
  // Track edits made by each role
  editedByReviewer: {
    userId: String,
    userName: String,
    date: Date,
    changesDescription: String
  },
  editedByOfficer: {
    userId: String,
    userName: String,
    date: Date,
    changesDescription: String
  },
  editedByManager: {
    userId: String,
    userName: String,
    date: Date,
    changesDescription: String
  },
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
