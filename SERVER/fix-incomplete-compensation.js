/**
 * Fix incomplete CompensationSettings records
 * Ensures all fields are properly initialized with defaults
 */

const mongoose = require("mongoose");
const CompensationSettings = require("./models/CompensationSettings");
require("dotenv").config({ path: "./.env" });

const DEFAULTS = {
  hazardPay: 0,
  subsistenceAllowance: 0,
  honoraria: 0,
  PERA: 0,
  uniformAllowance: 0,
  productivityIncentive: 0,
  medicalAllowance: 200,
  childrenAllowance: 0,
  meal: 200,
  cashGift: 0,
  courtAppearance: 0,
  gsisPremium: 0,
  philhealthPremium: 0,
  pagibigPremium: 0,
  employeeCompensation: 0,
  earnedLeaves: 0,
  retirementBenefits: 0,
  terminalLeave: 0,
  weekdayMultiplier: 1.25,
  weekendMultiplier: 1.5,
  subsistenceAllowanceRate: 0,
  subsistenceAllowanceSTRates: {
    highRisk: {
      fifteenOrMoreDays: 0.3,
      eightToFourteenDays: 0.23,
      lessThanEightDays: 0.15,
    },
    lowRisk: {
      fifteenOrMoreDays: 0.15,
      eightToFourteenDays: 0.12,
      lessThanEightDays: 0.1,
    },
  },
  loyaltyPay: {
    baseYears: 10,
    baseAmount: 10000,
    succeedingInterval: 5,
    succeedingAmount: 5000,
    cutoffDate: "06-22",
  },
};

async function fixIncompleteCompensations() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    const compensations = await CompensationSettings.find();
    console.log(`\n📦 Found ${compensations.length} compensation record(s)\n`);

    for (const comp of compensations) {
      console.log(`Processing: ${comp.name} (${comp._id})`);

      const updated = {
        ...comp.toObject(),
      };

      let hasChanges = false;

      // Check each field and add missing ones
      for (const [field, defaultValue] of Object.entries(DEFAULTS)) {
        if (field === "subsistenceAllowanceSTRates" || field === "loyaltyPay") {
          // Handle nested objects
          if (!updated[field]) {
            console.log(`  ❌ Missing ${field} - adding defaults`);
            updated[field] = defaultValue;
            hasChanges = true;
          } else if (field === "loyaltyPay") {
            // Check loyaltyPay structure
            const requiredFields = ["baseYears", "baseAmount", "succeedingInterval", "succeedingAmount", "cutoffDate"];
            const missingFields = requiredFields.filter(f => updated[field][f] === undefined);
            if (missingFields.length > 0) {
              console.log(`  ⚠️  loyaltyPay missing fields: ${missingFields.join(", ")} - adding defaults`);
              for (const f of missingFields) {
                updated[field][f] = defaultValue[f];
              }
              hasChanges = true;
            }
          }
        } else {
          if (updated[field] === undefined || updated[field] === null) {
            console.log(`  ❌ Missing ${field} - adding default: ${defaultValue}`);
            updated[field] = defaultValue;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        console.log(`  ✅ Updating with complete data...\n`);
        await CompensationSettings.findByIdAndUpdate(comp._id, updated, {
          new: true,
          runValidators: true,
        });
      } else {
        console.log(`  ✅ Already complete - no changes needed\n`);
      }
    }

    console.log("✅ All compensations fixed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixIncompleteCompensations();