const mongoose = require("mongoose");

const IAsOMCostSchema = new mongoose.Schema(
  {
    fiscalYear: {
      type: String,
      required: true,
    },
    budgetType: {
      type: String,
      required: true,
      default: "INITIAL",
    },
    region: {
      type: String,
      required: true,
    },
    nis: {
      type: Number,
      default: 0,
    },    cis: {
      type: Number,
      default: 0,
    },
    nisSubsidy: {
      type: Number,
      default: 0,
    },
    cisSubsidy: {
      type: Number,
      default: 0,
    },
    processBy: {
      type: String,
    },
    processDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Create a compound index for faster lookups
IAsOMCostSchema.index({ fiscalYear: 1, budgetType: 1, region: 1 }, { unique: true });

module.exports = mongoose.model("IAsOMCost", IAsOMCostSchema);