/**
 * Debug script to see actual values in database
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Proposal = require('./models/Proposal');
const Income = require('./models/Income');

async function debugProposals() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fmis_budget');

    console.log('\n📋 Fetching proposals with values...');
    const proposals = await Proposal.find({}).limit(5);
    
    if (proposals.length === 0) {
      console.log('❌ No proposals found!');
    } else {
      console.log(`\n✅ Found ${proposals.length} proposals:\n`);
      
      for (const proposal of proposals) {
        console.log(`📊 Proposal: ${proposal._id}`);
        console.log(`   Title: ${proposal.title}`);
        console.log(`   Status: ${proposal.status}`);
        console.log(`   totalExpenses: ₱${(proposal.totalExpenses || 0).toLocaleString()}`);
        console.log(`   totalIncome: ₱${(proposal.totalIncome || 0).toLocaleString()}`);
        console.log(`   proposedBudget: ₱${(proposal.proposedBudget || 0).toLocaleString()}`);
        console.log(`   projectedCorporateIncome: ₱${(proposal.projectedCorporateIncome || 0).toLocaleString()}`);
        console.log(`   projectedSubsidy: ₱${(proposal.projectedSubsidy || 0).toLocaleString()}`);
        console.log(`   CALCULATION CHECK: ${(proposal.totalExpenses || 0)} + ${(proposal.totalIncome || 0)} = ${((proposal.totalExpenses || 0) + (proposal.totalIncome || 0))}`);
        console.log('---\n');
      }
    }

    console.log('\n📍 Checking Income records for this proposal...');
    const incomeRecords = await Income.find({}).limit(10);
    console.log(`Found ${incomeRecords.length} Income records:\n`);
    
    for (const income of incomeRecords) {
      console.log(`💰 Income ID: ${income._id}`);
      console.log(`   Amount: ₱${(income.amount || 0).toLocaleString()}`);
      console.log(`   Category: ${income.category || 'N/A'}`);
      console.log(`   Status: ${income.status || 'N/A'}`);
      console.log('---');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugProposals();