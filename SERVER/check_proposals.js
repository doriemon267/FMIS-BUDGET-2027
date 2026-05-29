const mongoose = require('mongoose');
require('dotenv').config({ path: 'D:/_2026_FMIS-BUDGET/GOKO/SYSTEM_LOST_V4/FMIS-BUDGET/SERVER/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const NewProposalWorkflow = require('D:/_2026_FMIS-BUDGET/GOKO/SYSTEM_LOST_V4/FMIS-BUDGET/SERVER/models/NewProposalWorkflow.js');
  const proposals = await NewProposalWorkflow.find({ status: { $in: ['Forwarded to Approver', 'FORWARDED_TO_APPROVER'] } }).lean();
  console.log('Found', proposals.length, 'proposals in FORWARDED_TO_APPROVER');
  proposals.forEach(p => {
    console.log({
      _id: p._id,
      title: p.title,
      division: p.division,
      department: p.department,
      region: p.region,
      status: p.status,
      createdBy: p.createdBy
    });
  });
  
  const Region = require('D:/_2026_FMIS-BUDGET/GOKO/SYSTEM_LOST_V4/FMIS-BUDGET/SERVER/models/Region.js');
  const regions = await Region.find({}).lean();
  console.log('\nRegions:');
  regions.forEach(r => console.log(r._id, r.Region || r.regionName));
  
  process.exit();
}
check();
