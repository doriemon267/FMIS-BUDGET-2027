const axios = require('axios');

// Test pagination functionality
async function testPagination() {
    const baseURL = 'http://localhost:5005/api';

    console.log('🧪 Testing Employee Pagination API...\n');

    try {
        // Test different page sizes
        const pageSizes = [10, 20, 50];

        for (const limit of pageSizes) {
            console.log(`📄 Testing with ${limit} employees per page:`);

            // Test first page
            const response = await axios.get(`${baseURL}/employees`, {
                params: {
                    page: 1,
                    limit: limit,
                    region: 'NCR' // You may need to adjust this based on your data
                }
            });

            console.log(`   ✅ Page 1: ${response.data.employees?.length || 0} employees`);
            console.log(`   📊 Total records: ${response.data.totalRecords || 0}`);
            console.log(`   📄 Total pages: ${response.data.totalPages || 0}`);
            console.log(`   📍 Current page: ${response.data.currentPage || 0}\n`);
        }

        // Test page navigation
        console.log('🔄 Testing page navigation:');
        const testLimit = 10;

        for (let page = 1; page <= 3; page++) {
            try {
                const response = await axios.get(`${baseURL}/employees`, {
                    params: {
                        page: page,
                        limit: testLimit,
                        region: 'NCR'
                    }
                });

                const employees = response.data.employees || [];
                console.log(`   📖 Page ${page}: ${employees.length} employees`);

                if (employees.length > 0) {
                    console.log(`      👤 First employee: ${employees[0].EmployeeFullName}`);
                    console.log(`      🏢 Department: ${employees[0].Department}`);
                }
            } catch (error) {
                console.log(`   ❌ Page ${page}: Error - ${error.response?.status || 'Unknown'}`);
            }
        }

        console.log('\n✅ Pagination test completed successfully!');

    } catch (error) {
        console.error('❌ Pagination test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

// Run the test
testPagination();