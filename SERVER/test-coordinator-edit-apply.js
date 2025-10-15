/**
 * Test script to verify that Budget Coordinator edits are applied to original documents
 * 
 * Scenario:
 * 1. Budget Coordinator edits Income amount from 1500000 to 2500000
 * 2. Budget Coordinator submits
 * 3. Original Income document should now show 2500000
 * 4. Budget Officer should see 2500000 when editing
 */

// Load environment variables FIRST
require('dotenv').config();

const mongoose = require('mongoose');
const Income = require('./models/Income');
const BudgetOfficerEdit = require('./models/BudgetOfficerEdit');
const Proposal = require('./models/Proposal');

// MongoDB connection string - use the correct FMIS BUDGET database from .env
const MONGODB_URI = process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget';

console.log('Using MongoDB URI:', MONGODB_URI ? MONGODB_URI.replace(/\/\/.*@/, '//***@') : 'NOT FOUND');

async function testCoordinatorEditApply() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the specific Income document mentioned in the issue
    const incomeId = '68ef00b792bce0c84064d2dc';
    console.log(`\n📋 Looking for Income document: ${incomeId}`);
    
    const income = await Income.findById(incomeId);
    if (!income) {
      console.error('❌ Income document not found');
      return;
    }

    console.log('📄 Current Income document:');
    console.log({
      _id: income._id,
      particulars: income.particulars,
      amount: income.amount,
      status: income.status,
      workflowLevel: income.workflowLevel,
      fiscalYear: income.fiscalYear,
      budgetType: income.budgetType,
      region: income.region,
      division: income.division,
      department: income.department
    });

    // Find the related BudgetOfficerEdit
    console.log('\n📝 Looking for related BudgetOfficerEdit...');
    const edit = await BudgetOfficerEdit.findOne({
      'editedIncome._id': new mongoose.Types.ObjectId(incomeId)
    }).sort({ createdAt: -1 });

    if (!edit) {
      console.log('ℹ️ No BudgetOfficerEdit found for this income');
      return;
    }

    console.log('📄 BudgetOfficerEdit found:');
    console.log({
      _id: edit._id,
      status: edit.status,
      submittedAt: edit.submittedAt,
      editedBy: edit.editedBy,
      editedIncome: edit.editedIncome.filter(item => item._id.toString() === incomeId)
    });

    // Check what the edited amount should be
    const editedIncomeItem = edit.editedIncome.find(item => item._id.toString() === incomeId);
    if (editedIncomeItem) {
      console.log('\n🔍 Comparison:');
      console.log(`   Original amount in DB: ${income.amount}`);
      console.log(`   Edited amount (should be applied): ${editedIncomeItem.amount}`);
      console.log(`   Match: ${income.amount === editedIncomeItem.amount ? '✅ YES' : '❌ NO - FIX NEEDED!'}`);

      if (income.amount !== editedIncomeItem.amount) {
        console.log('\n⚠️ THE BUG IS CONFIRMED!');
        console.log('   The Budget Coordinator\'s edit was NOT applied to the original document.');
        console.log('   The fix we just implemented should resolve this.');
      } else {
        console.log('\n✅ LOOKS GOOD!');
        console.log('   The edit has been applied correctly.');
      }
    }

    // Find the proposal
    const proposal = await Proposal.findById(edit.proposalId);
    if (proposal) {
      console.log('\n📋 Proposal status:');
      console.log({
        _id: proposal._id,
        status: proposal.status,
        workflowLevel: proposal.workflowLevel
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
testCoordinatorEditApply().catch(console.error);
