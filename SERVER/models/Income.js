const mongoose = require("mongoose");
const incomeSchema = new mongoose.Schema(
  {
    particulars: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      default: 0,
    },
    incomecategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncomeCategory",
      required: true,
    },
    subcategory: {
      type: String,
    },
    category: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    fiscalYear: {
      type: String,
      required: true,
    },
    budgetType: {
      type: String,
      required: true,
    },
    region: {
      type: String,
    },
    processBy: {
      type: String,
    },
    processDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: [
        'Draft',
        'Submitted',                       // Legacy status
        'Division Submitted',              // Analyst submits to Division
        'Forwarded to Reviewer',           // PREPARER submits to BUDGET REVIEWER
        'Forwarded to Approver',           // BUDGET REVIEWER approves and forwards to APPROVER
        'Approver Approved',               // APPROVER approves and forwards
        'Forwarded to Budget Officer',     // Forwarded to BUDGET_OFFICER
        'Forwarded to Budget Planning Analyst', // Forwarded to Budget Planning Analyst
        'Forwarded to Officer',            // Reviewer approves (new workflow)
        'Officer Approved',                // Officer approves (new workflow)
        'Forwarded to Manager',            // Officer submits to Manager (new workflow)
        'Forwarded to Overall Budget Approver', // Forwarded to OVERALL BUDGET APPROVER
        'Department Verified',
        'Department Submitted',
        'Region Approved',                 // Legacy status
        'Office Approved',                 // Legacy status
        'Finalized',
        'Returned',                        // Rejected at any level (generic)
        'Returned to Preparer',            // Specifically returned to preparer
        'Under Review by Reviewer',
        'Reviewer Approved',
        'Under Review by Officer',
        'Under Review by Manager',
        'Office',
        'Office Submitted',
        'System Upload'
      ],
      default: "Draft",
    },
    
    // Modern workflow tracking fields
    workflowLevel: {
      type: String,
      enum: [
        'DIVISION', 
        'DEPARTMENT', 
        'REGION', 
        'FINALIZED',
        'BUDGET PREPARER',
        'PREPARER',
        'BUDGET REVIEWER',
        'REVIEWER',
        'BUDGET APPROVER',
        'APPROVER',
        'BUDGET_PLANNING_ANALYST',
        'OFFICER',
        'BUDGET_OFFICER',
        'MANAGER',
        'BUDGET_MANAGER',
        'OVERALL_BUDGET_APPROVER',
        'SUPER_ADMIN',
        'SUPER ADMIN'
      ],
      default: 'DIVISION'
    },
    
    // Department Level Actions
    departmentVerifiedBy: { type: String },
    departmentVerifiedDate: { type: Date },
    
    // Region Level Actions  
    regionApprovedBy: { type: String },
    regionApprovedDate: { type: Date },
    
    // General Workflow Audit
    lastActionBy: { type: String },
    lastActionDate: { type: Date },
    lastWorkflowTransition: { type: String },
    rejectionReason: { type: String },
    submittedDate: { type: Date }, // Date when proposal was submitted
    
    // Legacy workflow audit fields (keep for backward compatibility)
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
    // Organizational context (to support precise filtering)
    department: { type: String },
    division: { type: String },
    originalLevel: { type: String },       // 'DIVISION' | 'DEPARTMENT' | 'REGION'
    consolidatedFrom: { type: String },    // 'DIVISION' | 'DEPARTMENT' | 'REGION'
    
    // Link to specific proposal (CRITICAL for distinguishing between proposals)
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      index: true,
      required: false
    },
    workflowRef: { // direct link to NewProposalWorkflow if needed
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NewProposalWorkflow',
      index: true
    },
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
module.exports = mongoose.model("Income", incomeSchema);
