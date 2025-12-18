require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

(async function() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const distinctStatuses = await NewProposalWorkflow.distinct('status');
    console.log('Distinct statuses in NewProposalWorkflow collection:\n', distinctStatuses);
    const counts = {};
    for (const status of distinctStatuses) {
      counts[status] = await NewProposalWorkflow.countDocuments({ status });
    }
    console.log('\nCounts:\n', counts);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error fetching distinct statuses:', err);
    process.exit(1);
  }
})();
