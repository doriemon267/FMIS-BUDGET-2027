require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING PROPOSAL DATA ===');
    const proposal = await NewProposalWorkflow.findOne({ status: 'FORWARDED_TO_BRD_ANALYST' }).lean();
    
    if (proposal) {
      console.log('\nProposal Fields:');
      console.log('  _id:', proposal._id);
      console.log('  title/proposalTitle:', proposal.title || proposal.proposalTitle);
      console.log('  amount/proposalAmount:', proposal.amount || proposal.proposalAmount);
      console.log('  region:', proposal.region);
      console.log('  region type:', typeof proposal.region);
      console.log('  division:', proposal.division);
      console.log('  department:', proposal.department);
      console.log('  isCentralOffice:', proposal.isCentralOffice);
      console.log('  fiscalYear:', proposal.fiscalYear);
      console.log('  budgetType:', proposal.budgetType);
      
      // Try to look up the region
      if (proposal.region) {
        console.log('\n=== LOOKING UP REGION ===');
        const Region = require('./models/Region');
        const regionDoc = await Region.findById(proposal.region).lean();
        if (regionDoc) {
          console.log('Region Found:', regionDoc);
        } else {
          console.log('Region not found with ID:', proposal.region);
        }
      }
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
