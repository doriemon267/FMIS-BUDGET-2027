const mongoose = require('mongoose');
const MooeProposal = require('./SERVER/models/mooeProposals');
mongoose.connect('mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin').then(async () => {
  const records = await MooeProposal.find({}).sort({ _id: -1 }).limit(10).lean();
  console.log(JSON.stringify(records, null, 2));
  process.exit();
}).catch(console.error);
