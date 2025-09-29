const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget';

async function run() {
  await mongoose.connect(MONGODB_BUDGET_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  const statuses = ['Office Approved','Finalized','Office Submitted','Region Approved','Division Submitted'];
  const counts = {};
  for (const s of statuses) {
    counts[s] = await Proposal.countDocuments({ status: s });
  }
  console.log('Counts:', counts);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
