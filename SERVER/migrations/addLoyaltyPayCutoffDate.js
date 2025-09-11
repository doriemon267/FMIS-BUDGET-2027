/**
 * Migration script to add loyalty pay cutoff date to existing settings
 * Run this script to update existing Settings documents with the new cutoffDate field
 */
const mongoose = require("mongoose");
const Settings = require("../models/Settings");
// Database connection string - update this to match your environment
const DB_CONNECTION = process.env.MONGODB_URI || "mongodb://localhost:27017/budget-fmis";
async function migrateLoyaltyPayCutoffDate() {
  try {
    // Connect to database
    await mongoose.connect(DB_CONNECTION);
    // Find all settings that have loyaltyPay but no cutoffDate
    const settingsToUpdate = await Settings.find({
      "loyaltyPay": { $exists: true },
      "loyaltyPay.cutoffDate": { $exists: false }
    });
    if (settingsToUpdate.length === 0) {
      return;
    }
    // Update each settings document
    let updatedCount = 0;
    for (const setting of settingsToUpdate) {
      try {
        // Add the default cutoff date
        if (!setting.loyaltyPay.cutoffDate) {
          setting.loyaltyPay.cutoffDate = "06-22"; // June 22 default
          await setting.save();
          updatedCount++;
          }
      } catch (error) {
        console.error(`❌ Error updating settings for fiscal year ${setting.fiscalYear}:`, error.message);
      }
    }
    // Verify the migration
    const verifyCount = await Settings.countDocuments({
      "loyaltyPay.cutoffDate": "06-22"
    });
    } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.disconnect();
    }
}
// Run the migration if this file is executed directly
if (require.main === module) {
  migrateLoyaltyPayCutoffDate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Migration script failed:", error);
      process.exit(1);
    });
}
module.exports = migrateLoyaltyPayCutoffDate;