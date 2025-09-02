const mongoose = require("mongoose");

const CapitalOutlayDetailsSchema = new mongoose.Schema(
  {
    capital_outlay_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CapitalOutlay",
      required: true,
    },
    particulars: {
      type: String,
      required: true,
    },
    income_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subsidy_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    processBy: {
      type: String,
      required: true,
    },
    processDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
CapitalOutlayDetailsSchema.index({ capital_outlay_id: 1 });

module.exports = mongoose.model("CapitalOutlayDetails", CapitalOutlayDetailsSchema);