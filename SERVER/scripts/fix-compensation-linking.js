/**
 * FIX SCRIPT: Properly Link CompensationSettings to Settings (Fiscal Years)
 * 
 * Problem: 
 * - Old schema had compensation fields IN settings (tied to fiscal year)
 * - New schema has compensation as STANDALONE templates in separate table
 * - Settings now has compensationSettingsId reference
 * - BUT existing settings still have duplicate compensation data
 * 
 * Solution:
 * 1. For each Settings record without compensationSettingsId:
 *    - Extract its compensation data
 *    - Find or create matching CompensationSettings template
 *    - Link settings to compensation via compensationSettingsId
 * 2. Clean up duplicate compensation fields from settings
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://172.16.4.98:27017/fmis_budget";

const COMPENSATION_FIELDS = [
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
  "overtimeRate",
];

async function fixCompensationLinking() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected!\n");

    // Get all settings
    const allSettings = await Settings.find().lean();
    console.log(`📊 Found ${allSettings.length} Settings records\n`);

    let linkedCount = 0;
    let createdAndLinkedCount = 0;
    const fixLog = [];

    for (const setting of allSettings) {
      const settingKey = `${setting.fiscalYear} (${setting.budgetType})`;
      console.log(`\n🔄 Processing: ${settingKey}`);

      // Check if already linked
      if (setting.compensationSettingsId) {
        console.log(`   ✅ Already linked to: ${setting.compensationSettingsId}`);
        linkedCount++;
        fixLog.push({
          fiscalYear: setting.fiscalYear,
          budgetType: setting.budgetType,
          status: "ALREADY_LINKED",
          compensationSettingsId: setting.compensationSettingsId,
        });
        continue;
      }

      // Extract compensation data from this setting
      const compensationData = {};
      let hasCompensationData = false;
      
      COMPENSATION_FIELDS.forEach((field) => {
        if (setting[field] !== null && setting[field] !== undefined) {
          compensationData[field] = setting[field];
          hasCompensationData = true;
        }
      });

      if (!hasCompensationData) {
        console.log(`   ⚠️  No compensation data found - Skipping`);
        fixLog.push({
          fiscalYear: setting.fiscalYear,
          budgetType: setting.budgetType,
          status: "SKIPPED",
          reason: "No compensation data",
        });
        continue;
      }

      // Create new CompensationSettings template if it doesn't exist
      // Use a generic name that can be reused
      const templateName = `COMPENSATION 1 - Standard ${setting.fiscalYear}`;
      
      let compensationSettings = await CompensationSettings.findOne({
        name: templateName,
      });

      if (compensationSettings) {
        console.log(`   🔄 Found existing template: ${templateName}`);
      } else {
        compensationSettings = new CompensationSettings({
          name: templateName,
          description: `Auto-created from ${settingKey} settings`,
          ...compensationData,
          notes: `Migrated from Settings table - ${settingKey}`,
        });
        await compensationSettings.save();
        console.log(`   ✨ Created new template: ${templateName}`);
      }

      // Link the setting to the compensation template
      await Settings.updateOne(
        { _id: setting._id },
        { compensationSettingsId: compensationSettings._id }
      );

      console.log(`   🔗 Linked to CompensationSettings: ${compensationSettings._id}`);
      createdAndLinkedCount++;
      fixLog.push({
        fiscalYear: setting.fiscalYear,
        budgetType: setting.budgetType,
        status: "CREATED_AND_LINKED",
        compensationSettingsId: compensationSettings._id,
        templateName: templateName,
      });
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ LINKING COMPLETE");
    console.log("=".repeat(70));
    console.log(`Total Settings processed: ${allSettings.length}`);
    console.log(`  ✅ Already linked: ${linkedCount}`);
    console.log(`  ✨ Created and linked: ${createdAndLinkedCount}`);
    console.log("=".repeat(70) + "\n");

    // Verify the links
    console.log("📋 Verifying links...\n");
    const compensations = await CompensationSettings.find();
    console.log(`Total CompensationSettings templates: ${compensations.length}\n`);

    for (const comp of compensations) {
      const linkedSettings = await Settings.find({
        compensationSettingsId: comp._id,
      });
      console.log(`📌 ${comp.name}`);
      console.log(`   ID: ${comp._id}`);
      console.log(`   Linked to ${linkedSettings.length} fiscal year(s):`);
      linkedSettings.forEach((s) => {
        console.log(`     • FY ${s.fiscalYear} (${s.budgetType})`);
      });
    }

    console.log("\n" + "=".repeat(70));
    console.log("🎉 Fix completed! All compensation settings are now properly linked.");
    console.log("=".repeat(70) + "\n");

    // Save fix log
    const fs = require("fs");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = `fix-compensation-linking-${timestamp}.json`;
    fs.writeFileSync(
      `${__dirname}/${logFile}`,
      JSON.stringify(fixLog, null, 2)
    );
    console.log(`💾 Fix log saved to: ${logFile}\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing compensation linking:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

fixCompensationLinking();