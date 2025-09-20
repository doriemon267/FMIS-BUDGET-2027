const mongoose = require('mongoose');
const PersonnelService = require('./models/personnelServices');

async function checkProposalStatuses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/fmis-budget-september', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 Checking proposal statuses...\n');

    // Get status counts
    const statuses = await PersonnelService.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('📊 Status counts:');
    statuses.forEach(s => {
      console.log(`   ${s._id || 'null'}: ${s.count}`);
    });

    // Check Division level proposals
    const divisionProposals = await PersonnelService.find({
      originalLevel: 'DIVISION'
    }).limit(5).select('_id status workflowLevel division department region');

    console.log('\n🏢 Division level proposals (sample):');
    divisionProposals.forEach(p => {
      console.log(`   ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Workflow Level: ${p.workflowLevel}`);
      console.log(`   Division: ${p.division}`);
      console.log(`   Department: ${p.department}`);
      console.log(`   Region: ${p.region}`);
      console.log('   ---');
    });

    // Check if any have 'Division Submitted' status
    const submittedCount = await PersonnelService.countDocuments({
      originalLevel: 'DIVISION',
      status: 'Division Submitted'
    });

    console.log(`\n✅ Division proposals with 'Division Submitted' status: ${submittedCount}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProposalStatuses();