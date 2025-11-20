require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');
const BRDConsolidation = require('./models/BRDConsolidation');
const consolidationService = require('./utils/consolidationService');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== FINDING PROPOSALS AT BRD ANALYST STAGE ===');
    const brdProposals = await NewProposalWorkflow.find({ status: 'FORWARDED_TO_BRD_ANALYST' }).lean();
    
    console.log(`Found ${brdProposals.length} proposals at BRD Analyst stage`);
    
    for (const proposal of brdProposals) {
      console.log(`\n--- Proposal ${proposal._id} ---`);
      console.log('Title:', proposal.proposalTitle);
      console.log('Region:', proposal.region);
      console.log('Department:', proposal.department);
      console.log('Amount:', proposal.proposalAmount);
      
      // Check if consolidation record already exists
      const existingRecord = await BRDConsolidation.findOne({ proposalId: proposal._id });
      if (existingRecord) {
        console.log('✓ BRD Consolidation record already exists');
      } else {
        console.log('Creating BRD Consolidation record...');
        try {
          await consolidationService.createConsolidationRecord(proposal);
          console.log('✓ BRD Consolidation record created');
        } catch (err) {
          console.log('✗ Error creating record:', err.message);
        }
      }
    }
    
    console.log('\n=== FINAL BRD CONSOLIDATION COUNT ===');
    const finalCount = await BRDConsolidation.countDocuments();
    console.log('Total BRD Consolidation Records:', finalCount);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
