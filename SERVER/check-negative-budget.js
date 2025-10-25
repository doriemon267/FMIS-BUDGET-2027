const mongoose = require('mongoose');
require('dotenv').config();
const Proposal = require('./models/Proposal');
const Income = require('./models/Income');

async function checkNegative() {
  try {
    const dbUrl = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget';
    console.log('🔧 Connecting to:', dbUrl);
    await mongoose.connect(dbUrl);
    
    const statuses = await Proposal.distinct('status');
    console.log('📊 Proposal statuses:', statuses);
    
    const count = await Proposal.countDocuments();
    console.log('📊 Total proposals:', count);
    
    // Get proposals with NEGATIVE proposed budget
    const negatives = await Proposal.find({ proposedBudget: { $lt: 0 } }).limit(5);
    console.log(`\n❌ Proposals with NEGATIVE proposedBudget: ${negatives.length}\n`);
    
    for (const p of negatives) {
      console.log(`\n📌 Proposal: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   proposedBudget: ₱${p.proposedBudget?.toLocaleString()}`);
      console.log(`   totalIncome: ₱${p.totalIncome?.toLocaleString()}`);
      console.log(`   totalExpenses: ₱${p.totalExpenses?.toLocaleString()}`);
      console.log(`   projectedCorporateIncome: ₱${p.projectedCorporateIncome?.toLocaleString()}`);
      console.log(`   projectedSubsidy: ₱${p.projectedSubsidy?.toLocaleString()}`);
      
      // Check income records for this proposal
      const incomeRecords = await Income.find({
        fiscalYear: p.fiscalYear,
        budgetType: p.budgetType,
        processBy: p.processBy,
        region: p.region,
        ...(p.division && { division: p.division }),
        ...(p.department && { department: p.department })
      });
      
      console.log(`   📊 Income records: ${incomeRecords.length}`);
      const negativeIncomes = incomeRecords.filter(i => Number(i.amount) < 0);
      if (negativeIncomes.length > 0) {
        console.log(`   ⚠️  NEGATIVE income amounts found: ${negativeIncomes.length}`);
        for (const inc of negativeIncomes.slice(0, 3)) {
          console.log(`      - ${inc.particulars}: ₱${Number(inc.amount).toLocaleString()}`);
        }
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkNegative();