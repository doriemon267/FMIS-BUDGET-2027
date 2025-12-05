require('dotenv').config();
const mongoose = require('mongoose');
const Proposal = require('./models/Proposal');
const PersonnelServices = require('./models/PersonnelServices');
const MOOE = require('./models/mooeProposals');
const CapitalOutlay = require('./models/CapitalOutlay');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL);
    
    console.log('=== DEBUGGING EXPENSES SOURCE ===\n');
    
    // Get the proposal
    const proposal = await Proposal.findOne({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    });
    
    console.log('Proposal Totals:');
    console.log('  totalIncome: ₱' + (proposal.totalIncome || 0).toFixed(2));
    console.log('  totalExpenses: ₱' + (proposal.totalExpenses || 0).toFixed(2));
    console.log('  proposedBudget: ₱' + (proposal.proposedBudget || 0).toFixed(2));
    console.log('  projectedSubsidy: ₱' + (proposal.projectedSubsidy || 0).toFixed(2));
    
    // Check PersonnelServices
    console.log('\n--- PersonnelServices Records ---');
    const ps = await PersonnelServices.find({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    }).select('Total chargedToIncomeAmount chargedToIncomeEligible');
    
    let totalPS = 0;
    let totalCharged = 0;
    ps.forEach(p => {
      totalPS += p.Total || 0;
      totalCharged += p.chargedToIncomeAmount || 0;
    });
    
    console.log('  Total records: ' + ps.length);
    console.log('  Sum of Total: ₱' + totalPS.toFixed(2));
    console.log('  Sum of chargedToIncomeAmount: ₱' + totalCharged.toFixed(2));
    console.log('  Should be Expenses: ₱' + (totalPS - totalCharged).toFixed(2));
    
    // Check MOOE
    console.log('\n--- MOOE Records ---');
    const mooe = await MOOE.find({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    }).select('amount');
    
    let totalMOOE = 0;
    mooe.forEach(m => totalMOOE += m.amount || 0);
    
    console.log('  Total records: ' + mooe.length);
    console.log('  Sum: ₱' + totalMOOE.toFixed(2));
    
    // Check CapitalOutlay
    console.log('\n--- CapitalOutlay Records ---');
    const co = await CapitalOutlay.find({
      fiscalYear: '2026',
      budgetType: 'Initial',
      region: 'CENTRAL OFFICE'
    }).select('amount');
    
    let totalCO = 0;
    co.forEach(c => totalCO += c.amount || 0);
    
    console.log('  Total records: ' + co.length);
    console.log('  Sum: ₱' + totalCO.toFixed(2));
    
    // Calculate expected expenses
    const expectedExpenses = (totalPS - totalCharged) + totalMOOE + totalCO;
    console.log('\n--- CALCULATION ---');
    console.log('Expected totalExpenses:');
    console.log('  (₱' + totalPS.toFixed(2) + ' - ₱' + totalCharged.toFixed(2) + ') + ₱' + totalMOOE.toFixed(2) + ' + ₱' + totalCO.toFixed(2));
    console.log('  = ₱' + expectedExpenses.toFixed(2));
    console.log('\nDatabase shows:');
    console.log('  totalExpenses: ₱' + (proposal.totalExpenses || 0).toFixed(2));
    
    if (Math.abs(expectedExpenses - (proposal.totalExpenses || 0)) > 0.01) {
      console.log('\n❌ MISMATCH! Expenses don\'t match expected calculation!');
    } else {
      console.log('\n✅ Expenses match expected calculation');
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
