require('dotenv').config();
const mongoose = require('mongoose');
const BudgetOfficerEdit = require('./models/budgetOfficerEdit');
const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function checkEditStatus() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get all edits
    const edits = await BudgetOfficerEdit.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('proposalId', 'title status workflowLevel');
    
    console.log(`📝 BUDGET OFFICER EDITS (${edits.length} found):\n`);
    
    edits.forEach((edit, idx) => {
      console.log(`${idx + 1}. Edit ID: ${edit._id}`);
      console.log(`   Proposal: ${edit.proposalId?.title || 'Unknown'}`);
      console.log(`   Proposal Status: ${edit.proposalId?.status || 'N/A'}`);
      console.log(`   Proposal WorkflowLevel: ${edit.proposalId?.workflowLevel || 'N/A'}`);
      console.log(`   Edit Status: ${edit.status} ${edit.status === 'Submitted' ? '⚠️' : edit.status === 'Applied' ? '✅' : ''}`);
      console.log(`   Edited By: ${edit.editedBy}`);
      console.log(`   Created: ${edit.createdAt}`);
      console.log(`   Number of Changes: ${edit.edits?.length || 0}`);
      
      if (edit.edits && edit.edits.length > 0) {
        console.log(`   Changes:`);
        edit.edits.forEach((change, i) => {
          console.log(`     ${i + 1}. ${change.itemType} - ${change.itemId}`);
          console.log(`        Field: ${change.fieldName}`);
          console.log(`        Old: ${change.oldValue} → New: ${change.newValue}`);
        });
      }
      console.log();
    });

    // Check edit status enum
    console.log('\n📊 EDIT STATUS BREAKDOWN:');
    const statusCounts = await BudgetOfficerEdit.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    statusCounts.forEach(s => {
      console.log(`  ${s._id}: ${s.count}`);
    });
    
    console.log('\n💡 EXPECTED EDIT LIFECYCLE:');
    console.log('  1. "Pending" - Edit created but not yet submitted');
    console.log('  2. "Submitted" - Edit submitted, waiting to be applied');
    console.log('  3. "Applied" - Edit successfully applied to original documents');
    console.log('  4. "Rejected" - Edit rejected/cancelled');
    console.log();
    
    console.log('⚠️  ISSUE:');
    console.log('  If status is "Submitted" but proposal already moved forward,');
    console.log('  it means the edit was NOT applied when workflow progressed!');
    console.log('  The edit should be "Applied" after being processed.');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

checkEditStatus();
