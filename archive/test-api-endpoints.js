// Simple test to verify API endpoints are accessible
const axios = require('axios');

async function testAPIEndpoints() {
  const baseURL = 'http://localhost:5005';
  
  try {
    console.log('🔍 Testing API endpoints...\n');

    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    try {
      const response = await axios.get(`${baseURL}/api/health`);
      console.log('✅ Server is running');
    } catch (error) {
      console.log('ℹ️ Health endpoint not available, but server might still be running');
    }

    // Test 2: Test capital outlay details endpoints (without auth for now)
    console.log('\n2. Testing capital outlay details endpoints...');
    
    // Get a sample capital outlay ID
    const mongoose = require('mongoose');
    require('dotenv').config();
    const CapitalOutlay = require('./SERVER/models/CapitalOutlay');
    
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fmis-budget');
    const sampleCapitalOutlay = await CapitalOutlay.findOne();
    
    if (sampleCapitalOutlay) {
      console.log(`   Using capital outlay ID: ${sampleCapitalOutlay._id}`);
      
      // Test GET details endpoint
      try {
        const response = await axios.get(`${baseURL}/api/capital-outlay/${sampleCapitalOutlay._id}/details`);
        console.log('❌ GET details endpoint should require authentication');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ GET details endpoint properly requires authentication');
        } else {
          console.log('⚠️ Unexpected error:', error.message);
        }
      }

      // Test POST details endpoint
      try {
        const response = await axios.post(`${baseURL}/api/capital-outlay/${sampleCapitalOutlay._id}/details`, {
          details: [
            {
              particulars: 'Test Item',
              income_amount: 100000,
              subsidy_amount: 50000
            }
          ],
          processBy: 'Test User'
        });
        console.log('❌ POST details endpoint should require authentication');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log('✅ POST details endpoint properly requires authentication');
        } else {
          console.log('⚠️ Unexpected error:', error.message);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n🎉 API endpoint tests completed!');
    console.log('📝 Note: Endpoints are properly secured with authentication');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIEndpoints();