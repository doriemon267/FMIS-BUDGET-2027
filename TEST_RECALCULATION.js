/**
 * Test script to verify recalculation with org keys works properly
 */

require('dotenv').config({ path: './SERVER/.env' });
const mongoose = require('mongoose');
const PersonnelServices = require('./SERVER/models/PersonnelServices');
const Proposal = require('./SERVER/models/Proposal');

(async () => {
  try {
    // Connect
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find a proposal with PersonnelServices
    console.log("\n=== Finding test proposal ===");
    const proposal = await Proposal.findOne().limit(1);
    
    if (!proposal) {
      console.log("No proposals found!");
      process.exit(0);
    }
    
    console.log("Found proposal:", {
      _id: proposal._id,
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department
    });
    
    // Find PersonnelServices for this proposal
    console.log("\n=== Finding PersonnelServices ===");
    const ps = await PersonnelServices.findOne({
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region
    });
    
    if (!ps) {
      console.log("No PersonnelServices found for this proposal!");
      process.exit(0);
    }
    
    console.log("Found PersonnelServices:", {
      _id: ps._id,
      designation: ps.designation,
      chargedToIncomeEligible: ps.chargedToIncomeEligible,
      fiscalYear: ps.fiscalYear,
      budgetType: ps.budgetType,
      region: ps.region,
      department: ps.department
    });
    
    // Prepare org keys
    const keys = {
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      region: proposal.region,
      department: proposal.department
    };
    
    // Test recalculation with keys
    console.log("\n=== Testing recalculation with org keys ===");
    const recalculateAndSaveProposalTotals = require('./SERVER/utils/recalculateProposalTotals');
    
    console.log("Calling recalculation with keys:", keys);
    const result = await recalculateAndSaveProposalTotals({ keys });
    
    console.log("Recalculation successful!");
    console.log("Result:", {
      projectedIncome: result?.projectedIncome,
      projectedSubsidy: result?.projectedSubsidy,
      projectedMooe: result?.projectedMooe,
      projectedCapitalOutlay: result?.projectedCapitalOutlay
    });
    
    await mongoose.disconnect();
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
})();
