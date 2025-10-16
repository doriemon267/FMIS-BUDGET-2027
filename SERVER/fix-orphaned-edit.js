require('dotenv').config();
const mongoose = require('mongoose');
const BudgetOfficerEdit = require('./models/BudgetOfficerEdit');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function fixOrphanedEdit() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    const editId = '68f05c36a70efb0f3e6a48d4';
    const edit = await BudgetOfficerEdit.findById(editId);
    
    if (!edit) {
      console.log('❌ Edit not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('📝 CURRENT EDIT STATE:');
    console.log('  ID:', edit._id);
    console.log('  Proposal ID:', edit.proposalId);
    console.log('  Status:', edit.status);
    console.log('  Number of Edits:', edit.edits?.length || 0);
    console.log('  Edited By:', edit.editedBy?.userName || 'Unknown');
    console.log();

    // Since this edit has 0 changes and is orphaned, mark it as Approved
    // (it was likely already processed or was empty)
    edit.status = 'Approved';
    edit.appliedAt = new Date();
    edit.appliedBy = {
      userId: 'system',
      userName: 'System Auto-Fix',
      role: 'SYSTEM'
    };
    
    await edit.save();
    
    console.log('✅ EDIT UPDATED:');
    console.log('  Status:', edit.status);
    console.log('  Applied At:', edit.appliedAt);
    console.log();
    
    console.log('💡 NOTE:');
    console.log('  This edit had 0 changes and was orphaned.');
    console.log('  Marked as Approved to clean up the database.');
    console.log('  Future edits will be auto-marked as Approved by');
    console.log('  applyEditsToOriginalDocuments() function.');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

fixOrphanedEdit();
