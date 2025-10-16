require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');

const MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL;

async function checkDuplicates() {
  try {
    await mongoose.connect(MONGODB_BUDGET_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get all proposals sorted by creation date
    const proposals = await Proposal.find({})
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`📋 RECENT PROPOSALS (${proposals.length} found):\n`);
    
    proposals.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.title}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   WorkflowLevel: ${p.workflowLevel}`);
      console.log(`   Created: ${p.createdAt}`);
      console.log(`   Updated: ${p.updatedAt}`);
      console.log();
    });

    // Check for potential duplicates based on title, fiscalYear, division
    console.log('\n🔍 CHECKING FOR DUPLICATES...\n');
    
    const duplicateGroups = await Proposal.aggregate([
      {
        $group: {
          _id: {
            title: '$title',
            division: '$division',
            fiscalYear: '$fiscalYear',
            budgetType: '$budgetType'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          statuses: { $push: '$status' },
          created: { $push: '$createdAt' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    if (duplicateGroups.length > 0) {
      console.log(`⚠️  FOUND ${duplicateGroups.length} DUPLICATE GROUPS:\n`);
      
      duplicateGroups.forEach((group, idx) => {
        console.log(`${idx + 1}. ${group._id.title || 'Untitled'}`);
        console.log(`   Division: ${group._id.division}`);
        console.log(`   Fiscal Year: ${group._id.fiscalYear}`);
        console.log(`   Budget Type: ${group._id.budgetType}`);
        console.log(`   Count: ${group.count} duplicates`);
        console.log(`   IDs: ${group.ids.join(', ')}`);
        console.log(`   Statuses: ${group.statuses.join(', ')}`);
        console.log(`   Created Dates: ${group.created.map(d => d.toISOString()).join(', ')}`);
        console.log();
      });
    } else {
      console.log('✅ No duplicates found based on title/division/fiscalYear/budgetType');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
  }
}

checkDuplicates();
