const mongoose = require("mongoose");

const incomeSchema = new mongoose.Schema(
  {
    particulars: {
      type: String,
      required: true,
    },
    cost: {
      type: Number,
      default: 0,
    },
    incomecategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncomeCategory",
      required: true,
    },
    subcategory: {
      type: String,
    },
    category: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    fiscalYear: {
      type: String,
      required: true,
    },
    budgetType: {
      type: String,
      required: true,
    },
    region: {
      type: String,
    },
    processBy: {
      type: String,
    },
    processDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      default: "Not Submitted",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Income", incomeSchema);
