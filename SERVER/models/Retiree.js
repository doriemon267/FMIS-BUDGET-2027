const mongoose = require("mongoose");
const RetireeSchema = mongoose.Schema(
  {
    employeeNumber: { type: String, required: true },
    employeeFullName: { type: String, required: true },
    positionTitle: { type: String },
    department: { type: String },
    division: { type: String },
    region: { type: String },
    retirementType: { 
      type: String, 
      enum: ["Compulsory", "Optional"], 
      required: true 
    },
    dateOfRetirement: { type: Date },
    leaveDays: { type: Number, default: 0 },       // Editable leave days used for terminal leave computation
    monthlySalary: { type: Number, default: 0 },   // Salary used for terminal leave computation
    terminalLeave: { type: Number, default: 0 },
    retirementGratuity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    processBy: { type: String },
    processDate: { type: Date },
    fiscalYear: { type: String },
    budgetType: { type: String },
  },
  { timestamps: true }
);
module.exports = mongoose.model("Retiree", RetireeSchema);