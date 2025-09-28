/**
 * Simple test without login - just check what middleware is doing
 */
const axios = require('axios');

async function testWithoutLogin() {
  try {
    console.log('🔍 Testing overtime endpoint without auth (should see middleware logs)...');
    
    const response = await axios.get('http://localhost:5005/api/overtime/overtime-pay');
    
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('Expected error (no auth):', error.response?.status);
    console.log('But we should see middleware logs in server console...');
  }
}

testWithoutLogin();