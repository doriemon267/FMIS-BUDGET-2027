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
      "Draft",                    // Division working copy
      "Division Submitted",       // Division → Department
      "Department Verified",      // Department technical validation
      "Department Submitted",     // Department → Region  
      "Region Approved",         // Region administrative approval
      "Office Approved",         // Office/Budget Officer approval (preferred)
      "Finalized",               // Ready for execution
      "Returned"                 // Rejected at any level
    ],
    default: "Draft"
  },
  // Enhanced workflow tracking
  workflowLevel: {
    type: String,
    enum: ["DIVISION", "DEPARTMENT", "REGION", "FINALIZED"],
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
  finalNote: { type: String }
}, { timestamps: true });
// Create a compound index for upsert operations - includes region for proper isolation
mooeProposalSchema.index({ uacsCode: 1, fiscalYear: 1, region: 1 }, { unique: true });
module.exports = mongoose.model('MooeProposal', mooeProposalSchema);
