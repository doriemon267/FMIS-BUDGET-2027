const mongoose = require("mongoose");

const EmployeeCourtAppearanceSchema = mongoose.Schema(
  {
    employeeNumber: {
      type: String,
     // required: true,
    },
    employeeFullName: {
      type: String,
      required: true,
    },
    positionTitle: String,
    department: String,
    division: String,
    region: String,
    noOfCourtAppearance: {
      type: Number,
      default: 0,
    },
    courtAppearanceAmount: {
      type: Number,
      default: 0,
    },
    processBy: String,
    processDate: Date,
    fiscalYear: {
      type: String,
    //  required: true,
    },
    status: {
      type: String,
      enum: ["Submitted", "Not Submitted"],
      default: "Not Submitted"
    },
    budgetType: {
      type: String,
      //required: true,
    },
  },
  { timestamps: true }
);

const EmployeeCourtAppearance = mongoose.model(
  "EmployeeCourtAppearance",
  EmployeeCourtAppearanceSchema
);

module.exports = EmployeeCourtAppearance;
