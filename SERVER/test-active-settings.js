/**
 * Test the /settings/active endpoint
 */
const mongoose = require('mongoose');
const axios = require('axios');

async function testActiveSettingsEndpoint() {
  try {
    console.log('Testing /settings/active endpoint...\n');
    
    // Make request to the endpoint
    const response = await axios.get('http://localhost:5005/api/settings/active');
    
    console.log('✅ Response from /settings/active:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n📌 Key values:');
    console.log(`  budgetType: ${response.data.budgetType}`);
    console.log(`  fiscalYear: ${response.data.fiscalYear}`);
    console.log(`  isActive: ${response.data.isActive}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

testActiveSettingsEndpoint();
