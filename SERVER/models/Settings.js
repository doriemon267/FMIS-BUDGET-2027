// models/Settings.js
const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    fiscalYear: { type: String, required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    budgetType: { type: String, enum: ["Initial", "NEP", "GAA"], required: true },
    hazardPay: { type: Number },
    subsistenceAllowance: { type: Number },
    honoraria: { type: Number},
    PERA: { type: Number},
    uniformAllowance: { type: Number},
    productivityIncentive: { type: Number },
    medicalAllowance: { type: Number, default: 200 }, // Fixed 200 pesos per month per dependent
    childrenAllowance: { type: Number },
    meal: { type: Number, default: 200 }, // Fixed 200 pesos per month for eligible employees
    cashGift: { type: Number },
    gsisPremium: { type: Number },
    philhealthPremium: { type: Number },
    pagibigPremium: { type: Number },
    employeeCompensation: { type: Number },
    earnedLeaves: { type: Number },
    retirementBenefits: { type: Number },
    terminalLeave: { type: Number },
    courtAppearance: { type: Number },

    weekdayMultiplier: { type: Number },
    weekendMultiplier: { type: Number},
// -    RATA: [{ type: mongoose.Schema.Types.ObjectId, ref: "RATA" }],
// +    // RATA field is now deprecated in settings.
// +    // RATA: [{ type: mongoose.Schema.Types.ObjectId, ref: "RATA" }],
    subsistenceAllowanceRate: { type: Number },
    subsistenceAllowanceSTRates: {
      highRisk: {
        fifteenOrMoreDays: { type: Number },
        eightToFourteenDays: { type: Number },
        lessThanEightDays: { type: Number },
      },
      lowRisk: {
        fifteenOrMoreDays: { type: Number },
        eightToFourteenDays: { type: Number },
        lessThanEightDays: { type: Number },
      },
    },

    loyaltyPay: {
      baseYears: { type: Number}, // First 10 years
      baseAmount: { type: Number }, // ₱10,000
      succeedingInterval: { type: Number }, // Every 5 years
      succeedingAmount: { type: Number }, // ₱5,000
      cutoffDate: {
        type: String,
        default: "06-22" // MM-DD format for June 22 cutoff
      },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure compound unique index on (fiscalYear, budgetType)
settingsSchema.index({ fiscalYear: 1, budgetType: 1 }, { unique: true });

module.exports = mongoose.model("Settings", settingsSchema);
