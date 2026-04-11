const mongoose = require("mongoose");

const SubsistenceAllowanceSchema = mongoose.Schema(
  {
    employeeNumber: { type: String },
    employeeFullName: { type: String, required: true },
    positionTitle: String,
    department: String,
    division: String,
    region: String,
    noOfHrsPerDay: { type: Number, default: 8 },
    monthlyAmount: { type: Number, default: 0 },
    Amount: { type: Number, default: 0 },
    processBy: String,
    processDate: Date,
    fiscalYear: { type: String },
    budgetType: { type: String },
    status: { type: String, default: "Not Submitted" },
    originalLevel: { type: String },
  },
  { timestamps: true }
);

const SubsistenceAllowanceModel = mongoose.model(
  "SubsistenceAllowance",
  SubsistenceAllowanceSchema
);
module.exports = SubsistenceAllowanceModel;
