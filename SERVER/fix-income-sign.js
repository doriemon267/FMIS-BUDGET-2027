/**
 * Fix script to convert negative income amounts to positive
 * Income should always be positive
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Income = require('./models/Income');
const Proposal = require('./models/Proposal');

async function fixIncomeSign() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');

    console.log('📋 Checking Income records...');
    const negativeIncomes = await Income.find({ amount: { $lt: 0 } });
    console.log(`Found ${negativeIncomes.length} negative income records\n`);

    let fixedCount = 0;

    if (negativeIncomes.length > 0) {
      console.log('Converting negative amounts to positive:\n');
      
      for (const income of negativeIncomes) {
        const oldAmount = income.amount;
        const newAmount = Math.abs(income.amount);
        
        console.log(`📝 Income ${income._id}:`);
        console.log(`   Old: ₱${oldAmount.toLocaleString()}`);
        console.log(`   New: ₱${newAmount.toLocaleString()}`);
        
        await Income.findByIdAndUpdate(income._id, {
          amount: newAmount
        });
        
        fixedCount++;
      }
      
      console.log(`\n✅ Fixed ${fixedCount} income records`);
    } else {
      console.log('✅ No negative income records found');
    }

    // Now recalculate all proposals
    console.log('\n🔄 Recalculating all proposals...');
    const proposals = await Proposal.find({});
    console.log(`Found ${proposals.length} proposals\n`);

    let proposalFixedCount = 0;

    for (const proposal of proposals) {
      try {
        // Fetch the Draft items for this proposal
        const PersonnelService = require('./models/PersonnelServices');
        const MooeProposal = require('./models/mooeProposals');
        const CapitalOutlay = require('./models/CapitalOutlay');

        const query = {
          status: 'Draft',
          fiscalYear: proposal.fiscalYear,
          budgetType: proposal.budgetType,
          processBy: proposal.processBy,
          region: proposal.region
        };

        if (proposal.division) query.division = proposal.division;
        if (proposal.department) query.department = proposal.department;

        const [draftPersonnel, draftMooe, draftCapital, draftIncome] = await Promise.all([
          PersonnelService.find(query),
          MooeProposal.find(query),
          CapitalOutlay.find(query),
          Income.find(query)
        ]);

        // Calculate totals
        let totalPersonnelExpenses = 0;
        let totalMooeExpenses = 0;
        let totalCapitalExpenses = 0;
        let totalIncome = 0;

        if (draftPersonnel.length > 0) {
          totalPersonnelExpenses = draftPersonnel.reduce((sum, item) => {
            const itemTotal = [
              'annualSalary', 'RATA', 'PERA', 'uniformALLOWANCE', 'productivityIncentive',
              'medical', 'childrenAllowance', 'meal', 'cashGift', 'subsistenceAllowanceMDS',
              'subsistenceAllowanceST', 'midyearBonus', 'yearEndBonus', 'gsisPremium',
              'philhealthPremium', 'pagibigPremium', 'employeeCompensation', 'loyaltyAward',
              'overtimePay', 'earnedLeaves', 'retirementBenefits', 'terminalLeave', 'courtAppearance'
            ].reduce((itemSum, field) => itemSum + (Number(item[field]) || 0), 0);
            return sum + itemTotal;
          }, 0);
        }

        if (draftMooe.length > 0) {
          totalMooeExpenses = draftMooe.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }

        if (draftCapital.length > 0) {
          totalCapitalExpenses = draftCapital.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }

        if (draftIncome.length > 0) {
          totalIncome = draftIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }

        const totalExpenses = totalPersonnelExpenses + totalMooeExpenses + totalCapitalExpenses;
        const newProposedBudget = totalIncome + totalExpenses; // Using the correct formula
        const newProjectedSubsidy = totalExpenses;
        const newProjectedCorporateIncome = totalIncome;

        if (proposal.proposedBudget !== newProposedBudget || 
            proposal.projectedSubsidy !== newProjectedSubsidy ||
            proposal.projectedCorporateIncome !== newProjectedCorporateIncome) {
          
          console.log(`📊 Updating proposal ${proposal._id}:`);
          console.log(`   Old proposedBudget: ₱${(proposal.proposedBudget || 0).toLocaleString()}`);
          console.log(`   New proposedBudget: ₱${newProposedBudget.toLocaleString()}`);
          console.log(`   Formula: ₱${newProjectedCorporateIncome.toLocaleString()} (income) + ₱${newProjectedSubsidy.toLocaleString()} (subsidy)`);

          await Proposal.findByIdAndUpdate(proposal._id, {
            totalExpenses,
            totalIncome,
            proposedBudget: newProposedBudget,
            projectedCorporateIncome: newProjectedCorporateIncome,
            projectedSubsidy: newProjectedSubsidy
          });

          proposalFixedCount++;
        }
      } catch (err) {
        console.error(`❌ Error updating proposal ${proposal._id}:`, err.message);
      }
    }

    console.log(`\n✅ Updated ${proposalFixedCount} proposals`);
    console.log(`\n🎉 All fixes complete!`);
    console.log(`- Income records fixed: ${fixedCount}`);
    console.log(`- Proposals recalculated: ${proposalFixedCount}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixIncomeSign();