const mongoose = require('mongoose');
require('dotenv').config();

async function testDepartmentFiltering() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
    const PersonnelService = require('./models/personnelServices');

    console.log('🔍 Testing Department user filtering with fixed middleware...');

    // Get the DEPARTMENT assignment
    const assignment = await HierarchicalUserAssignment.getUserPermissions('751754');
    console.log('Assignment Level:', assignment.assignmentLevel);

    // Simulate the DEPARTMENT filtering logic from middleware
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
                      { status: { $in: ['Region Approved', 'REGION APPROVED'] } },
                      { status: 'Finalized' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
    }

    console.log('\n🎯 Generated Filters:');
    console.log('Region filter:', JSON.stringify(submissionFilters.$and[0]));
    console.log('Department filter:', JSON.stringify(submissionFilters.$and[1]));

    // Test the query
    const result = await PersonnelService.find(submissionFilters).countDocuments();
    console.log(`\n✅ Department user can see ${result} proposals`);

    // Also test the raw Division Submitted query
    const divisionQuery = {
      originalLevel: 'DIVISION',
      status: 'Division Submitted',
      region: assignment.regionId?.Region,
      department: assignment.departmentId?.Department
    };

    const rawResult = await PersonnelService.find(divisionQuery).countDocuments();
    console.log(`📊 Raw Division Submitted query: ${rawResult} proposals`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDepartmentFiltering();