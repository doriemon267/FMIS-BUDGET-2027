const mongoose = require('mongoose');
const uri = 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin';
mongoose.connect(uri).then(async () => {
  const MooeProposal = require('./SERVER/models/MooeProposal');
  const records = await MooeProposal.find({ uacsCode: '5-02-99-990-3' });
  console.log('Total Contractual Services Records:', records.length);
  for(const r of records) {
    console.log(`_id: ${r._id}, Region: ${r.region}, Dept: ${r.department}, Div: ${r.division}, Income: ${r.income}, Subsidy: ${r.subsidy}, Amount: ${r.amount}`);
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
