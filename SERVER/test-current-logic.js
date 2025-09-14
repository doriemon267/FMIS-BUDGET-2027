// Quick test script to see current middleware behavior
const mongoose = require('mongoose');
require('dotenv').config();

// Mock assignment data based on your debug output
const mockDepartmentAssignment = {
  assignmentLevel: 'DEPARTMENT',
  regionId: { Region: 'CENTRAL OFFICE' },
  departmentId: { Department: 'CORPORATE PLANNING SERVICES' },
  divisionName: null
};

console.log('🔍 Testing Current Middleware Logic');
console.log('Assignment data:', mockDepartmentAssignment);

// Simulate the Department case logic
const regionName = mockDepartmentAssignment.regionId?.Region || mockDepartmentAssignment.regions?.[0]?.regionName;
const departmentName = mockDepartmentAssignment.departmentId?.Department || mockDepartmentAssignment.departments?.[0]?.departmentName;

console.log('\n📊 Extracted values:');
console.log('Region Name:', regionName);
console.log('Department Name:', departmentName);

const submissionFilters = {
  $and: [
    { region: regionName },
    { department: departmentName },
    {
      $or: [
        // Own department-level data (no division specified, any status)
        { 
          $and: [
            { department: departmentName },
            { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
          ]
        },
        // Submitted division data within their department
        { 
          $and: [
            { division: { $exists: true, $ne: null, $ne: "" } },
            { department: departmentName },
            { 
              $or: [
                { status: 'Submitted' },
                { status: 'Approved' }
              ]
            }
          ]
        }
      ]
    }
  ]
};

console.log('\n🎯 Generated Department Filters:');
console.log(JSON.stringify(submissionFilters, null, 2));

console.log('\n✅ This should filter to show only:');
console.log('1. CORPORATE PLANNING SERVICES department data (any status, no division)');
console.log('2. Submitted/Approved division data within CORPORATE PLANNING SERVICES');
console.log('\n❌ Should NOT show other departments in CENTRAL OFFICE region');