const mongoose = require("mongoose");
const COSPersonnelSchema = new mongoose.Schema(
  {
    department: {
      type: String,
    },
    region: {
      type: String,
    },
    budgetType: {
      type: String,
      required: true,
    },
    processBy: {
      type: String,
      required: true,
    },
    processDate: {
      type: Date,
      default: Date.now,
    },
    fiscalYear: {
      type: String,
      required: true,
    },
    positionTitle: {
      type: String,
      required: true,
    },
    itemNumber: {
      type: String,
    },
    gradelevel_SG: {
      type: String,
      required: true,
    },
    step: {
      type: Number,
      required: false, // Made optional
      default: null,
    },
    gradelevel_JG: {
      type: String,
      required: false, // Made optional
      default: "",
    },
    employeeFullName: {
      type: String,
      required: true,
    uppercase: true,
    },
    employeeNumber: {
      type: String,
    },
    division: {
      type: String,
    },
    statusOfAppointment: {
      type: String,
      required: true,
    },
    monthlySalary: {
      type: Number,
      required: true,
    },
    annualSalary: {
      type: Number,
      required: true,
    },
    Total: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: String,
    },
    // Link to proposal (NewProposalWorkflow _id) so list and duplicate check can be per-proposal
    workflowRef: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
// Prevent duplicate same employee in same fiscal year. Sparse allows multiple docs with null employeeNumber (no E11000 on null).
// If you had the non-sparse index before: run db.cospersonnels.dropIndex("employeeNumber_1_fiscalYear_1") once, then restart.
COSPersonnelSchema.index({ employeeNumber: 1, fiscalYear: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("COSPersonnel", COSPersonnelSchema);
