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
    baseAnnualAmount: { type: Number, default: 0 },
    premiumEnabled: { type: Boolean, default: false },
    premiumRate: { type: Number, default: 10, min: 0, max: 100 },
    premiumEffectiveDate: { type: Date, default: () => new Date('2026-07-01T00:00:00.000Z') },
    premiumAmount: { type: Number, default: 0 },
    createdBy: {
      type: String,
    },
    // Link to proposal (NewProposalWorkflow _id) so list and duplicate check can be per-proposal
    workflowRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewProposalWorkflow",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);
// Proposal rows are independent snapshots. The leading workflowRef keeps the
// same employee/FY unique within a proposal while retaining one safe legacy
// null-workflow namespace for historical rows. Run the scoped index migration
// before relying on cross-proposal inserts in an existing database.
COSPersonnelSchema.index(
  { workflowRef: 1, employeeNumber: 1, fiscalYear: 1 },
  { unique: true, sparse: true, name: "workflowRef_1_employeeNumber_1_fiscalYear_1" }
);
module.exports = mongoose.model("COSPersonnel", COSPersonnelSchema);
