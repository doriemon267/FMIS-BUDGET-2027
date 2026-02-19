const mongoose = require("mongoose");

/**
 * SSL4 (Fourth Tranche) Salary Table for COS only — hiwalay na table.
 * Based on Fourth-Tranche Salary Standardization SSL Law (Effective Jan 1, 2019).
 * Permanent at Casual magkasama sa SalarySelection (shared salary table).
 */
const CPCSSalaryTableSchema = new mongoose.Schema({
  salaryGrade: { type: Number, required: true, min: 1, max: 30 },
  cpcs1JobGrade: { type: Number, required: true, min: 1, max: 30 },
  cpcs2PayGrade: { type: Number, required: true, min: 1, max: 30 },
  // Category 1: Step 1 to Step 8 (monthly salary amounts)
  step1: { type: Number, required: true, min: 0 },
  step2: { type: Number, required: true, min: 0 },
  step3: { type: Number, required: true, min: 0 },
  step4: { type: Number, required: true, min: 0 },
  step5: { type: Number, required: true, min: 0 },
  step6: { type: Number, required: true, min: 0 },
  step7: { type: Number, required: true, min: 0 },
  step8: { type: Number, required: true, min: 0 },
}, { timestamps: true });

CPCSSalaryTableSchema.index({ salaryGrade: 1 }, { unique: true });
CPCSSalaryTableSchema.index({ cpcs1JobGrade: 1 });
CPCSSalaryTableSchema.index({ cpcs2PayGrade: 1 });

module.exports = mongoose.model("CPCSSalaryTable", CPCSSalaryTableSchema);
