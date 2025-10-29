/**
 * VERIFICATION SCRIPT: Check current state of Compensation data
 * Shows what's in the database and what the API will return
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

const Settings = require("../models/Settings");
const CompensationSettings = require("../models/CompensationSettings");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://172.16.4.98:27017/fmis_budget";

async function verify() {
  try {
    console.log("🔍 Verifying Compensation Data...\n");
    await mongoose.connect(MONGODB_URI);

    // Get all compensations
    const compensations = await CompensationSettings.find().sort({ createdAt: -1 });
    console.log(`\n📊 TOTAL COMPENSATION SETTINGS: ${compensations.length}\n`);

    let totalLinks = 0;
    let linkedCount = 0;

    // For each compensation, show what will be returned
    for (const comp of compensations) {
      const linkedSettings = await Settings.find({
        compensationSettingsId: comp._id,
      }).select("_id fiscalYear budgetType");

      const linkedFiscalYears = linkedSettings.map((s) => s._id);

      if (linkedFiscalYears.length > 0) {
        linkedCount++;
      }
      totalLinks += linkedFiscalYears.length;

      console.log(`✅ ${comp.name}`);
      console.log(`   ID: ${comp._id}`);
      console.log(`   Description: ${comp.description || "N/A"}`);
      console.log(`   PERA: ₱${(comp.PERA || 0).toLocaleString()}`);
      console.log(`   Medical Allowance: ₱${(comp.medicalAllowance || 0).toLocaleString()}`);
      console.log(`   PhilHealth: ${((comp.philhealthPremium || 0) * 100).toFixed(2)}%`);
      console.log(`   Created: ${new Date(comp.createdAt).toLocaleDateString()}`);
      console.log(`   Linked Fiscal Years: ${linkedFiscalYears.length}`);

      if (linkedSettings.length > 0) {
        linkedSettings.forEach((s) => {
          console.log(`     📌 FY ${s.fiscalYear} (${s.budgetType}) → ${s._id}`);
        });
      } else {
        console.log(`     ⚠️  Not linked to any fiscal year`);
      }
      console.log("");
    }

    console.log("=".repeat(70));
    console.log("📈 SUMMARY STATS (for dashboard):");
    console.log(`  • Total Compensation Settings: ${compensations.length}`);
    console.log(`  • Linked to Fiscal Years: ${linkedCount}`);
    console.log(`  • Total FY Links: ${totalLinks}`);
    console.log(`  • Not Yet Linked: ${compensations.length - linkedCount}`);
    console.log("=".repeat(70) + "\n");

    // Also show settings that have no compensation linked
    console.log("📋 FISCAL YEAR SETTINGS STATUS:\n");
    const allSettings = await Settings.find().sort({ fiscalYear: 1, budgetType: 1 });
    
    for (const setting of allSettings) {
      const isLinked = !!setting.compensationSettingsId;
      const comp = isLinked
        ? await CompensationSettings.findById(setting.compensationSettingsId)
        : null;

      console.log(
        `${isLinked ? "✅" : "❌"} FY ${setting.fiscalYear} (${setting.budgetType})`
      );
      console.log(`   ID: ${setting._id}`);
      if (comp) {
        console.log(`   → Linked to: ${comp.name} (${comp._id})`);
      } else {
        console.log(`   → Not linked to any compensation template`);
      }
    }

    console.log("\n🎉 Verification complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

verify();