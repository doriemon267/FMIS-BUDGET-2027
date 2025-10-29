/**
 * MIGRATION SCRIPT: Move Legacy Compensation Fields from Settings to CompensationSettings
 * 
 * This script safely transfers any existing compensation data from the Settings table
 * to the CompensationSettings table. After this runs, the legacy fields will be removed
 * from the Settings model to eliminate duplication.
 * 
 * RUN BEFORE: Removing legacy fields from Settings model
 */

const mongoose = require("mongoose");
const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");

const LEGACY_COMPENSATION_FIELDS = [
  "hazardPay",
  "subsistenceAllowance",
  "honoraria",
  "PERA",
  "uniformAllowance",
  "productivityIncentive",
  "medicalAllowance",
  "childrenAllowance",
  "meal",
  "cashGift",
  "gsisPremium",
  "philhealthPremium",
  "pagibigPremium",
  "employeeCompensation",
  "earnedLeaves",
  "retirementBenefits",
  "terminalLeave",
  "courtAppearance",
  "weekdayMultiplier",
  "weekendMultiplier",
  "subsistenceAllowanceRate",
  "subsistenceAllowanceSTRates",
  "loyaltyPay",
];

async function hasLegacyData(settings) {
  return LEGACY_COMPENSATION_FIELDS.some((field) => {
    const value = settings[field];
    // Check if field has meaningful data (not null, undefined, or default)
    if (field === "medicalAllowance" && value === 200) return false; // default
    if (field === "meal" && value === 200) return false; // default
    return value !== null && value !== undefined;
  });
}

function extractLegacyData(settings) {
  const legacyData = {};
  LEGACY_COMPENSATION_FIELDS.forEach((field) => {
    if (settings[field] !== undefined) {
      legacyData[field] = settings[field];
    }
  });
  return legacyData;
}

async function migrate() {
  try {
    console.log("🔄 Starting Migration: Legacy Settings to CompensationSettings...\n");

    // Connect to database
    if (!mongoose.connection.readyState) {
      const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/fmis_budget";
      await mongoose.connect(mongoUri);
      console.log("✅ Connected to MongoDB\n");
    }

    const settingsList = await Settings.find();
    console.log(`📊 Found ${settingsList.length} Settings records\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let createdCount = 0;
    const migrationLog = [];

    for (const settings of settingsList) {
      const hasLegacy = await hasLegacyData(settings);

      if (!hasLegacy) {
        console.log(`⏭️  SKIP: ${settings.fiscalYear} (${settings.budgetType}) - No legacy data`);
        skippedCount++;
        migrationLog.push({
          fiscalYear: settings.fiscalYear,
          budgetType: settings.budgetType,
          status: "SKIPPED",
          reason: "No legacy compensation data",
        });
        continue;
      }

      console.log(`🔄 Processing: ${settings.fiscalYear} (${settings.budgetType})`);

      const legacyData = extractLegacyData(settings);

      // Check if compensation settings already exists
      let compensationSettings = await CompensationSettings.findOne({
        fiscalYear: settings.fiscalYear,
        budgetType: settings.budgetType,
      });

      if (compensationSettings) {
        // Update existing
        Object.assign(compensationSettings, legacyData);
        await compensationSettings.save();
        console.log(`   ✏️  Updated existing CompensationSettings`);
        migrationLog.push({
          fiscalYear: settings.fiscalYear,
          budgetType: settings.budgetType,
          status: "UPDATED",
        });
        migratedCount++;
      } else {
        // Create new
        compensationSettings = new CompensationSettings({
          fiscalYear: settings.fiscalYear,
          budgetType: settings.budgetType,
          ...legacyData,
          notes: "Auto-migrated from Settings legacy fields",
        });
        await compensationSettings.save();
        console.log(`   ✨ Created new CompensationSettings`);
        migrationLog.push({
          fiscalYear: settings.fiscalYear,
          budgetType: settings.budgetType,
          status: "CREATED",
        });
        createdCount++;
      }

      // Update Settings to reference CompensationSettings
      settings.compensationSettingsId = compensationSettings._id;
      await settings.save();
      console.log(`   🔗 Linked CompensationSettings ID to Settings\n`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`Total Settings processed: ${settingsList.length}`);
    console.log(`  ✨ Created new CompensationSettings: ${createdCount}`);
    console.log(`  ✏️  Updated existing CompensationSettings: ${migratedCount}`);
    console.log(`  ⏭️  Skipped (no legacy data): ${skippedCount}`);
    console.log("=".repeat(60) + "\n");

    // Save migration log
    const fs = require("fs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = `migration-log-${timestamp}.json`;
    fs.writeFileSync(
      `${__dirname}/${logFile}`,
      JSON.stringify(migrationLog, null, 2)
    );
    console.log(`📋 Migration log saved to: ${logFile}\n`);

    console.log("⚠️  NEXT STEPS:");
    console.log("1. Review the migration log above");
    console.log("2. Verify CompensationSettings were created correctly");
    console.log("3. Remove legacy fields from Settings model");
    console.log("4. Update code to reference CompensationSettings\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrate();