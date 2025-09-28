const mongoose = require('mongoose');
require('dotenv').config();

async function checkProposalFields() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const PersonnelService = require('./models/personnelServices');

    console.log('🔍 Checking actual proposal data fields...');

    // Get a sample proposal to see what fields are available
    const sampleProposal = await PersonnelService.findOne({
      originalLevel: 'DIVISION',
      status: 'Division Submitted'
    }).select('originalLevel workflowLevel division department region office responsibilityCenter consolidationMetadata').limit(1);

    console.log('Sample Division proposal:');
    console.log(JSON.stringify(sampleProposal, null, 2));

    // Check what workflowLevel values exist
    const workflowLevels = await PersonnelService.distinct('workflowLevel');
    console.log('\nDistinct workflowLevel values:');
    workflowLevels.forEach(level => console.log(`  - ${level}`));

    // Check originalLevel values
    const originalLevels = await PersonnelService.distinct('originalLevel');
    console.log('\nDistinct originalLevel values:');
    originalLevels.forEach(level => console.log(`  - ${level}`));

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProposalFields();