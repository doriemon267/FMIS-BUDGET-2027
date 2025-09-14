/**
 * Test script to verify hierarchical access control for employee endpoints
 */

const axios = require('axios');

// Base URL for your API
const BASE_URL = 'http://localhost:3001';

async function testHierarchicalAccess() {
  console.log('🧪 Testing Hierarchical Access Control for Employee Endpoints...\n');

  // Test endpoints that should now have hierarchical filtering
  const endpoints = [
    '/getpersonnels/hiredBeforeJune1988',
    '/getpersonnels',
    '/getpersonnels/byParams',
    '/personnelAggregates'
  ];

  const testUsers = {
    division: {
      token: 'your_division_user_token_here',
      expectedBehavior: 'Should only see division-level data'
    },
    department: {
      token: 'your_department_user_token_here', 
      expectedBehavior: 'Should see submitted division data + department data'
    },
    region: {
      token: 'your_region_user_token_here',
      expectedBehavior: 'Should see submitted department data + region data'
    }
  };

  for (const endpoint of endpoints) {
    console.log(`\n📍 Testing endpoint: ${endpoint}`);
    console.log('=' .repeat(50));
    
    for (const [userType, userData] of Object.entries(testUsers)) {
      try {
        console.log(`\n👤 Testing as ${userType.toUpperCase()} user:`);
        console.log(`Expected: ${userData.expectedBehavior}`);
        
        const response = await axios.get(`${BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${userData.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        const data = response.data;
        const count = Array.isArray(data) ? data.length : (data.total || 0);
        
        console.log(`✅ Response: ${count} records found`);
        
        if (Array.isArray(data) && data.length > 0) {
          const uniqueRegions = [...new Set(data.map(item => item.region).filter(Boolean))];
          const uniqueDepartments = [...new Set(data.map(item => item.department).filter(Boolean))];
          const uniqueDivisions = [...new Set(data.map(item => item.division).filter(Boolean))];
          
          console.log(`   📊 Data breakdown:`);
          console.log(`   - Regions: ${uniqueRegions.length} (${uniqueRegions.join(', ') || 'None'})`);
          console.log(`   - Departments: ${uniqueDepartments.length} (${uniqueDepartments.slice(0, 3).join(', ')}${uniqueDepartments.length > 3 ? '...' : ''})`);
          console.log(`   - Divisions: ${uniqueDivisions.length} (${uniqueDivisions.slice(0, 3).join(', ')}${uniqueDivisions.length > 3 ? '...' : ''})`);
        }
        
      } catch (error) {
        if (error.response) {
          console.log(`❌ Error ${error.response.status}: ${error.response.data.message || error.message}`);
        } else if (error.code === 'ECONNREFUSED') {
          console.log(`❌ Connection refused - Make sure your server is running on ${BASE_URL}`);
        } else {
          console.log(`❌ Error: ${error.message}`);
        }
      }
    }
  }
  
  console.log('\n🏁 Test completed!');
  console.log('\n📝 Manual Verification Steps:');
  console.log('1. Replace token placeholders with actual JWT tokens');
  console.log('2. Ensure your server is running');
  console.log('3. Check that Division users only see their division data');
  console.log('4. Check that Department users see submitted division + department data');
  console.log('5. Check that Region users see submitted department + region data');
}

// Run the test
if (require.main === module) {
  testHierarchicalAccess().catch(console.error);
}

module.exports = { testHierarchicalAccess };