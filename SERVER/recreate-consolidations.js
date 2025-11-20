require('dotenv').config();
const mongoose = require('mongoose');
const BRDConsolidation = require('./models/BRDConsolidation');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');
const consolidationService = require('./utils/consolidationService');
// Register Region model
require('./models/Region');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== DELETING OLD CONSOLIDATION RECORDS ===');
    const deleteResult = await BRDConsolidation.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} records`);
    
    console.log('\n=== RECREATING CONSOLIDATION RECORDS WITH NEW LOGIC ===');
    const brdProposals = await NewProposalWorkflow.find({ status: 'FORWARDED_TO_BRD_ANALYST' })
      .populate('region', 'Region RegionName')
      .lean();
    
    console.log(`Found ${brdProposals.length} proposals to consolidate`);
    
    for (const proposal of brdProposals) {
      console.log(`\nProcessing proposal: ${proposal.proposalTitle} (ID: ${proposal._id})`);
      try {
        await consolidationService.createConsolidationRecord(proposal);
        console.log('✓ Record created successfully');
      } catch (err) {
        console.log('✗ Error:', err.message);
      }
    }
    
    console.log('\n=== VERIFYING RESULTS ===');
    const finalRecords = await BRDConsolidation.find().lean();
    console.log(`Total BRD Consolidation Records: ${finalRecords.length}`);
    
    finalRecords.forEach(record => {
      console.log(`\n  Proposal: ${record.proposalTitle}`);
      console.log(`  Region: ${record.region}`);
      console.log(`  Division: ${record.division}`);
      console.log(`  BudgetType: ${record.modelType}`);
      console.log(`  Amount: ₱${record.proposalAmount.toLocaleString()}`);
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
