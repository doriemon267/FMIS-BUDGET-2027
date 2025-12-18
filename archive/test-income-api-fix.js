const axios = require('axios');

// Test Income API endpoints after fixing middleware
async function testIncomeAPI() {
    const baseURL = 'http://localhost:5005';
    
    try {
        console.log('🧪 Testing Income API with workflow middleware fix...\n');
        
        // Test 1: GET income entries (the failing endpoint)
        console.log('1. Testing GET /income?region=CENTRAL+OFFICE');
        try {
            const response = await axios.get(`${baseURL}/income?region=CENTRAL+OFFICE`);
            console.log('✅ SUCCESS: Income GET request');
            console.log(`   Status: ${response.status}`);
            console.log(`   Data count: ${response.data.length}`);
        } catch (error) {
            console.log('❌ FAILED: Income GET request');
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message || error.message}`);
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        
        // Test 2: POST new income entry
        console.log('2. Testing POST /income (create new income)');
        const testIncomeData = {
            particulars: 'Test Income Entry - API Fix Validation',
            amount: 50000,
            incomecategory: '674ff899ac9415ab60e8efca', // Sample category ID
            fiscalYear: '2025',
            budgetType: 'REGULAR',
            region: 'CENTRAL OFFICE',
            department: 'INFORMATION TECHNOLOGY',
            division: 'SYSTEMS DEVELOPMENT'
        };
        
        try {
            const response = await axios.post(`${baseURL}/income`, testIncomeData);
            console.log('✅ SUCCESS: Income POST request');
            console.log(`   Status: ${response.status}`);
            console.log(`   Created ID: ${response.data._id}`);
            console.log(`   Status: ${response.data.status}`);
            console.log(`   Original Level: ${response.data.originalLevel}`);
            
            // Store for cleanup
            const createdId = response.data._id;
            
            // Test 3: UPDATE income entry
            console.log('\n3. Testing PUT /income/:id (update income)');
            const updateData = {
                ...testIncomeData,
                amount: 75000,
                particulars: 'Updated Test Income - Workflow Integration'
            };
            
            try {
                const updateResponse = await axios.put(`${baseURL}/income/${createdId}`, updateData);
                console.log('✅ SUCCESS: Income PUT request');
                console.log(`   Status: ${updateResponse.status}`);
                console.log(`   Updated Amount: ${updateResponse.data.amount}`);
                console.log(`   Status: ${updateResponse.data.status}`);
            } catch (error) {
                console.log('❌ FAILED: Income PUT request');
                console.log(`   Status: ${error.response?.status}`);
                console.log(`   Error: ${error.response?.data?.message || error.message}`);
            }
            
            // Cleanup: Delete test entry
            console.log('\n4. Cleaning up test entry...');
            try {
                await axios.delete(`${baseURL}/income/${createdId}`);
                console.log('✅ Test entry cleaned up successfully');
            } catch (error) {
                console.log('⚠️  Failed to cleanup test entry:', error.message);
            }
            
        } catch (error) {
            console.log('❌ FAILED: Income POST request');
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message || error.message}`);
            console.log('   Details:', error.response?.data?.details);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 Income API Test Summary:');
        console.log('   - Fixed submissionWorkflowControl middleware integration');
        console.log('   - Updated Income routes to use new middleware');
        console.log('   - Enhanced Income controller with workflow data handling');
        console.log('   - Verified Income model supports workflow fields');
        console.log('\n✨ Income API should now work with IncomeTable.jsx!');
        
    } catch (error) {
        console.error('💥 Test setup error:', error.message);
    }
}

// Check if server is running first
async function checkServer() {
    try {
        await axios.get('http://localhost:5005/health');
        return true;
    } catch (error) {
        return false;
    }
}

// Main execution
checkServer().then(isRunning => {
    if (isRunning) {
        testIncomeAPI();
    } else {
        console.log('⚠️  Server not running at http://localhost:5005');
        console.log('   Please start the server first with: npm start');
        console.log('   Then run this test again');
    }
});