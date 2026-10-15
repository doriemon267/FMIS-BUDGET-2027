const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mooeProposalSchema = new Schema({
  uacsCode: {
    type: String,
    required: true
  },
  accountingTitle: {
    type: String
  },
  sublineItem: {
    type: String
  },
  income: {
    type: Number,
    default: 0
  },
  subsidy: {
    type: Number,
    default: 0
  },  amount: {
    type: Number,
    default: 0
  },
  nis: {
    type: Number,
    default: 0
  },
  cis: {
    type: Number,
    default: 0
  },
  processBy: {
    type: String
  },
  processDate: {
    type: Date,
    default: Date.now
  },
  region: {
    type: String
  },
  department: {
    type: String
  },
  division: {
    type: String
  },
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
  submittedDate: { type: Date }, // Date when proposal was submitted
  fiscalYear: {
    type: String
  },
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
  budgetType: {
    type: String
  },
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
}, { timestamps: true });
// Keep MOOE rows unique within a specific proposal, not across every proposal in the same FY/scope.
mooeProposalSchema.index(
  { proposalId: 1, uacsCode: 1, fiscalYear: 1, region: 1, department: 1, division: 1 },
  {
    name: 'proposalId_1_uacsCode_1_fiscalYear_1_region_1_department_1_division_1',
    background: true,
    partialFilterExpression: {
      proposalId: { $exists: true },
      uacsCode: { $exists: true },
      fiscalYear: { $exists: true },
      region: { $exists: true }
    }
  }
);
const MooeProposal = mongoose.model('MooeProposal', mooeProposalSchema);

module.exports = MooeProposal;
