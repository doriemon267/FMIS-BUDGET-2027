const mongoose = require('mongoose');
require('dotenv').config({path: './SERVER/.env'});

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');
  const proposals = await NewProposalWorkflow.find({ status: 'MERGED' }).lean();
  console.log('MERGED PROPOSALS:', proposals.length);
  proposals.forEach(p => {
    console.log(`Child: ${p.title} (${p._id}), mergedInto: ${p.mergedInto}`);
  });

  const parents = await NewProposalWorkflow.find({ isConsolidated: true }).lean();
  console.log('PARENTS:', parents.length);
  parents.forEach(p => {
    console.log(`Parent: ${p.title} (${p._id}), mergedFrom: ${p.mergedFrom}`);
  });
  process.exit(0);
}

check().catch(console.error);
