/**
 * Test actual API call to see what's happening with middleware
 */
const axios = require('axios');

async function testActualAPI() {
  try {
    console.log('🔍 Testing actual API call with Region user token...');
    
    // Get a token for Nelson (Region user)
    console.log('1. Getting login token for Region user...');
    const loginResponse = await axios.post('http://172.16.4.98:5005/api/auth/login', {
      email: 'nelson.villanueva@mit.gov.ph',
      password: 'MITnmv2025!'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token obtained');
    
    // Make request to overtime pay endpoint
    console.log('\n2. Requesting overtime pay data...');
    const overtimeResponse = await axios.get('http://172.16.4.98:5005/api/overtime/overtime-pay', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 20
      }
    });
    
    console.log('\n📊 API Response:');
    console.log(`Total Records: ${overtimeResponse.data.totalRecords}`);
    console.log(`Records Returned: ${overtimeResponse.data.data.length}`);
    
    if (overtimeResponse.data.data.length > 0) {
      console.log('\n📋 Records returned to Region user:');
      overtimeResponse.data.data.forEach((record, i) => {
        console.log(`${i+1}. ${record.employeeFullName}`);
        console.log(`   Region: ${record.region}`);
        console.log(`   Department: ${record.department || 'N/A'}`);
        console.log(`   Division: ${record.division || 'N/A'}`);
        console.log(`   Status: ${record.status || 'N/A'}`);
        console.log(`   Original Level: ${record.originalLevel || 'N/A'}`);
        
        // Check if this should be visible
        const hasSubLevels = (record.department && record.department !== 'N/A') || 
                           (record.division && record.division !== 'N/A');
        const isSubmitted = record.status === 'Submitted' || record.status === 'Approved';
        
        if (hasSubLevels && !isSubmitted) {
          console.log(`   ❌ VIOLATION: Has dept/div but NOT submitted!`);
        } else if (hasSubLevels && isSubmitted) {
          console.log(`   ✅ OK: Has dept/div but is submitted`);
        } else {
          console.log(`   ✅ OK: Pure region data`);
        }
        console.log('');
      });
    } else {
      console.log('✅ No records returned - correct behavior');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testActualAPI();