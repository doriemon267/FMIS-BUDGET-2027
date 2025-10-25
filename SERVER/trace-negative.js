/**
 * Trace where the negative value is coming from
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');
const Income = require('./models/Income');
const PersonnelService = require('./models/PersonnelServices');
const MooeProposal = require('./models/mooeProposals');
const CapitalOutlay = require('./models/CapitalOutlay');

async function traceNegative() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');

    // Get ONE proposal with Draft status
    const proposal = await Proposal.findOne({ status: 'Draft' });
    
    if (!proposal) {
      console.log('❌ No Draft proposals found');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n📊 Analyzing Proposal: ${proposal._id}`);
    console.log(`Title: ${proposal.title}`);
    console.log(`Status: ${proposal.status}`);
    console.log(`Region: ${proposal.region}`);
    console.log(`Division: ${proposal.division || 'N/A'}`);
    console.log(`Department: ${proposal.department || 'N/A'}`);

    // Build query matching this proposal
    const query = {
      status: 'Draft',
      fiscalYear: proposal.fiscalYear,
      budgetType: proposal.budgetType,
      processBy: proposal.processBy,
      region: proposal.region
    };

    if (proposal.division) query.division = proposal.division;
    if (proposal.department) query.department = proposal.department;

    console.log(`\n🔍 Query: `, query);

    // Fetch all items
    const [draftPersonnel, draftMooe, draftCapital, draftIncome] = await Promise.all([
      PersonnelService.find(query),
      MooeProposal.find(query),
      CapitalOutlay.find(query),
      Income.find(query)
    ]);

    console.log(`\n📋 Found:`);
    console.log(`   Personnel records: ${draftPersonnel.length}`);
    console.log(`   MOOE records: ${draftMooe.length}`);
    console.log(`   Capital Outlay records: ${draftCapital.length}`);
    console.log(`   Income records: ${draftIncome.length}`);

    // Calculate each component
    console.log(`\n💰 BREAKING DOWN THE CALCULATION:\n`);

    // Personnel
    let totalPersonnelExpenses = 0;
    if (draftPersonnel.length > 0) {
      console.log('📌 PERSONNEL SERVICES:');
      for (let i = 0; i < Math.min(3, draftPersonnel.length); i++) {
        const item = draftPersonnel[i];
        const itemTotal = [
          'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
          'medical', 'childrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS',
          'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus', 'gsisPremium',
          'philhealthPremium', 'pagibigPremium', 'employeeCompensation', 'loyaltyAward',
          'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'
        ].reduce((itemSum, field) => itemSum + (Number(item[field]) || 0), 0);
        
        totalPersonnelExpenses += itemTotal;
        console.log(`   Item ${i+1}: ₱${itemTotal.toLocaleString()}`);
      }
      if (draftPersonnel.length > 3) console.log(`   ... and ${draftPersonnel.length - 3} more`);
      console.log(`   TOTAL: ₱${totalPersonnelExpenses.toLocaleString()}\n`);
    }

    // MOOE
    let totalMooeExpenses = 0;
    if (draftMooe.length > 0) {
      console.log('📌 MOOE:');
      for (let i = 0; i < Math.min(3, draftMooe.length); i++) {
        const item = draftMooe[i];
        const amount = Number(item.amount) || 0;
        totalMooeExpenses += amount;
        console.log(`   Item ${i+1}: ₱${amount.toLocaleString()}`);
      }
      if (draftMooe.length > 3) console.log(`   ... and ${draftMooe.length - 3} more`);
      console.log(`   TOTAL: ₱${totalMooeExpenses.toLocaleString()}\n`);
    }

    // Capital
    let totalCapitalExpenses = 0;
    if (draftCapital.length > 0) {
      console.log('📌 CAPITAL OUTLAY:');
      for (let i = 0; i < Math.min(3, draftCapital.length); i++) {
        const item = draftCapital[i];
        const amount = Number(item.amount) || 0;
        totalCapitalExpenses += amount;
        console.log(`   Item ${i+1}: ₱${amount.toLocaleString()}`);
      }
      if (draftCapital.length > 3) console.log(`   ... and ${draftCapital.length - 3} more`);
      console.log(`   TOTAL: ₱${totalCapitalExpenses.toLocaleString()}\n`);
    }

    // Income
    let totalIncome = 0;
    if (draftIncome.length > 0) {
      console.log('📌 INCOME:');
      for (let i = 0; i < Math.min(5, draftIncome.length); i++) {
        const item = draftIncome[i];
        const amount = Number(item.amount) || 0;
        totalIncome += amount;
        console.log(`   Item ${i+1}: ₱${amount.toLocaleString()} (${item.particulars || 'N/A'})`);
      }
      if (draftIncome.length > 5) console.log(`   ... and ${draftIncome.length - 5} more`);
      console.log(`   TOTAL: ₱${totalIncome.toLocaleString()}\n`);
    }

    // Final calculation
    const totalExpenses = totalPersonnelExpenses + totalMooeExpenses + totalCapitalExpenses;
    const proposedBudget = totalIncome + totalExpenses;

    console.log(`\n📊 FINAL CALCULATION:\n`);
    console.log(`Total Personnel Expenses: ₱${totalPersonnelExpenses.toLocaleString()}`);
    console.log(`Total MOOE Expenses:      ₱${totalMooeExpenses.toLocaleString()}`);
    console.log(`Total Capital Expenses:   ₱${totalCapitalExpenses.toLocaleString()}`);
    console.log(`                          ─────────────────────`);
    console.log(`TOTAL EXPENSES:           ₱${totalExpenses.toLocaleString()}`);
    console.log(`\nTOTAL INCOME:             ₱${totalIncome.toLocaleString()}`);
    console.log(`\n✨ PROPOSED BUDGET = Income + Expenses`);
    console.log(`✨ PROPOSED BUDGET = ₱${totalIncome.toLocaleString()} + ₱${totalExpenses.toLocaleString()}`);
    console.log(`✨ PROPOSED BUDGET = ₱${proposedBudget.toLocaleString()}`);

    console.log(`\n📌 DATABASE VALUES:`);
    console.log(`   proposedBudget in DB: ₱${(proposal.proposedBudget || 0).toLocaleString()}`);
    console.log(`   totalExpenses in DB:  ₱${(proposal.totalExpenses || 0).toLocaleString()}`);
    console.log(`   totalIncome in DB:    ₱${(proposal.totalIncome || 0).toLocaleString()}`);
    console.log(`   projectedSubsidy in DB: ₱${(proposal.projectedSubsidy || 0).toLocaleString()}`);
    console.log(`   projectedCorporateIncome in DB: ₱${(proposal.projectedCorporateIncome || 0).toLocaleString()}`);

    if (totalIncome < 0) {
      console.log(`\n⚠️  PROBLEM FOUND: Income is NEGATIVE!`);
      console.log(`These income records have negative amounts:`);
      const negativeIncomes = draftIncome.filter(i => Number(i.amount) < 0);
      for (const income of negativeIncomes) {
        console.log(`   - ${income.particulars}: ₱${Number(income.amount).toLocaleString()}`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

traceNegative();