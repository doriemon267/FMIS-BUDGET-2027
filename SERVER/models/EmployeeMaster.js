const mongoose = require("mongoose");
const EmployeeMasterSchema = mongoose.Schema({
  Department: {
    type: String,
    required: true
  },
  Division: {
    type: String,
  },
  Section: {
    type: String,
  },
  Unit: {
    type: String,
  },
  ItemNumber: {
    type: String,
  },
  PositionTitle: {
    type: String,
    required: true
  },
  Status: {
    type: String,
    enum: ["PERMANENT", "CASUAL", "COS", "Active", "Inactive"],
    required: true
  },
  // Add employee status field for active/inactive state
  employeeStatus: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active"
  },
  // Add StatusOfAppointment field
  StatusOfAppointment: {
    type: String,
    default: "PERMANENT"
  },
  // Add Region field to ensure employees are associated with a region
  Region: {
    type: String,
    required: true
  },
  SG: {
    type: Number,
  },
  Step: {
    type: Number,
  },
  JG: {
    type: Number,
  },
  PG: {
    type: Number,
  },
  Rate: {
    type: Number,
    required: true
  },
  Charging: {
    type: String,
    required: true,
    default: "Regular" // Default value
  },
  EmployeeID: {  
    type: String,
  },
  EmployeeFullName: {
    type: String,
    required: true
  },
  isVacant: {
    type: Boolean,
    default: false
  },
  formerEmployeeName: {
    type: String
  },
  vacatedYear: {
    type: String
  },
  // Add date of birth field
  DateOfBirth: {
    type: Date
  },
  // Add date of appointment field
  DateOfAppointment: {
    type: Date
  },
  // Add processBy field to track who created/processed the employee
  processBy: {
    type: String,
    default: "Admin"
  },
  // Add fiscal year field
  fiscalYear: {
    type: String,
    required: true
  },
  // Add timestamps for created/updated tracking
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
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
});
// Update the updatedAt field on save
EmployeeMasterSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});
const EmployeeMaster = mongoose.model("EmployeeMaster", EmployeeMasterSchema);
module.exports = EmployeeMaster;