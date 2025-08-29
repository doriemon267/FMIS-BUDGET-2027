const mongoose = require("mongoose");

const SubsistenceAllowanceMDSSchema = mongoose.Schema(
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
   
    Amount: {
      type: Number,
      default: 0,
    },
    processBy: String,
    processDate: Date,
    fiscalYear: {
      type: String,
    //  required: true,
    },
    budgetType: {
      type: String,
    },
  },
  { timestamps: true }
);

const SubsistenceAllowanceMDSS = mongoose.model(
  "SubsistenceAllowanceMDS", SubsistenceAllowanceMDSSchema);

module.exports = SubsistenceAllowanceMDSS;
