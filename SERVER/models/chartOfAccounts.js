// models/ChartOfAccounts.js
const mongoose = require("mongoose");
const { mainConnection } = require("../config/mongo_db");

const chartOfAccountsSchema = new mongoose.Schema(
  {
    accountClass: { type: String },
    lineItem: { type: String },
    sublineItem: { type: String },
    accountingTitle: { type: String, required: true },
    category: [{ type: String }],
    uacsCode: { type: String, required: true, index: true },
    normalBalance: { type: String, min: 0 },
    mooes: { type: mongoose.Schema.Types.ObjectId, ref: "MooeProposal" },
  },
  { timestamps: true }
);

// ✅ Use existing model if already compiled to prevent OverwriteModelError
module.exports =
  mainConnection.models.ChartOfAccounts ||
  mainConnection.model("chart_of_accounts", chartOfAccountsSchema);
