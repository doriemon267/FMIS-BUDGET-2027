const mongoose = require("mongoose");

/**
 * Fourth-Tranche Salary Standardization (SSL) Law — COS only.
 * Source: Fourth-Tranche PDF (Effective January 1, 2019), officialgazette.gov.ph
 * Simple: Salary Grade + Step 1-8
 */
const FourthTrancheCosTableSchema = new mongoose.Schema({
  salaryGrade: { type: Number, required: true, min: 1, max: 33 },
  step1: { type: Number, required: true, min: 0 },
  step2: { type: Number, required: true, min: 0 },
  step3: { type: Number, default: null },
  step4: { type: Number, default: null },
  step5: { type: Number, default: null },
  step6: { type: Number, default: null },
  step7: { type: Number, default: null },
  step8: { type: Number, default: null },
}, { timestamps: true });

FourthTrancheCosTableSchema.index({ salaryGrade: 1 }, { unique: true });

module.exports = mongoose.model("FourthTrancheCosTable", FourthTrancheCosTableSchema);
