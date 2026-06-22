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
    PG: {
      type: Number,
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
    // Flag: employee is entitled to Medical and Meal allowances (hired before 1989)
    // Auto-derived from DateOfAppointment < 1989-01-01, but can be manually overridden
    entitledToMedicalMeal: {
      type: Boolean,
      default: false,
    },
    // Number of dependents (0–4) used for Children's Allowance and Medical Allowance computation
    noOfDependent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
const Employee = mongoose.model("employee", EmployeeSchema);
module.exports = Employee;
