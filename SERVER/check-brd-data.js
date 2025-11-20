require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./models/NewProposalWorkflow');
const BRDConsolidation = require('./models/BRDConsolidation');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to:', mongoUri ? 'FMIS Budget Database' : 'No MongoDB URI found');
    
    await mongoose.connect(mongoUri);
    
    console.log('=== PROPOSAL WORKFLOW STATUS CHECK ===');
    const totalProposals = await NewProposalWorkflow.countDocuments();
    console.log('Total New Proposals:', totalProposals);
    
    const statuses = await NewProposalWorkflow.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('By Status:');
    statuses.forEach(s => console.log(`  ${s._id}: ${s.count}`));
    
    console.log('\n=== BRD CONSOLIDATION CHECK ===');
    const brdCount = await BRDConsolidation.countDocuments();
    console.log('BRD Consolidation Records:', brdCount);
    
    if (brdCount > 0) {
      const samples = await BRDConsolidation.find().limit(3).lean();
      console.log('\nSample BRD Consolidation Records:');
      console.log(JSON.stringify(samples, null, 2));
    } else {
      console.log('⚠️ No BRD Consolidation records yet.');
      console.log('Action needed: Create a proposal and route it to FORWARDED_TO_BRD_ANALYST status');
    }
    
    // Check if there are proposals in FORWARDED_TO_BRD_ANALYST status
    console.log('\n=== PROPOSALS AT BRD ANALYST STAGE ===');
    const brdProposals = await NewProposalWorkflow.countDocuments({ status: 'FORWARDED_TO_BRD_ANALYST' });
    console.log('Proposals at FORWARDED_TO_BRD_ANALYST:', brdProposals);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
