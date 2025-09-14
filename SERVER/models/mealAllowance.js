const mongoose = require("mongoose");
const MealAllowanceSchema = mongoose.Schema(
  {
    employeeNumber: { type: String, required: true, trim: true },
    employeeFullName: { type: String, required: true, trim: true },
    positionTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    division: { type: String, trim: true },
    region: { type: String, trim: true },
    actualDays: { 
      type: Number, 
      required: true, 
      min: [0, "Actual days cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Actual days must be an integer"
      }
    },
    amount: { 
      type: Number, 
      required: true,
      min: [0, "Amount cannot be negative"]
    },
    processBy: { type: String, trim: true },
    processDate: { type: Date, default: Date.now },
    fiscalYear: { type: String, required: true, trim: true },
    budgetType: { type: String, trim: true },
    // Submission workflow fields
    status: { type: String, default: 'Not Submitted' },
    originalLevel: { type: String }, // DIVISION, DEPARTMENT, or REGION
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);
// Add index for better query performance
MealAllowanceSchema.index({ employeeNumber: 1, fiscalYear: 1 });
MealAllowanceSchema.index({ fiscalYear: 1 });
// Check if the model already exists before creating it
module.exports = mongoose.model("MealAllowance", MealAllowanceSchema);
