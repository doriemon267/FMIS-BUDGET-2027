require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
const PersonnelServices = require('./models/PersonnelServices');
const Income = require('./models/Income');
const MOOE = require('./models/mooeProposals');
const CapitalOutlay = require('./models/CapitalOutlay');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    // Find a proposal na may data
    const p = await Proposal.findOne().lean();
    if (!p) {
      console.log('No proposals found');
      process.exit(0);
    }
    
    console.log('Checking proposal:', p._id);
    console.log('Fiscal Year:', p.fiscalYear, '| Budget Type:', p.budgetType, '| Region:', p.region);
    console.log('');
    
    // Check totals from each module
    const incomeSum = await Income.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } } } }
    ]);
    
    const psSum = await PersonnelServices.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region, chargedToIncomeEligible: { $ne: true } } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$total', 0] } } } } }
    ]);
    
    const psSubsidySum = await PersonnelServices.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region, chargedToIncomeEligible: { $ne: true } } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$subsidyAmount', 0] } } } } }
    ]);
    
    const mooeSum = await MOOE.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$amount', 0] } } } } }
    ]);
    
    const mooeSubsidySum = await MOOE.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$subsidy', 0] } } } } }
    ]);
    
    const coSum = await CapitalOutlay.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$cost', 0] } } } } }
    ]);
    
    const coSubsidySum = await CapitalOutlay.aggregate([
      { $match: { fiscalYear: p.fiscalYear, budgetType: p.budgetType, region: p.region } },
      { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ['$subsidy', 0] } } } } }
    ]);
    
    console.log('=== DATA SUMMARY ===');
    console.log('Income Total:', incomeSum[0]?.total || 0);
    console.log('Personnel Services Total:', psSum[0]?.total || 0);
    console.log('Personnel Services Subsidy:', psSubsidySum[0]?.total || 0);
    console.log('MOOE Total:', mooeSum[0]?.total || 0);
    console.log('MOOE Subsidy:', mooeSubsidySum[0]?.total || 0);
    console.log('Capital Outlay Total:', coSum[0]?.total || 0);
    console.log('Capital Outlay Subsidy:', coSubsidySum[0]?.total || 0);
    console.log('');
    console.log('=== PROPOSAL CURRENT VALUES ===');
    console.log('projectedIncome:', p.projectedIncome);
    console.log('projectedMooe:', p.projectedMooe);
    console.log('projectedCapitalOutlay:', p.projectedCapitalOutlay);
    console.log('projectedSubsidy:', p.projectedSubsidy);
    console.log('projectedBudget:', p.projectedBudget);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
