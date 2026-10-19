const mongoose = require("mongoose");
const incomeCategorySchema = new mongoose.Schema({
  incomeCategoryName: { type: String, required: true }, // Remove unique constraint for region-specific categories
  name: { type: String }, // Remove unique constraint for region-specific categories
  description: { type: String, default: "" },
  incomeSubcategoryName: [{ type: String }],
  isGlobal: { type: Boolean, default: false }, // Add isGlobal field
  regions: [{ type: String }], // Add regions array field
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "IncomeCategoryGroup",
    default: null,
  }, // Reference to category group
  fiscalYears: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FiscalYear",
    },
  ], // Array of linked fiscal years
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
// Pre-save middleware to ensure name field is set
incomeCategorySchema.pre('save', function() {
  // Set the name field to match incomeCategoryName if not explicitly set
  if (this.incomeCategoryName && !this.name) {
    this.name = this.incomeCategoryName;
  }
  // Update the updatedAt field
  this.updatedAt = new Date();
});
// Add compound index for region-aware uniqueness
// This allows same category name in different regions but prevents duplicates within same region
incomeCategorySchema.index({ incomeCategoryName: 1, isGlobal: 1 });
incomeCategorySchema.index({ incomeCategoryName: 1, regions: 1 });
const IncomeCat = mongoose.model("IncomeCategory", incomeCategorySchema);
module.exports = IncomeCat;
