/**
 * Diagnostic script to check if proposals have budgetType field
 * This helps determine if the filtering issue is:
 * 1. Missing budgetType values in database records
 * 2. Filtering logic not working
 */
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import models
const PersonnelService = require('./models/PersonnelServices');
const MooeProposal = require('./models/mooeProposals');
const CapitalOutlay = require('./models/CapitalOutlay');
const Income = require('./models/Income');
const BudgetarySupport = require('./models/BudgetarySupport');

async function diagnoseData() {
  try {
    console.log('Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    
    console.log('✓ Connected to MongoDB\n');
    
    // Check each collection
    const collections = [
      { name: 'PersonnelService', model: PersonnelService },
      { name: 'MooeProposal', model: MooeProposal },
      { name: 'CapitalOutlay', model: CapitalOutlay },
      { name: 'Income', model: Income },
      { name: 'BudgetarySupport', model: BudgetarySupport }
    ];
    
    for (const col of collections) {
      console.log(`\n📊 ${col.name}`);
      console.log('='.repeat(50));
      
      const total = await col.model.countDocuments();
      const withBudgetType = await col.model.countDocuments({ budgetType: { $exists: true, $ne: null } });
      const withoutBudgetType = total - withBudgetType;
      
      console.log(`Total records: ${total}`);
      console.log(`With budgetType: ${withBudgetType}`);
      console.log(`Without budgetType: ${withoutBudgetType}`);
      
      // Show sample records
      const samples = await col.model.find({}).limit(3).select('_id processBy budgetType fiscalYear status').lean();
      console.log('\nSample records:');
      samples.forEach((record, idx) => {
        console.log(`  ${idx + 1}. processBy=${record.processBy}, budgetType=${record.budgetType}, fiscalYear=${record.fiscalYear}, status=${record.status}`);
      });
      
      // Check how many "Initial" vs "NEP" budget types
      const byType = await col.model.aggregate([
        { $group: { _id: '$budgetType', count: { $sum: 1 } } }
      ]);
      
      console.log('\nBy Budget Type:');
      if (byType.length === 0) {
        console.log('  No budgetType grouping available');
      } else {
        byType.forEach(item => {
          console.log(`  ${item._id || '(null)'}: ${item.count}`);
        });
      }
    }
    
    console.log('\n✓ Diagnostic complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

diagnoseData();
