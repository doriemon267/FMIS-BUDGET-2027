const mongoose = require("mongoose");

const CapitalOutlaySchema = new mongoose.Schema(
  {

    particulars: { type: String },
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
      enum: ["Submitted", "Not Submitted", "Draft", "Approved", "Returned"],
      default: "Not Submitted"
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
    }
  },
  { timestamps: true }
);

CapitalOutlaySchema.index(
  { uacsCode: 1, region: 1, fiscalYear: 1, sublineItem: 1 },
  { unique: true, partialFilterExpression: { uacsCode: { $exists: true }, region: { $exists: true }, fiscalYear: { $exists: true }, sublineItem: { $exists: true } } }
);

module.exports = mongoose.model("CapitalOutlay", CapitalOutlaySchema);