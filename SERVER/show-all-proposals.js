const mongoose = require('mongoose');
require('dotenv').config();
const Proposal = require('./models/Proposal');

async function showAll() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);
    const proposals = await Proposal.find({}).lean();
    
    console.log('📊 Total proposals:', proposals.length);
    
    let totalBudget = 0;
    proposals.forEach((p, i) => {
      console.log(`\n${i+1}. Proposal: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   proposedBudget: ₱${(p.proposedBudget || 0).toLocaleString()}`);
      console.log(`   totalIncome: ₱${(p.totalIncome || 0).toLocaleString()}`);
      console.log(`   totalExpenses: ₱${(p.totalExpenses || 0).toLocaleString()}`);
      totalBudget += (p.proposedBudget || 0);
    });
    
    console.log(`\n\n═════════════════════════════════`);
    console.log(`📊 COLUMN TOTAL: ₱${totalBudget.toLocaleString()}`);
    console.log(`═════════════════════════════════`);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

showAll();