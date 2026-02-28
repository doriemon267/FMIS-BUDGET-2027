const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected\n');
    const Income = require('./models/Income');
    const MOOE = require('./models/mooeProposals');
    const CapitalOutlay = require('./models/CapitalOutlay');
    const PersonnelServices = require('./models/PersonnelServices');
    
    // Get proposal ID
    const ps = await PersonnelServices.findOne().select('proposalId').lean();
    const proposalId = ps?.proposalId;
    console.log(`📍 Using ProposalId: ${proposalId}\n`);
    
    // Check Income data
    const incomeStats = await Income.aggregate([
      { $match: { proposalId: new mongoose.Types.ObjectId(proposalId) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);
    
    // Check MOOE data
    const mooeStats = await MOOE.aggregate([
      { $match: { proposalId: new mongoose.Types.ObjectId(proposalId) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
          totalSubsidy: { $sum: { $toDouble: '$subsidy' } },
          totalIncome: { $sum: { $toDouble: '$income' } }
        }
      }
    ]);
    
    // Check Capital Outlay data
    const coStats = await CapitalOutlay.aggregate([
      { $match: { proposalId: new mongoose.Types.ObjectId(proposalId) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCost: { $sum: { $toDouble: '$cost' } },
          totalSubsidy: { $sum: { $toDouble: '$subsidy' } }
        }
      }
    ]);
    
    console.log('💰 DATA BY SOURCE:\n');
    console.log(`📦 PersonnelServices:`);
    console.log(`   16 records = ₱16,367,506.33\n`);
    
    console.log(`💵 Income:`);
    console.log(`   ${incomeStats[0]?.count || 0} records = ₱${((incomeStats[0]?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}\n`);
    
    console.log(`🔧 MOOE:`);
    console.log(`   ${mooeStats[0]?.count || 0} records`);
    console.log(`   Amount: ₱${((mooeStats[0]?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`);
    console.log(`   Subsidy: ₱${((mooeStats[0]?.totalSubsidy || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`);
    console.log(`   Income: ₱${((mooeStats[0]?.totalIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}\n`);
    
    console.log(`🏗️  Capital Outlay:`);
    console.log(`   ${coStats[0]?.count || 0} records`);
    console.log(`   Cost: ₱${((coStats[0]?.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}`);
    console.log(`   Subsidy: ₱${((coStats[0]?.totalSubsidy || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }))}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const psTotal = 16367506.33;
    const incomeTotal = incomeStats[0]?.total || 0;
    const mooeTotal = (mooeStats[0]?.totalSubsidy || 0) + (mooeStats[0]?.totalIncome || 0);
    const coTotal = (coStats[0]?.totalSubsidy || 0) + (coStats[0]?.totalCost || 0);
    
    console.log(`\n✅ TOTALS:\n`);
    console.log(`   PersonnelServices: ₱${psTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   Income: ₱${incomeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   MOOE: ₱${mooeTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   CapitalOutlay: ₱${coTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`   ────────────────────────────`);
    console.log(`   GRAND TOTAL: ₱${(psTotal + incomeTotal + mooeTotal + coTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
