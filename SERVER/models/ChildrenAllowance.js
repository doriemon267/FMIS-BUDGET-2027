const mongoose = require("mongoose");
const ChildrenAllowanceSchema = mongoose.Schema(
  {
    employeeNumber: { 
      type: String 
    },
    employeeFullName: { 
      type: String, 
      required: true 
    },
    positionTitle: { 
      type: String 
    },
    department: { 
      type: String 
    },
    division: { 
      type: String 
    },
    region: { 
      type: String 
    },
    noOfDependents: { 
      type: Number, 
      required: true 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    processBy: { 
      type: String 
    },
    processDate: { 
      type: Date 
    },
    fiscalYear: { 
      type: String 
    },
    budgetType: { 
      type: String 
    },
    // Submission workflow fields
    status: { type: String, default: 'Not Submitted' },
    originalLevel: { type: String }, // DIVISION, DEPARTMENT, or REGION
  },
  { timestamps: true }
);
module.exports = mongoose.models.ChildrenAllowance || 
  mongoose.model("ChildrenAllowance", ChildrenAllowanceSchema);
