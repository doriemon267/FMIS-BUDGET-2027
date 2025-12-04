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
  },
  {
    timestamps: true,
  }
);
// Optional: Gumawa ng composite index para siguraduhing walang duplicate record para sa parehong employee sa isang fiscalYear
COSPersonnelSchema.index({ employeeNumber: 1, fiscalYear: 1 }, { unique: true });
module.exports = mongoose.model("COSPersonnel", COSPersonnelSchema);
