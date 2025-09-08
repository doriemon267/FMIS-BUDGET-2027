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
    required: true
  },
  Step: {
    type: Number,
    required: true
  }, 
  JG: {
    type: Number,
    required: true
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
  }
});

// Update the updatedAt field on save
EmployeeMasterSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const EmployeeMaster = mongoose.model("employee_master", EmployeeMasterSchema);
module.exports = EmployeeMaster;