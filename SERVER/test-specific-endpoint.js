/**
 * Test specific endpoint authentication
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testSpecificEndpoint() {
  try {
    // Create fresh JWT
    const regionUserData = {
      id: 416461,
      FirstName: "Nelson",
      LastName: "Eloso",
      roles: ["EMPLOYEE"]
    };
    
    const token = jwt.sign(regionUserData, '3e0dba935edc94b41f89f983639f3612f317bfec0e10e98a9bab4c0db5c4b249cef94b208262991a8cde8f38e2f6a7c8f565311c88688596548699e870c96a27', { expiresIn: '1h' });
    console.log('🔑 Testing with Region user token\n');
    
    const config = {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Test the exact endpoint
    console.log('🧪 Testing GET /overtime-pay...');
    try {
      const response = await axios.get('http://localhost:5005/overtime-pay', config);
      console.log('✅ Success!', response.status);
      console.log(`📊 Records returned: ${response.data.length}`);
    } catch (error) {
      console.log('❌ Failed:', error.response?.status);
      console.log('   Error:', error.response?.data);
      
      // Let's see the response headers for more debugging
      if (error.response?.headers) {
        console.log('   Headers:', error.response.headers);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSpecificEndpoint();