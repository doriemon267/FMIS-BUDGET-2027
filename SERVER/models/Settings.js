// models/Settings.js
const mongoose = require("mongoose");

const budgetPeriodSchema = new mongoose.Schema(
  {
    periodName: { type: String, required: true }, // e.g., "Phase 1", "Phase 2", "Extension"
    startDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const settingsSchema = new mongoose.Schema(
  {
    fiscalYear: { type: String, required: true },
    budgetType: { type: String, enum: ["Initial", "NEP", "GAA"], required: true },
    
    // Region-based application (NEW)
    applicableRegions: {
      type: [String], // ["All"] or specific region IDs
      default: ["All"],
    },
    
    // Budget periods with versioning (NEW)
    budgetPeriods: [budgetPeriodSchema],
    
    // Backward compatibility fields (deprecated but kept for migration)
    startDate: { type: Date },
    dueDate: { type: Date },
    
    // Compensation settings reference (moved to separate model)
    compensationSettingsId: { type: mongoose.Schema.Types.ObjectId, ref: "CompensationSettings" },
    
    // Overall activation status
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure compound unique index on (fiscalYear, budgetType)
settingsSchema.index({ fiscalYear: 1, budgetType: 1 }, { unique: true });

// ✅ STRICT SEPARATION: Pre-save hook to ensure compensation is never auto-created
// This is the final safety check - NEW fiscal years should NEVER get auto-linked compensation
settingsSchema.pre('save', function(next) {
  // Only apply this check for NEW documents (not updates)
  if (this.isNew) {
    // Verify: new fiscal years MUST have null compensationSettingsId
    if (this.compensationSettingsId !== null && this.compensationSettingsId !== undefined) {
      const error = new Error('STRICT SEPARATION VIOLATION: New fiscal year settings cannot have compensation auto-linked');
      error.code = 'COMPENSATION_AUTO_LINK_PREVENTED';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Settings", settingsSchema);
