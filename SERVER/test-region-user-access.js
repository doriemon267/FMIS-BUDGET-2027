/**
 * Test the Region user login and data access after fixes
 */
const axios = require('axios');

async function testRegionUserAccess() {
  try {
    console.log('🔍 Testing Region user access after fixes...\n');
    
    // Test login with the created Region user
    console.log('1. Attempting login with Region user...');
    try {
      const loginResponse = await axios.post('http://localhost:5005/api/auth/login', {
        email: 'nelson.region@test.com',
        password: 'TestPass123!'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful - got token');
      
      // Test overtime pay access
      console.log('\n2. Requesting overtime pay data...');
      const overtimeResponse = await axios.get('http://localhost:5005/api/overtime/overtime-pay', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          page: 1,
          limit: 10
        }
      });
      
      console.log(`\n📊 API Response Summary:`);
      console.log(`Status: ${overtimeResponse.status}`);
      console.log(`Total Records: ${overtimeResponse.data.totalRecords}`);
      console.log(`Records Returned: ${overtimeResponse.data.data?.length || 0}`);
      
      if (overtimeResponse.data.data && overtimeResponse.data.data.length > 0) {
        console.log('\n📋 Records visible to Region user:');
        overtimeResponse.data.data.forEach((record, i) => {
          console.log(`\n${i+1}. Employee: ${record.employeeFullName}`);
          console.log(`   Region: ${record.region}`);
          console.log(`   Department: ${record.department || 'N/A'}`);
          console.log(`   Division: ${record.division || 'N/A'}`);
          console.log(`   Status: ${record.status || 'N/A'}`);
          console.log(`   Original Level: ${record.originalLevel || 'N/A'}`);
          
          // Analyze if this record should be visible
          const hasSubLevels = (record.department && record.department !== 'N/A') || 
                             (record.division && record.division !== 'N/A');
          const isFromSameRegion = record.region === 'CENTRAL OFFICE';
          const isSubmitted = record.status === 'Submitted' || record.status === 'Approved';
          
          console.log(`   Should be visible: ${
            isFromSameRegion && (!hasSubLevels || isSubmitted) ? '✅ YES' : '❌ NO'
          }`);
          
          if (isFromSameRegion && hasSubLevels && !isSubmitted) {
            console.log(`   🚨 PROBLEM: Has dept/div but NOT submitted - should be filtered out!`);
          }
        });
      } else {
        console.log('\n✅ No records returned - this could be correct behavior');
      }
      
    } catch (loginError) {
      if (loginError.response?.status === 403 || loginError.response?.status === 401) {
        console.log('❌ Login failed - authentication issue');
        console.log('Response:', loginError.response.data);
      } else {
        throw loginError;
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testRegionUserAccess();