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
    // Link to specific proposal (CRITICAL for distinguishing between proposals)
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
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
    finalNote: { type: String }
  },
  { timestamps: true }
);
CapitalOutlaySchema.index(
  { uacsCode: 1, region: 1, fiscalYear: 1, sublineItem: 1 },
  { unique: true, partialFilterExpression: { uacsCode: { $exists: true }, region: { $exists: true }, fiscalYear: { $exists: true }, sublineItem: { $exists: true } } }
);
module.exports = mongoose.model("CapitalOutlay", CapitalOutlaySchema);