const mongoose = require('mongoose');

const uri = 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin';

async function run() {
  try {
    await mongoose.connect(uri);
    const MooeProposal = require('./SERVER/models/mooeProposals');
    
    const records = await MooeProposal.find({ uacsCode: "5-02-99-990-1" });
    
    console.log(`Found ${records.length} records for UACS 5-02-99-990-1`);
    let totalIncome = 0;
    for (const r of records) {
      console.log(`- _id: ${r._id}, region: ${r.region}, division: ${r.division}, income: ${r.income}, subsidy: ${r.subsidy}`);
      totalIncome += Number(r.income) || 0;
    }
    console.log(`Total Income in DB: ${totalIncome}`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
