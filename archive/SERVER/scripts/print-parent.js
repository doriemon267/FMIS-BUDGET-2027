const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) { console.error('Set MONGODB_BUDGET_URL'); process.exit(1); }
  await mongoose.connect(mongoUrl);
  const id = process.argv[2] || '68da2cd4370cac3d20862ef7';
  const p = await Proposal.findById(id).lean();
  console.log('Proposal:', JSON.stringify(p, null, 2));
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
