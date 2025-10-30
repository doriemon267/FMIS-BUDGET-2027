const mongoose = require("mongoose");
const RATASchema = new mongoose.Schema(
  {
    SG:   { type: String, required: true },
    RA:   { type: Number, required: true }, // Representation Allowance
    TA:   { type: Number, required: true }, // Transportation Allowance
    RATA: { type: Number, required: true }, // monthly rate (RA + TA)
    
    // ✅ NEW: Linking to specific Fiscal Years and Budget Types
    // Users can specify which fiscal year/budget type combinations use this RATA rate
    linkedFiscalYears: [
      {
        settingsId: { type: mongoose.Schema.Types.ObjectId, ref: "Settings" },
        fiscalYear: { type: String }, // e.g., "FY-2024"
        budgetType: { type: String }, // "Initial", "NEP", "GAA"
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
      }
    ],
    
    // Summary count of linked fiscal years (for quick filtering)
    linkedBudgetTypes: { type: [String], default: [] }, // e.g., ["Initial", "NEP"]
  },
  { timestamps: true }
);
module.exports = mongoose.model("RATA", RATASchema);