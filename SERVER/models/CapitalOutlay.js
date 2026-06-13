const mongoose = require("mongoose");
const CapitalOutlaySchema = new mongoose.Schema(
  {
    particulars: { type: String},
    cost: { type: Number, required: true },
    income: { type: Number, default: 0 }, // <-- Add this line
    subsidy: { type: Number, default: 0 }, // Added subsidy field
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    }, // Reference to Category model
   
    date_process: { type: Date, default: Date.now },
    department: String,
    division: String, // added to store division-level ownership when applicable
    region: String,
    fiscal_year: Number,
    budgetType: String,
    username_process: String,
    status: {
      type: String,
      enum: [
        "Draft",                          // PREPARER creates
        "Forwarded to Reviewer",          // PREPARER submits to BUDGET REVIEWER
        "Division Submitted",             // Legacy alias (pre-6-step)
        "Forwarded to Approver",          // BUDGET REVIEWER approves and forwards to APPROVER
        "Approver Approved",              // APPROVER approves and forwards
        "Forwarded to Budget Officer",    // Forwarded to BUDGET_OFFICER
        "Forwarded to Budget Planning Analyst", // Forwarded to Budget Planning Analyst
        "Officer Approved",               // OFFICER approves
        "Forwarded to Overall Budget Approver", // Forwarded to OVERALL BUDGET APPROVER
        "Department Verified",            // Department technical validation
        "Department Submitted",           // Department → Region  
        "Region Approved",                // Region administrative approval
        "Office Approved",                // Office/Budget Officer approval (preferred)
        "Finalized",                      // Ready for execution
        "Returned",                       // Rejected at any level (generic)
        "Returned to Preparer",           // Specifically returned to preparer
        // Legacy statuses (for backward compatibility)
        "Forwarded to Officer",
        "Under Review by Reviewer",
        "Reviewer Approved",
        "Under Review by Officer",
        "Under Review by Manager",
        "Office",
        "Office Submitted",
        "System Upload"
      ],
      default: "Draft"
    },
    // Enhanced workflow tracking
    workflowLevel: {
      type: String,
      enum: [
        "DIVISION", 
        "DEPARTMENT", 
        "REGION", 
        "FINALIZED",
        "BUDGET PREPARER",
        "PREPARER",
        "BUDGET REVIEWER",
        "REVIEWER",
        "BUDGET APPROVER",
        "APPROVER",
        "BUDGET_PLANNING_ANALYST",
        "OFFICER",
        "BUDGET_OFFICER",
        "MANAGER",
        "BUDGET_MANAGER",
        "OVERALL_BUDGET_APPROVER",
        "SUPER_ADMIN",
        "SUPER ADMIN"
      ],
      default: "DIVISION"
    },
    lastActionBy: String,
    lastActionDate: { type: Date, default: Date.now },
    departmentVerifiedBy: String,
    departmentVerifiedDate: Date,
    regionApprovedBy: String,
    regionApprovedDate: Date,
    rejectionReason: String,
    // Link to specific proposal (CRITICAL for distinguishing between proposals)
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      index: true
    },
    workflowRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow',
      index: true
    },
    
    processBy: {
      type: String,
      required: true,
    },
    processDate: {
      type: Date,
      required: true,
    },
    fiscalYear: {
      type: String,
    },
    region: {
      type: String,
    },
    sublineItem: {
      type: String,
      required: true,
    },
    accountingTitle: {
      type: String,
    },
    uacsCode: {
      type: String,
    },
    submittedDate: { type: Date }, // Date when proposal was submitted
    // Workflow audit fields
    divisionApproved: {
      by: { type: String },
      at: { type: Date }
    },
    departmentConsolidated: {
      by: { type: String },
      at: { type: Date }
    },
    departmentSubmitted: {
      by: { type: String },
      at: { type: Date }
    },
    regionFinalVerified: {
      by: { type: String },
      at: { type: Date }
    },
    // Submission workflow tracking fields
    originalLevel: {
      type: String,
      enum: ['DIVISION', 'DEPARTMENT', 'REGION', 'FULL'],
      default: null
    },
    lastWorkflowTransition: {
      type: String,
      enum: ['DIVISION_TO_DEPARTMENT', 'DEPARTMENT_TO_REGION', 'REGION_FINAL_APPROVAL'],
      default: null
    },
    submittedToDepartmentAt: { type: Date },
    submittedToDepartmentBy: { type: String },
    submittedToRegionAt: { type: Date },
    submittedToRegionBy: { type: String },
    finalApprovedAt: { type: Date },
    finalApprovedBy: { type: String },
    submissionNote: { type: String },
    approvalNote: { type: String },
    finalNote: { type: String },
    createdBy: {
      type: String
    },
    isSystemGenerated: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);
CapitalOutlaySchema.index(
  { proposalId: 1, uacsCode: 1, region: 1, department: 1, division: 1, fiscalYear: 1, sublineItem: 1, category: 1 },
  {
    unique: true,
    partialFilterExpression: {
      proposalId: { $exists: true },
      uacsCode: { $exists: true },
      region: { $exists: true },
      department: { $exists: true },
      division: { $exists: true },
      fiscalYear: { $exists: true },
      sublineItem: { $exists: true },
      category: { $exists: true }
    }
  }
);
module.exports = mongoose.model("CapitalOutlay", CapitalOutlaySchema);