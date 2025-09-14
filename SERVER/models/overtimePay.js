/************************************************************
 * File: models/overtimePay.js
 ************************************************************/
const mongoose = require("mongoose");
const overtimePaySchema = new mongoose.Schema(
  {
    employeeFullName: { type: String, required: true },
    positionTitle: { type: String },
    weekdayHours: { type: Number, default: 0 },
    weekendHours: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    fiscalYear: { type: String },
    budgetType: { type: String },
    processBy: { type: String },
    processDate: { type: Date, default: Date.now },
    // Additional fields for policy checks
    monthlySalary: { type: Number, default: 0 },
    // Organizational hierarchy fields for access control and submission workflow
    region: { type: String },
    department: { type: String },
    division: { type: String },
    // Submission workflow fields
    status: { type: String, default: 'Not Submitted' },
    originalLevel: { type: String }, // DIVISION, DEPARTMENT, or REGION
  },
  { timestamps: true }
);
module.exports = mongoose.model("OvertimePay", overtimePaySchema);
