/**
 * Test actual API call with correct port
 */
const axios = require('axios');

async function testRegionAPI() {
  try {
    console.log('🔍 Testing Region user API access...');
    
    console.log('1. Attempting login for Nelson (Region user)...');
    const loginResponse = await axios.post('http://localhost:5005/api/auth/login', {
      email: 'nelson.villanueva@mit.gov.ph',
      password: 'MITnmv2025!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    console.log('\n2. Requesting overtime pay data...');
    const response = await axios.get('http://localhost:5005/api/overtime/overtime-pay', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`\n📊 Response: ${response.data.totalRecords} total records`);
    console.log(`Records returned: ${response.data.data.length}`);
    
    if (response.data.data.length > 0) {
      console.log('\n❌ PROBLEM: Region user is seeing records!');
      response.data.data.forEach((record, i) => {
        console.log(`${i+1}. ${record.employeeFullName}`);
        console.log(`   Status: ${record.status || 'N/A'}`);
        console.log(`   Dept: ${record.department || 'N/A'}`);
        console.log(`   Div: ${record.division || 'N/A'}`);
      });
    } else {
      console.log('✅ Correct: No records visible to Region user');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRegionAPI();