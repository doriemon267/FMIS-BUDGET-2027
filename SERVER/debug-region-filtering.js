// Debug script for Region level filtering
const mongoose = require('mongoose');
require('dotenv').config();

// Mock assignment for Region level user
const mockRegionAssignment = {
  assignmentLevel: 'REGION',
  regions: [{ regionName: 'Region IX' }], // Example region
  departments: [],
  divisions: [],
  rolePermissions: {}
};

// Simulate the Region case from submissionWorkflowControl middleware
function simulateRegionFiltering(assignment, enforceSubmissionWorkflow = true) {
  console.log('🔍 Simulating Region Level Filtering');
  console.log('Assignment:', assignment);
  console.log('Enforce Submission Workflow:', enforceSubmissionWorkflow);
  
  let submissionFilters = {};
  
  if (enforceSubmissionWorkflow) {
    submissionFilters = {
      $and: [
        { region: assignment.regions[0]?.regionName },
        {
          $or: [
            // Own region-level data (no department/division specified, any status)
            { 
              $and: [
                { region: assignment.regions[0]?.regionName },
                { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
              ]
            },
            // Submitted department/division data within their region
            { 
              $and: [
                { $or: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { division: { $exists: true, $ne: null, $ne: "" } }
                ] },
                { region: assignment.regions[0]?.regionName },
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
  } else {
    // Fallback to standard hierarchical filtering
    submissionFilters = {
      region: assignment.regions[0]?.regionName
    };
  }
  
  console.log('\n🎯 Generated Filters:');
  console.log(JSON.stringify(submissionFilters, null, 2));
  
  return submissionFilters;
}

// Test with mock data
console.log('='.repeat(60));
console.log('TESTING REGION LEVEL FILTERING');
console.log('='.repeat(60));

const filters = simulateRegionFiltering(mockRegionAssignment, true);

console.log('\n📊 Analysis:');
console.log('- Region users should only see:');
console.log('  1. Their own region data (any status, no dept/div specified)');
console.log('  2. SUBMITTED/APPROVED data from departments within their region');
console.log('\n- The generated filter should:');
console.log('  - Match region:', mockRegionAssignment.regions[0].regionName);
console.log('  - Allow own region data without department/division');
console.log('  - Only allow dept/div data if status is Submitted/Approved');

console.log('\n❓ If Region users are still seeing all data, the issue might be:');
console.log('1. Middleware not applied correctly to the route');
console.log('2. Controller not using req.submissionWorkflowFilters');
console.log('3. Database query logic issue');
console.log('4. User assignment data incorrect');