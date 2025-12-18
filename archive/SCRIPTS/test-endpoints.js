// Simple test to verify our endpoints work
const axios = require('axios');

async function testEndpoints() {
  const baseURL = 'http://localhost:5005';
  
  console.log('🧪 Testing Consolidated Capital Outlay Endpoints...\n');
  
  try {
    // Test 1: Test endpoint (no auth required)
    console.log('1. Testing basic routing...');
    const testResponse = await axios.get(`${baseURL}/api/consolidated-reports/test`);
    console.log('✅ Basic routing works:', testResponse.data.message);
    
  } catch (error) {
    console.log('❌ Basic routing failed:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
  
  try {
    // Test 2: Capital outlay data endpoint (requires auth)
    console.log('\n2. Testing capital outlay data endpoint (will fail without auth)...');
    const dataResponse = await axios.get(`${baseURL}/api/consolidated-reports/capital-outlay-data`, {
      params: {
        fiscalYear: 2026,
        budgetType: 'Initial',
        regions: ['Central Office']
      }
    });
    console.log('✅ Capital outlay data endpoint works:', dataResponse.data);
    
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('✅ Capital outlay data endpoint exists (requires authentication)');
    } else {
      console.log('❌ Capital outlay data endpoint failed:', error.message);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
  }
}

testEndpoints();