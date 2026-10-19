const mongoose = require("mongoose");
const titleMappingSchema = new mongoose.Schema(
  {
    sublineItem: {
      type: String,
      required: true,
      trim: true,
    },
    accountingTitle: {
      type: String,
      required: true,
      trim: true,
    },
    uacsCode: {
      type: String,
      required: true,
      trim: true,
      unique: true, // Ensure no duplicate UACS codes
    },
    accountClass: {
      type: String,
      required: true,
      enum: ["Asset", "Liability", "Equity", "Revenue", "Expense"],
    },
    lineItem: {
      type: String,
      required: true,
      trim: true,
    },
    normalBalance: {
      type: String,
      enum: ["Debit", "Credit"],
      default: "Debit",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Reference to the original chart of accounts entry
    chartOfAccountsRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChartOfAccounts",
      required: false, // Optional in case we want to create mappings without existing chart entries
    },
  },
  {
    timestamps: true,
  }
);
// Index for better query performance
titleMappingSchema.index({ sublineItem: 1, uacsCode: 1 });
titleMappingSchema.index({ accountClass: 1, lineItem: 1 });
// Virtual to get formatted display name
titleMappingSchema.virtual("displayName").get(function () {
  return `${this.accountingTitle} (${this.uacsCode})`;
});
// Method to check if this mapping is for capital outlay
titleMappingSchema.methods.isCapitalOutlay = function () {
  const capitalOutlayKeywords = [
    "capital",
    "outlay",
    "infrastructure",
    "building",
    "machinery",
    "equipment",
    "transportation",
    "furniture",
    "land",
  ];
  const searchText = `${this.lineItem} ${this.sublineItem} ${this.accountingTitle}`.toLowerCase();
  return capitalOutlayKeywords.some(keyword => searchText.includes(keyword));
};
// Static method to get capital outlay mappings
titleMappingSchema.statics.getCapitalOutlayMappings = function () {
  return this.find({
    $or: [
      { lineItem: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } },
      { sublineItem: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } },
      { accountingTitle: { $regex: /capital|outlay|infrastructure|building|machinery|equipment|transportation|furniture|land/i } }
    ],
    isActive: true
  }).sort({ sublineItem: 1, accountingTitle: 1 });
};
// Static method to get mappings by subline item
titleMappingSchema.statics.getBySublineItem = function (sublineItem) {
  return this.find({ 
    sublineItem: sublineItem,
    isActive: true 
  }).sort({ accountingTitle: 1 });
};
// Pre-save middleware to ensure UACS code format
titleMappingSchema.pre("save", function () {
  // Validate UACS code format (e.g., 5-01-01-010)
  const uacsPattern = /^[0-9]+-[0-9]+-[0-9]+-[0-9]+$/;
  if (!uacsPattern.test(this.uacsCode)) {
    const error = new Error("UACS Code must be in format: X-XX-XX-XXX (e.g., 5-01-01-010)");
    throw error;
  }
});
module.exports = mongoose.model("TitleMapping", titleMappingSchema);