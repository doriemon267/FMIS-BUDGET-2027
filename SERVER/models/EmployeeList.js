const mongoose = require("mongoose");
const EmployeeSchema = mongoose.Schema(
  {
    Department: {
      type: String,
      required: true,
    },
    PositionTitle: {
      type: String,
      required: true,
    },
    Division: {
      type: String,
    },
    Section: {
      type: String,
    },
    Region: {
      type: String,
      required: true,
    },
    StatusOfAppointment: {
      type: String,
      required: true,
    },
    SG: {
      type: Number,
    },
    Step: {
      type: Number,
    },
    JG: {
      type: String,
    },
    Rate: {
      type: Number,
      required: true,
    },
    EmployeeID: {
      type: String,
    },
    EmployeeFullName: {
      type: String,
      required: true,
    },
    itemNumber: {
      type: String,
    },
    fiscalYear: {
      type: String,
      required: true,
    },
    processBy: {
      type: String,
      required: true,
      default: "Admin",
    },
    DateOfAppointment: {
      type: Date,
      required: true,
    },
    DateOfBirth: {
      type: Date,
    },
    employeeStatus: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
const Employee = mongoose.model("employee", EmployeeSchema);
module.exports = Employee;
