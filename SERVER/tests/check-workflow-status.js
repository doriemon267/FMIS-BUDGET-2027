const mongoose = require('mongoose');
const PersonnelService = require('./models/PersonnelServices');

async function checkDivisionWorkflow() {
  try {
    // Use the same connection as the main app
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URL);

    console.log('🔍 Checking Division → Department workflow...\n');

    // Check Division level proposals
    const divisionProposals = await PersonnelService.find({
      originalLevel: 'DIVISION'
    }).select('_id status workflowLevel division department region').limit(10);

    console.log('📋 Division level proposals:');
    divisionProposals.forEach((p, i) => {
      console.log(`${i + 1}. ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Workflow Level: ${p.workflowLevel}`);
      console.log(`   Division: ${p.division}`);
      console.log(`   Department: ${p.department}`);
      console.log(`   Region: ${p.region}`);
      console.log('   ---');
    });

    // Check how many have 'Division Submitted' status
    const submittedCount = await PersonnelService.countDocuments({
      originalLevel: 'DIVISION',
      status: 'Division Submitted'
    });

    console.log(`\n✅ Division proposals with 'Division Submitted' status: ${submittedCount}`);

    // Check Department level visibility
    const deptVisibleCount = await PersonnelService.countDocuments({
      originalLevel: 'DIVISION',
      status: { $in: ['Division Submitted', 'Department Verified', 'Department Submitted', 'Region Approved', 'Finalized'] }
    });

    console.log(`👁️  Division proposals visible to Department level: ${deptVisibleCount}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDivisionWorkflow();