const mongoose = require("mongoose");

const DraftProposalSchema = new mongoose.Schema(
  {
    fiscalYear: { 
      type: String, 
      required: true 
    },
    budgetType: { 
      type: String, 
      required: true 
    },
    region: { 
      type: String, 
      required: true 
    },
    processBy: { 
      type: String, 
      required: true 
    },
    status: { 
      type: String, 
      default: "Draft" 
    },
    // Store any additional data needed for the draft
    cobExpenditures: [
      {
        name: String,
        description: String,
        amount: Number
      }
    ],
    // Add any other fields needed for drafts
    totalAmount: {
      type: Number,
      default: 0
    },
    breakdown: {
      type: Object,
      default: {}
    },
    // Track when the draft was last edited
    lastEditedAt: {
      type: Date,
      default: Date.now
    },
    // Add category field
    category: {
      type: String,
      enum: ['personnel', 'mooe', 'capitalOutlay', 'income', 'uncategorized'],
      default: 'uncategorized'
    }
  },
  { timestamps: true }
);

// Create compound index for uniqueness
DraftProposalSchema.index(
  { fiscalYear: 1, budgetType: 1, processBy: 1, region: 1 },
  { unique: true }
);

module.exports = mongoose.model("DraftProposal", DraftProposalSchema);
