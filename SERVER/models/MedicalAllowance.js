const mongoose = require("mongoose");
const MedicalAllowanceSchema = mongoose.Schema(
  {
    employeeId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Employee" 
    },
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
  },
  { timestamps: true }
);
module.exports = mongoose.models.MedicalAllowance || 
  mongoose.model("MedicalAllowance", MedicalAllowanceSchema);