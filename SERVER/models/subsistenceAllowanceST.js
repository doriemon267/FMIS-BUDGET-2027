const mongoose = require("mongoose");

const SubsistenceAllowanceSTSchema = mongoose.Schema(
  {
    employeeNumber: { type: String },
    employeeFullName: { type: String, required: true },
    positionTitle: { type: String },
    department: { type: String },
    division: { type: String },
    region: { type: String },
    monthlySalary: { type: Number, default: 0 },
    actualExposureDays: { type: Number, required: true },
    riskLevel: { type: String, enum: ["High", "Low"], required: true },
    amount: { type: Number, default: 0 },
    processBy: { type: String },
    processDate: { type: Date },
    fiscalYear: { type: String },
    budgetType: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubsistenceAllowanceST", SubsistenceAllowanceSTSchema);
