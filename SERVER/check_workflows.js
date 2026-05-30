const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/FMIS_OSBPIS_DB";

async function check() {
  await mongoose.connect(uri);
  const Workflow = mongoose.model('NewProposalWorkflow', new mongoose.Schema({}, { strict: false }));
  
  const workflows = await Workflow.find({}).lean();
  console.log("Total workflows:", workflows.length);
  workflows.forEach(w => {
    console.log(`- ID: ${w._id}, Status: ${w.status}, Dept: ${w.department}, Div: ${w.division}, Reg: ${w.region}`);
  });
  process.exit(0);
}

check();
