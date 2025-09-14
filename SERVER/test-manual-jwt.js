/**
 * Create a JWT token for Region user and test API
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testWithManualJWT() {
  try {
    console.log('🔧 Creating JWT token for Region user...');
    
    // Create payload similar to what Division user might have
    const regionUserPayload = {
      Username: [416461, 'nelson.region@test.com'], // Based on the format I saw in checkToken
      userId: 416461,
      id: 416461,
      FirstName: 'Nelson',
      LastName: 'Eloso',
      Email: 'nelson.region@test.com',
      name: 'Nelson Eloso',
      email: 'nelson.region@test.com',
      roles: ['REGION_USER'], // lowercase 'roles' as expected by middleware
      Roles: ['REGION_USER']  // also keep uppercase for compatibility
    };
    
    const secretKey = '3e0dba935edc94b41f89f983639f3612f317bfec0e10e98a9bab4c0db5c4b249cef94b208262991a8cde8f38e2f6a7c8f565311c88688596548699e870c96a27';
    const token = jwt.sign(regionUserPayload, secretKey, { expiresIn: '1h' });
    
    console.log('✅ JWT token created');
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Test the overtime endpoint with this token
    console.log('\n🧪 Testing overtime endpoint with Region user token...');
    
    const response = await axios.get('http://localhost:5005/overtime-pay', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 10
      }
    });
    
    console.log(`\n📊 Response from API:`);
    console.log(`Status: ${response.status}`);
    console.log(`Total Records: ${response.data.totalRecords}`);
    console.log(`Records Returned: ${response.data.data?.length || 0}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📋 Data visible to Region user:');
      response.data.data.forEach((record, i) => {
        console.log(`\n${i+1}. ${record.employeeFullName}`);
        console.log(`   Region: ${record.region}`);
        console.log(`   Department: ${record.department || 'N/A'}`);
        console.log(`   Division: ${record.division || 'N/A'}`);
        console.log(`   Status: ${record.status || 'N/A'}`);
        
        // Check if this should be visible
        const hasSubLevels = (record.department && record.department !== 'N/A') || 
                           (record.division && record.division !== 'N/A');
        const isSubmitted = record.status === 'Submitted' || record.status === 'Approved';
        const isSameRegion = record.region === 'CENTRAL OFFICE';
        
        if (isSameRegion && hasSubLevels && !isSubmitted) {
          console.log(`   🚨 PROBLEM: This record should NOT be visible!`);
        } else if (isSameRegion && (!hasSubLevels || isSubmitted)) {
          console.log(`   ✅ OK: This record should be visible`);
        } else if (!isSameRegion) {
          console.log(`   🚨 PROBLEM: Different region - should NOT be visible!`);
        }
      });
    } else {
      console.log('\n✅ No data returned - this might be correct');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testWithManualJWT();