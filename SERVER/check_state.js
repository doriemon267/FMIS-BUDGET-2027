require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
const PersonnelServices = require('./models/PersonnelServices');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    // Check current state
    const p = await Proposal.findOne({ fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE' }).lean();
    console.log('Proposal current state:');
    console.log('  totalIncome:', p.totalIncome);
    console.log('  totalExpenses:', p.totalExpenses);
    console.log('  projectedSubsidy:', p.projectedSubsidy);
    console.log('  projectedIncome:', p.projectedIncome);
    console.log('');
    
    // Check PersonnelServices
    const allPs = await PersonnelServices.countDocuments({ fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE' });
    const chargedPs = await PersonnelServices.countDocuments({ fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE', chargedToIncomeEligible: true });
    
    console.log('PersonnelServices:');
    console.log('  Total count:', allPs);
    console.log('  Charged count:', chargedPs);
    
    if (chargedPs > 0) {
      const chargedSum = await PersonnelServices.aggregate([
        { $match: { fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE', chargedToIncomeEligible: true } },
        { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$chargedToIncomeAmount', 0] } } } } }
      ]);
      console.log('  Sum of chargedToIncomeAmount:', chargedSum[0]?.total || 0);
      
      // Show first few
      const samples = await PersonnelServices.find({ fiscalYear: '2026', budgetType: 'Initial', region: 'CENTRAL OFFICE', chargedToIncomeEligible: true })
        .select('Total chargedToIncomeAmount chargedToIncomeEligible')
        .limit(3)
        .lean();
      
      console.log('\n  First 3 charged records:');
      samples.forEach(s => {
        console.log('    Total: ' + s.Total + ', Charged: ' + s.chargedToIncomeAmount);
      });
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
