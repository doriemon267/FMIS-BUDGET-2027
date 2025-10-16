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
        'Submitted',           // Legacy status
        'Division Submitted',  // Analyst submits to Division
        'Department Verified',
        'Department Submitted',
        'Forwarded to Officer',  // Coordinator approves (new workflow)
        'Officer Approved',      // Officer approves (new workflow)
        'Forwarded to Manager',  // Officer submits to Manager (new workflow)
        'Region Approved',       // Legacy status
        'Office Approved',       // Legacy status
        'Finalized',
        'Returned'
      ],
      default: "Draft",
    },
    
    // Modern workflow tracking fields
    workflowLevel: {
      type: String,
      enum: ['DIVISION', 'DEPARTMENT', 'REGION', 'FINALIZED'],
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
  },
  { timestamps: true }
);
module.exports = mongoose.model("Income", incomeSchema);
