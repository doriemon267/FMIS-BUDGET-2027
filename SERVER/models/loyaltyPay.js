const mongoose = require("mongoose");
const LoyaltyPaySchema = mongoose.Schema(
  {
    employeeNumber: String,
    employeeFullName: { type: String, required: true },
    positionTitle: String,
    department: String,
    division: String,
    region: String,
    yearsInService: { type: Number, required: true },
    appointmentDate: { type: Date }, // Add appointment date for cutoff calculation
    amount: { type: Number, default: 0 },
    processBy: String,
    processDate: Date,
    fiscalYear: String,
    budgetType: String,
  },
  { timestamps: true }
);
module.exports = mongoose.model("LoyaltyPay", LoyaltyPaySchema);