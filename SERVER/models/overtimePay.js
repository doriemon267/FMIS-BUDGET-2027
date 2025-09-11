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
    // Region field for region-based filtering and access control
    region: { type: String },
  },
  { timestamps: true }
);
module.exports = mongoose.model("OvertimePay", overtimePaySchema);