const axios = require('axios');

// Test hierarchical employee access control
async function testHierarchicalAccess() {
    const baseURL = 'http://localhost:5005/api';

    console.log('🧪 Testing Hierarchical Employee Access Control...\n');

    // Test scenarios for different user levels
    const testScenarios = [
        {
            name: 'REGION Level User',
            level: 'REGION',
            region: 'CENTRAL OFFICE',
            expectedBehavior: 'Should see ALL employees in CENTRAL OFFICE region'
        },
        {
            name: 'DIVISION Level User',
            level: 'DIVISION',
            division: 'IT Division', // Assuming this division exists
            expectedBehavior: 'Should see ONLY employees in IT Division, regardless of region parameter'
        },
        {
            name: 'DEPARTMENT Level User',
            level: 'DEPARTMENT',
            department: 'Information Technology Department', // Assuming this department exists
            expectedBehavior: 'Should see ONLY employees in IT Department, regardless of region parameter'
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n📋 Testing: ${scenario.name}`);
        console.log(`   Expected: ${scenario.expectedBehavior}`);

        try {
            const params = {
                page: 1,
                limit: 10
            };

            // Add appropriate parameters based on user level
            if (scenario.level === 'REGION') {
                params.region = scenario.region;
            } else if (scenario.level === 'DIVISION') {
                params.division = scenario.division;
                // Try to add a different region to test if it's ignored
                params.region = 'NCR'; // This should be ignored for division users
            } else if (scenario.level === 'DEPARTMENT') {
                params.department = scenario.department;
                // Try to add a different region to test if it's ignored
                params.region = 'NCR'; // This should be ignored for department users
            }

            console.log(`   Request params: ${JSON.stringify(params, null, 2)}`);

            const response = await axios.get(`${baseURL}/employees`, { params });

            const employees = response.data.employees || [];
            console.log(`   ✅ Response: ${employees.length} employees found`);

            if (employees.length > 0) {
                // Verify that employees match the expected scope
                let allMatchScope = true;

                employees.forEach((emp, index) => {
                    if (scenario.level === 'DIVISION' && scenario.division) {
                        if (emp.Division !== scenario.division) {
                            console.log(`   ❌ Employee ${index + 1}: ${emp.EmployeeFullName} has Division: ${emp.Division} (expected: ${scenario.division})`);
                            allMatchScope = false;
                        }
                    } else if (scenario.level === 'DEPARTMENT' && scenario.department) {
                        if (emp.Department !== scenario.department) {
                            console.log(`   ❌ Employee ${index + 1}: ${emp.EmployeeFullName} has Department: ${emp.Department} (expected: ${scenario.department})`);
                            allMatchScope = false;
                        }
                    } else if (scenario.level === 'REGION' && scenario.region) {
                        if (emp.Region !== scenario.region) {
                            console.log(`   ❌ Employee ${index + 1}: ${emp.EmployeeFullName} has Region: ${emp.Region} (expected: ${scenario.region})`);
                            allMatchScope = false;
                        }
                    }
                });

                if (allMatchScope) {
                    console.log(`   ✅ All employees match the expected ${scenario.level.toLowerCase()} scope`);
                } else {
                    console.log(`   ❌ Some employees do not match the expected ${scenario.level.toLowerCase()} scope`);
                }
            } else {
                console.log(`   ℹ️  No employees found for this ${scenario.level.toLowerCase()} scope`);
            }

        } catch (error) {
            if (error.response?.status === 403) {
                console.log(`   ✅ Access correctly denied: ${error.response.data.message}`);
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
    }

    console.log('\n🎯 Test Summary:');
    console.log('   - REGION level users should see all employees in their region');
    console.log('   - DIVISION level users should see only employees in their division');
    console.log('   - DEPARTMENT level users should see only employees in their department');
    console.log('   - Region parameters should be ignored for DIVISION/DEPARTMENT users');
}

testHierarchicalAccess();