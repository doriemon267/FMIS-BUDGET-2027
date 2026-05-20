require('dotenv').config({ path: './SERVER/.env' });
const mongoose = require('mongoose');
const NewProposalWorkflow = require('./SERVER/models/NewProposalWorkflow');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin', { useNewUrlParser: true, useUnifiedTopology: true });
  
  const query = {
    fiscalYear: 2027,
    modelType: "Initial",
    department: "DIVISION 1"
  };
  
  const proposals = await NewProposalWorkflow.find(query).lean();
  console.log("Found proposals:", proposals.map(p => ({ id: p._id, region: p.region, department: p.department, division: p.division })));
  
  process.exit(0);
}

test().catch(console.error);
