const mongoose = require('mongoose');
require('dotenv').config();

async function simulateMiddleware() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

    console.log('🔍 Simulating middleware logic...');

    const assignment = await HierarchicalUserAssignment.getUserPermissions('751754');

    console.log(`Assignment Level: ${assignment.assignmentLevel}`);

    // Simulate the exact middleware logic for DEPARTMENT level
    let hierarchicalFilters = {};
    let submissionFilters = {};

    const enforceSubmissionWorkflow = true;

    if (enforceSubmissionWorkflow) {
      submissionFilters = {
        $and: [
          { region: assignment.regionId?.Region || assignment.regions[0]?.regionName },
          { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
          {
            $or: [
              // Own department-level data
              {
                $and: [
                  { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
                  {
                    $or: [
                      { workflowLevel: 'DEPARTMENT' },
                      { $or: [{ division: { $exists: false } }, { division: null }, { division: "" }] }
                    ]
                  }
                ]
              },
              // Division data that has been submitted
              {
                $and: [
                  { division: { $exists: true, $ne: null, $ne: "" } },
                  { department: assignment.departmentId?.Department || assignment.departments[0]?.departmentName },
                  { workflowLevel: 'DIVISION' },
                  {
                    $or: [
                      { status: { $in: ['Division Submitted', 'DIVISION SUBMITTED'] } },
                      { status: { $in: ['Department Verified', 'DEPARTMENT VERIFIED'] } },
                      { status: { $in: ['Department Submitted', 'DEPARTMENT SUBMITTED'] } },
                      { status: { $in: ['Region Approved', 'REGION APPROVED', 'Office Approved', 'OFFICE APPROVED'] } },
                      { status: 'Finalized' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      hierarchicalFilters = submissionFilters;
    }

    console.log('\n🎯 Generated Filters:');
    console.log('Hierarchical:', JSON.stringify(hierarchicalFilters, null, 2));

    // Test the filter
  const PersonnelService = require('./models/PersonnelServices');
    const result = await PersonnelService.find(submissionFilters).countDocuments();
    console.log(`\n✅ Query result: ${result} documents found`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simulateMiddleware();