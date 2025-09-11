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
      default: "Not Submitted",
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
    // Organizational context (to support precise filtering)
    department: { type: String },
    division: { type: String },
    originalLevel: { type: String },       // 'DIVISION' | 'DEPARTMENT' | 'REGION'
    consolidatedFrom: { type: String },    // 'DIVISION' | 'DEPARTMENT' | 'REGION'
  },
  { timestamps: true }
);

module.exports = mongoose.model("Income", incomeSchema);
