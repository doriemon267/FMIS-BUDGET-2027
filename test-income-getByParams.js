const axios = require('axios');

// Test the new income getByParams endpoint
async function testIncomeGetByParams() {
  const baseURL = 'http://localhost:5005';

  try {
    console.log('🧪 Testing new Income getByParams endpoint...\n');

    // Test 1: GET income entries with parameters
    console.log('1. Testing GET /income/getByParams');
    try {
      const response = await axios.get(`${baseURL}/income/getByParams?fiscalYear=2025&budgetType=REGULAR`);
      console.log('✅ SUCCESS: Income getByParams request');
      console.log(`   Status: ${response.status}`);
      console.log(`   Data count: ${response.data.length}`);
      if (response.data.length > 0) {
        console.log(`   Sample data:`, JSON.stringify(response.data[0], null, 2));
      }
    } catch (error) {
      console.log('❌ FAILED: Income getByParams request');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Test with different parameters
    console.log('2. Testing GET /income/getByParams with region filter');
    try {
      const response = await axios.get(`${baseURL}/income/getByParams?region=CENTRAL+OFFICE&status=Draft`);
      console.log('✅ SUCCESS: Income getByParams with region filter');
      console.log(`   Status: ${response.status}`);
      console.log(`   Data count: ${response.data.length}`);
    } catch (error) {
      console.log('❌ FAILED: Income getByParams with region filter');
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

  } catch (error) {
    console.log('💥 Test failed with error:', error.message);
  }
}

// Run the test
testIncomeGetByParams();