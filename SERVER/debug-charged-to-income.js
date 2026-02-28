const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis-budget';

console.log('🔌 Connecting to MongoDB:', mongoUri.replace(/:[^:]*@/, ':***@'));

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    const PersonnelServices = require('./models/PersonnelServices');
    
    console.log('🔍 SEARCH 1: Records with chargedToIncomeEligible=true...\n');
    const chargedEligible = await PersonnelServices.find({ chargedToIncomeEligible: true })
      .select('employeeFullName chargedToIncomeAmount chargedToIncomeSubsidyAmount proposalId')
      .lean();
    console.log(`Found ${chargedEligible.length} records\n`);
    
    console.log('🔍 SEARCH 2: Records with chargedToIncomeAmount > 0...\n');
    const chargedAmount = await PersonnelServices.find({ chargedToIncomeAmount: { $gt: 0 } })
      .select('employeeFullName chargedToIncomeAmount chargedToIncomeSubsidyAmount chargedToIncomeEligible proposalId fiscalYear')
      .lean();
    
    console.log(`Found ${chargedAmount.length} records with chargedToIncomeAmount > 0:\n`);
    chargedAmount.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec.employeeFullName || 'N/A'}`);
      console.log(`   Charged-to-Income Amount: ₱${(rec.chargedToIncomeAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   Charged-to-Income Subsidy: ₱${(rec.chargedToIncomeSubsidyAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
      console.log(`   chargedToIncomeEligible flag: ${rec.chargedToIncomeEligible}`);
      console.log(`   ProposalId: ${rec.proposalId}`);
      console.log(`   FY: ${rec.fiscalYear}`);
      console.log('');
    });
    
    const total1 = await PersonnelServices.aggregate([
      { $match: { chargedToIncomeEligible: true } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$chargedToIncomeAmount' } } } }
    ]);
    
    const total2 = await PersonnelServices.aggregate([
      { $match: { chargedToIncomeAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$chargedToIncomeAmount' } }, subsidyTotal: { $sum: { $toDouble: '$chargedToIncomeSubsidyAmount' } } } }
    ]);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Records with chargedToIncomeEligible=true:`);
    console.log(`  Total Charged-to-Income Amount: ₱${(total1[0]?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`\nRecords with chargedToIncomeAmount > 0:`);
    console.log(`  Total Amount: ₱${(total2[0]?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Subsidy: ₱${(total2[0]?.subsidyTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
