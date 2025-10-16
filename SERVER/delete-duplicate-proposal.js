require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function deleteDuplicateDraft() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    // The duplicate Draft proposal ID
    const duplicateId = '68f05c11a70efb0f3e6a4673';
    
    const duplicate = await Proposal.findById(duplicateId);
    
    if (!duplicate) {
      console.log('❌ Duplicate proposal not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 DUPLICATE PROPOSAL TO DELETE:');
    console.log('  ID:', duplicate._id);
    console.log('  Title:', duplicate.title);
    console.log('  Status:', duplicate.status);
    console.log('  WorkflowLevel:', duplicate.workflowLevel);
    console.log('  Created:', duplicate.createdAt);
    console.log();

    // Delete the duplicate
    await Proposal.findByIdAndDelete(duplicateId);
    
    console.log('✅ DUPLICATE DELETED!\n');
    
    // Verify only 1 proposal remains
    const remaining = await Proposal.find({
      title: 'MANAGEMENT INFORMATION DIVISION - 2026 Initial Budget',
      division: 'MANAGEMENT INFORMATION DIVISION',
      fiscalYear: '2026',
      budgetType: 'Initial'
    });
    
    console.log(`📊 REMAINING PROPOSALS: ${remaining.length}`);
    remaining.forEach((p, idx) => {
      console.log(`\n${idx + 1}. ${p.title}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   WorkflowLevel: ${p.workflowLevel}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

deleteDuplicateDraft();
