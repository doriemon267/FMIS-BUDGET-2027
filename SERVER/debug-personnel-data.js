const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget';

console.log('🔌 Connecting to MongoDB:', mongoUri.replace(/:[^:]*@/, ':***@'));

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    const PersonnelServices = require('./models/PersonnelServices');
    
    // 1. Check if ANY records have chargedToIncomeAmount non-zero
    console.log('📊 ANALYSIS: Charged-to-Income Data\n');
    
    const stats = await PersonnelServices.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          chargedEligibleTrue: {
            $sum: { $cond: ['$chargedToIncomeEligible', 1, 0] }
          },
          chargedAmountTotal: {
            $sum: { $toDouble: '$chargedToIncomeAmount' }
          },
          chargedSubsidyTotal: {
            $sum: { $toDouble: '$chargedToIncomeSubsidyAmount' }
          },
          withChargedAmount: {
            $sum: { $cond: [{ $gt: ['$chargedToIncomeAmount', 0] }, 1, 0] }
          }
        }
      }
    ]);
    
    console.log('Database Stats:');
    console.log(JSON.stringify(stats[0], null, 2));
    
    // 2. Sample 5 records to see structure
    console.log('\n📋 Sample PersonnelServices Records:\n');
    const samples = await PersonnelServices.find()
      .select('employeeFullName chargedToIncomeEligible chargedToIncomeAmount chargedToIncomeSubsidyAmount Total proposalId fiscalYear')
      .limit(5)
      .lean();
    
    samples.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec.employeeFullName}`);
      console.log(`   chargedToIncomeEligible: ${rec.chargedToIncomeEligible}`);
      console.log(`   chargedToIncomeAmount: ${rec.chargedToIncomeAmount}`);
      console.log(`   chargedToIncomeSubsidyAmount: ${rec.chargedToIncomeSubsidyAmount}`);
      console.log(`   Total: ${rec.Total}`);
      console.log(`   proposalId: ${rec.proposalId}`);
      console.log('');
    });
    
    // 3. Check proposal-specific data
    console.log('📍 Records by Proposal:\n');
    const byProposal = await PersonnelServices.aggregate([
      {
        $group: {
          _id: '$proposalId',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$Total' } },
          chargedAmount: { $sum: { $toDouble: '$chargedToIncomeAmount' } }
        }
      },
      { $limit: 5 }
    ]);
    
    byProposal.forEach((p, idx) => {
      console.log(`${idx + 1}. ProposalId: ${p._id}`);
      console.log(`   Records: ${p.count}, Total: ₱${p.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Charged: ₱${p.chargedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log('');
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
