/**
 * Convert some Initial records to NEP for testing
 */
const mongoose = require('mongoose');
const PersonnelService = require('./models/PersonnelServices');
const MooeProposal = require('./models/mooeProposals');
const CapitalOutlay = require('./models/CapitalOutlay');
const Income = require('./models/Income');

async function convertToNEP() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://172.16.4.98:27017/fmis_budget', {});
    console.log('✓ Connected\n');

    // Convert first half to NEP
    const collections = [
      { name: 'PersonnelService', model: PersonnelService },
      { name: 'MooeProposal', model: MooeProposal },
      { name: 'CapitalOutlay', model: CapitalOutlay },
      { name: 'Income', model: Income }
    ];

    for (const col of collections) {
      const total = await col.model.countDocuments();
      const halfWay = Math.ceil(total / 2);

      // Get all documents, convert first half to NEP
      const docs = await col.model.find({}).limit(halfWay);
      
      if (docs.length > 0) {
        const ids = docs.map(d => d._id);
        const result = await col.model.updateMany(
          { _id: { $in: ids } },
          { $set: { budgetType: 'NEP' } }
        );
        console.log(`${col.name}: Converted ${result.modifiedCount} records to NEP`);
      }
    }

    console.log('\n✅ Conversion complete!\n');

    // Show summary
    for (const col of collections) {
      const byType = await col.model.aggregate([
        { $group: { _id: '$budgetType', count: { $sum: 1 } } }
      ]);
      console.log(`${col.name} distribution:`);
      byType.forEach(item => {
        console.log(`  ${item._id}: ${item.count} records`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

convertToNEP();
