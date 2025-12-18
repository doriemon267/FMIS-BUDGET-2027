const axios = require('axios');

// Test the backend hierarchical access fix
async function testBackendFix() {
    const baseURL = 'http://localhost:5005';

    console.log('🧪 Testing Backend Hierarchical Access Fix...\n');

    // Test 1: Division level user (should NOT accept region parameter)
    console.log('📋 Test 1: Division Level User with Region Parameter (should be rejected)');
    try {
        const response = await axios.get(`${baseURL}/employees`, {
            params: {
                page: 1,
                limit: 10,
                division: 'MANAGEMENT INFORMATION DIVISION',
                region: 'CENTRAL OFFICE' // This should be rejected
            }
        });
        console.log('❌ UNEXPECTED: Request succeeded when it should have been rejected');
        console.log('Response:', response.data);
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('✅ SUCCESS: Access correctly denied for division user with region parameter');
            console.log('   Message:', error.response.data.message);
        } else if (error.response?.status === 500) {
            console.log('❌ SERVER ERROR: 500 Internal Server Error');
            console.log('   This indicates the hasRequestedRegionAccess bug is not fixed');
            console.log('   Error:', error.response.data);
        } else {
            console.log('❓ Unexpected error:', error.message);
        }
    }

    // Test 2: Division level user (should work without region parameter)
    console.log('\n📋 Test 2: Division Level User without Region Parameter (should work)');
    try {
        const response = await axios.get(`${baseURL}/employees`, {
            params: {
                page: 1,
                limit: 10,
                division: 'MANAGEMENT INFORMATION DIVISION'
                // No region parameter - should work
            }
        });
        console.log('✅ SUCCESS: Division-level request without region parameter worked');
        console.log(`   Returned ${response.data.employees?.length || 0} employees`);
    } catch (error) {
        console.log('❌ FAILED: Division-level request without region failed');
        console.log('   Error:', error.message);
    }

    // Test 3: Department level user (should NOT accept region parameter)
    console.log('\n📋 Test 3: Department Level User with Region Parameter (should be rejected)');
    try {
        const response = await axios.get(`${baseURL}/employees`, {
            params: {
                page: 1,
                limit: 10,
                department: 'Information Technology Department',
                region: 'CENTRAL OFFICE' // This should be rejected
            }
        });
        console.log('❌ UNEXPECTED: Request succeeded when it should have been rejected');
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('✅ SUCCESS: Access correctly denied for department user with region parameter');
            console.log('   Message:', error.response.data.message);
        } else {
            console.log('❌ Error:', error.message);
        }
    }

    // Test 4: Region level user (should accept region parameter)
    console.log('\n📋 Test 4: Region Level User with Region Parameter (should work)');
    try {
        const response = await axios.get(`${baseURL}/employees`, {
            params: {
                page: 1,
                limit: 10,
                region: 'CENTRAL OFFICE'
            }
        });
        console.log('✅ SUCCESS: Region-level request with region parameter worked');
        console.log(`   Returned ${response.data.employees?.length || 0} employees`);
    } catch (error) {
        console.log('❌ FAILED: Region-level request failed');
        console.log('   Error:', error.message);
    }

    console.log('\n🎯 Test Summary:');
    console.log('   ✅ Division/Department users should be rejected when sending region parameter');
    console.log('   ✅ Division/Department users should work when NOT sending region parameter');
    console.log('   ✅ Region users should work when sending region parameter');
    console.log('   ✅ No 500 Internal Server Errors should occur');
}

testBackendFix();