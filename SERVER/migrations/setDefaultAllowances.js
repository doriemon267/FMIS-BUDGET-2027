/**
 * Migration script to set default medical and meal allowances to 200 pesos per month
 * Run this script to update existing Settings documents with the new default values
 */

const mongoose = require("mongoose");
const Settings = require("../models/Settings");

// Database connection string - update this to match your environment
const DB_CONNECTION = process.env.MONGODB_URI || "mongodb://localhost:27017/budget-fmis";

async function setDefaultAllowances() {
  try {
    console.log("🔄 Starting medical and meal allowance default values migration...");
    
    // Connect to database
    await mongoose.connect(DB_CONNECTION);
    console.log("✅ Connected to database");

    // Find all settings that need updating
    const settingsToUpdate = await Settings.find({
      $or: [
        { medicalAllowance: { $exists: false } },
        { medicalAllowance: null },
        { medicalAllowance: 0 },
        { meal: { $exists: false } },
        { meal: null },
        { meal: 0 }
      ]
    });

    console.log(`📊 Found ${settingsToUpdate.length} settings documents to update`);

    if (settingsToUpdate.length === 0) {
      console.log("✅ No settings need updating. Migration complete!");
      return;
    }

    // Update each settings document
    let updatedCount = 0;
    for (const setting of settingsToUpdate) {
      try {
        let needsUpdate = false;
        
        // Set medical allowance to 200 if not set or is 0
        if (!setting.medicalAllowance || setting.medicalAllowance === 0) {
          setting.medicalAllowance = 200;
          needsUpdate = true;
          console.log(`📋 Setting medical allowance to 200 for fiscal year: ${setting.fiscalYear}`);
        }
        
        // Set meal allowance to 200 if not set or is 0
        if (!setting.meal || setting.meal === 0) {
          setting.meal = 200;
          needsUpdate = true;
          console.log(`🍽️ Setting meal allowance to 200 for fiscal year: ${setting.fiscalYear}`);
        }
        
        if (needsUpdate) {
          await setting.save();
          updatedCount++;
          console.log(`✅ Updated settings for fiscal year: ${setting.fiscalYear}`);
        }
      } catch (error) {
        console.error(`❌ Error updating settings for fiscal year ${setting.fiscalYear}:`, error.message);
      }
    }

    console.log(`🎉 Migration completed successfully!`);
    console.log(`📈 Updated ${updatedCount} out of ${settingsToUpdate.length} settings documents`);
    
    // Verify the migration
    const verifyMedical = await Settings.countDocuments({
      medicalAllowance: 200
    });
    const verifyMeal = await Settings.countDocuments({
      meal: 200
    });
    console.log(`✅ Verification: ${verifyMedical} settings now have medical allowance = 200`);
    console.log(`✅ Verification: ${verifyMeal} settings now have meal allowance = 200`);

    // Show current settings summary
    const allSettings = await Settings.find({}, 'fiscalYear medicalAllowance meal isActive').sort({ fiscalYear: -1 });
    console.log("\n📋 Current Settings Summary:");
    console.log("Fiscal Year | Medical | Meal | Active");
    console.log("------------|---------|------|-------");
    allSettings.forEach(setting => {
      const medical = setting.medicalAllowance || 'N/A';
      const meal = setting.meal || 'N/A';
      const active = setting.isActive ? 'Yes' : 'No';
      console.log(`${setting.fiscalYear.padEnd(11)} | ${medical.toString().padEnd(7)} | ${meal.toString().padEnd(4)} | ${active}`);
    });

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log("🔌 Database connection closed");
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  setDefaultAllowances()
    .then(() => {
      console.log("🏁 Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = setDefaultAllowances;
