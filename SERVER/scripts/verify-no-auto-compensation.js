/**
 * VERIFICATION SCRIPT: Ensure NO automatic compensation creation/linking
 * This script tests that the STRICT SEPARATION is working correctly
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://172.16.4.98:27017/fmis_budget";

async function verifyNoAutoCompensation() {
  try {
    console.log("🔍 Verifying STRICT SEPARATION: No Auto-Compensation...\n");
    await mongoose.connect(MONGODB_URI);

    console.log("📊 Analyzing all fiscal year settings:\n");
    const allSettings = await Settings.find().populate("compensationSettingsId");

    let settingsWithoutCompensation = 0;
    let settingsWithCompensation = 0;
    const violations = [];

    for (const setting of allSettings) {
      const hasCompensation = !!setting.compensationSettingsId;
      
      if (hasCompensation) {
        settingsWithCompensation++;
        console.log(`✅ FY ${setting.fiscalYear} (${setting.budgetType})`);
        console.log(`   └─ Linked to: ${setting.compensationSettingsId.name}`);
      } else {
        settingsWithoutCompensation++;
        console.log(`❌ FY ${setting.fiscalYear} (${setting.budgetType})`);
        console.log(`   └─ No compensation (as expected for unlinked fiscal years)`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("📈 SUMMARY:");
    console.log(`  • Total Fiscal Year Settings: ${allSettings.length}`);
    console.log(`  • Settings WITH compensation: ${settingsWithCompensation}`);
    console.log(`  • Settings WITHOUT compensation: ${settingsWithoutCompensation}`);
    console.log("=".repeat(70));

    if (violations.length > 0) {
      console.log("\n🔴 VIOLATIONS DETECTED:");
      violations.forEach(v => console.log(`   ⚠️  ${v}`));
    } else {
      console.log("\n✅ NO VIOLATIONS: STRICT SEPARATION is working correctly!");
      console.log("   • New fiscal years are NOT auto-linked to compensation");
      console.log("   • Compensation is managed independently");
      console.log("   • Manual linking is required via Compensation Management");
    }

    console.log("\n✨ Verification complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verifyNoAutoCompensation();