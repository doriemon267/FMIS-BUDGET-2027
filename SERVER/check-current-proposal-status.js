const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');

async function checkProposalStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find recent proposals
    const proposals = await Proposal.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status workflowLevel createdBy updatedAt region department division')
      .lean();

    console.log('\n📊 Recent Proposals:');
    console.log('='.repeat(100));
    
    proposals.forEach((p, index) => {
      console.log(`\n${index + 1}. ${p.title || 'Untitled'}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Workflow Level: ${p.workflowLevel || 'N/A'}`);
      console.log(`   Region: ${p.region || 'N/A'}`);
      console.log(`   Department: ${p.department || 'N/A'}`);
      console.log(`   Division: ${p.division || 'N/A'}`);
      console.log(`   Updated: ${p.updatedAt}`);
    });

    // Check for "Office Submitted" status (legacy)
    const officeSubmitted = await Proposal.countDocuments({ status: 'Office Submitted' });
    const forwardedToOfficer = await Proposal.countDocuments({ status: 'Forwarded to Officer' });
    const divisionSubmitted = await Proposal.countDocuments({ status: 'Division Submitted' });

    console.log('\n\n📈 Status Counts:');
    console.log('='.repeat(50));
    console.log(`Office Submitted (LEGACY): ${officeSubmitted}`);
    console.log(`Forwarded to Officer (NEW): ${forwardedToOfficer}`);
    console.log(`Division Submitted: ${divisionSubmitted}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProposalStatus();
