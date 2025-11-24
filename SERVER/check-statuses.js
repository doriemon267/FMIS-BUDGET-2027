require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget-september';
    await mongoose.connect(mongoUri);
    require('./models/Region'); // Register Region model
    const NewProposalWorkflow = require('./models/NewProposalWorkflow');
    const statuses = await NewProposalWorkflow.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Statuses in NewProposalWorkflow:');
    console.log(JSON.stringify(statuses, null, 2));

    // Also check for FINALIZED and BRD statuses
    const brdProposals = await NewProposalWorkflow.find({
      status: { $in: ['FORWARDED_TO_BRD_ANALYST', 'FORWARDED_TO_BRD_OFFICER', 'FORWARDED_TO_BRD_MANAGER', 'RETURNED_TO_PLANNING_ANALYST', 'RETURNED_TO_OFFICER', 'FINALIZED'] }
    }).populate('region', 'Region regionName').lean();
    console.log('BRD level proposals:');
    console.log(JSON.stringify(brdProposals.map(p => ({ _id: p._id, status: p.status, region: p.region, fiscalYear: p.fiscalYear })), null, 2));

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();