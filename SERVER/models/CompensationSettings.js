// models/CompensationSettings.js
const mongoose = require("mongoose");

const compensationSettingsSchema = new mongoose.Schema(
  {
    // ✅ STRICT SEPARATION: Compensation Settings are STANDALONE, NOT tied to fiscal years
    // Multiple fiscal years can share the SAME compensation settings
    // This prevents auto-creation of compensation during fiscal year creation
    
    // Compensation name for identification (e.g., "COMPENSATION 1", "Standard 2025")
    name: { type: String, required: true },
    
    // Description/Notes
    description: { type: String },
    
    // Personnel Services Compensation
    hazardPay: { type: Number },
    subsistenceAllowance: { type: Number },
    honoraria: { type: Number },
    PERA: { type: Number },
    uniformAllowance: { type: Number },
    productivityIncentive: { type: Number },
    
    // Allowances
    medicalAllowance: { type: Number, default: 200 }, // Fixed 200 pesos per month per dependent
    // NEW: Additional Medical allowance (separate from base medicalAllowance)
    additionalMedical: { type: Number },
    ChildrenAllowance: { type: Number },
    meal: { type: Number, default: 200 }, // Fixed 200 pesos per month for eligible employees
    cashGift: { type: Number },
    courtAppearance: { type: Number },
    
    // Premium/Contributions
    gsisPremium: { type: Number },          // % of annual salary
    providentFund: { type: Number },        // % of annual salary (PERMANENT only)
    philhealthPremium: { type: Number },    // % of monthly salary (total, split EE/ER)
    pagibigPremium: { type: Number },       // fixed monthly amount
    employeeCompensation: { type: Number }, // fixed monthly amount (annualized in PS)
    
    // Leave & Benefits
    // earnedLeaves stores the conversion factor; days are configured separately.
    earnedLeaves: { type: Number, default: 0.0481927, min: 0 },
    earnedLeaveDays: {
      type: Number,
      default: 30,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Earned leave days must be a finite number",
      },
    },
    retirementBenefits: { type: Number },
    terminalLeave: { type: Number },
    
    // Overtime Rates
    weekdayMultiplier: { type: Number },
    weekendMultiplier: { type: Number },
    
    // Subsistence Allowance Rates
    subsistenceAllowanceRate: { type: Number },
    subsistenceAllowanceMonthlyTiers: {
      eightHoursOrMore: { type: Number, default: 150 },
      sixToLessThanEight: { type: Number, default: 125 },
      fiveToLessThanSix: { type: Number, default: 100 },
      fourToLessThanFive: { type: Number, default: 75 },
      belowFour: { type: Number, default: 0 },
      workDaysPerMonth: { type: Number, default: 22 },
    },
    subsistenceAllowanceHourThresholds: {
      eightHoursOrMoreMin: { type: Number, default: 8 },
      sixToLessThanEightMin: { type: Number, default: 6 },
      fiveToLessThanSixMin: { type: Number, default: 5 },
      fourToLessThanFiveMin: { type: Number, default: 4 },
    },
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
    
    // Loyalty Pay Configuration
    loyaltyPay: {
      baseYears: { type: Number }, // First 10 years
      baseAmount: { type: Number }, // ₱10,000
      succeedingInterval: { type: Number }, // Every 5 years
      succeedingAmount: { type: Number }, // ₱5,000
      cutoffDate: {
        type: String,
        default: "06-22", // MM-DD format for June 22 cutoff
      },
    },
    
    // Audit trail
    lastModifiedBy: { type: String }, // User ID or username
    lastModifiedReason: { type: String }, // Why it was modified
    notes: { type: String },
  },
  { timestamps: true }
);

// ✅ NO UNIQUE INDEX on fiscal year - compensation settings are truly standalone and reusable
// Users can reuse the same compensation across multiple fiscal years

module.exports = mongoose.model(
  "CompensationSettings",
  compensationSettingsSchema
);
