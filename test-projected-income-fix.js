// Test script to verify PROJECTED CORPORATE INCOME fix
const axios = require('axios');

async function testProjectedCorporateIncome() {
  try {
    console.log('🔍 Testing PROJECTED CORPORATE INCOME column data...\n');

    // Test the proposals endpoint
    const response = await axios.get('http://localhost:5005/api/proposals', {
      params: {
        fiscalYear: '2025',
        budgetType: 'Initial',
        status: 'Submitted'
      }
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📋 Number of proposals found:', response.data.length);

    if (response.data.length === 0) {
      console.log('⚠️  No proposals found. The PROJECTED CORPORATE INCOME column will be empty.');
      console.log('💡 To test this fix, you need proposals with MOOE or Capital Outlay data that has income values.');
      return;
    }

    // Analyze the proposals
    let mooeCount = 0;
    let capitalOutlayCount = 0;
    let incomeCount = 0;
    let totalIncomeSum = 0;

    response.data.forEach((proposal, index) => {
      console.log(`\n--- Proposal ${index + 1} ---`);
      console.log('Type:', proposal.cobExpenditures);
      console.log('Total Income:', proposal.totalIncome);
      console.log('Total Expenses:', proposal.totalExpenses);

      if (proposal.cobExpenditures === 'MOOE') {
        mooeCount++;
        if (proposal.totalIncome > 0) {
          incomeCount++;
          totalIncomeSum += proposal.totalIncome;
        }
      } else if (proposal.cobExpenditures === 'Capital Outlay') {
        capitalOutlayCount++;
        if (proposal.totalIncome > 0) {
          incomeCount++;
          totalIncomeSum += proposal.totalIncome;
        }
      }
    });

    console.log('\n📈 Summary:');
    console.log('MOOE Proposals:', mooeCount);
    console.log('Capital Outlay Proposals:', capitalOutlayCount);
    console.log('Proposals with Income > 0:', incomeCount);
    console.log('Total Income Sum:', totalIncomeSum.toLocaleString());

    if (incomeCount > 0) {
      console.log('\n✅ SUCCESS: PROJECTED CORPORATE INCOME column should now display actual data!');
    } else {
      console.log('\n⚠️  All proposals show ₱0.00 income. This could mean:');
      console.log('   1. No income data exists in MOOE/Capital Outlay records');
      console.log('   2. Income fields are empty in the database');
      console.log('   3. Need to add sample income data for testing');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error('💡 Make sure the server is running on port 5005');
    }
  }
}

testProjectedCorporateIncome();