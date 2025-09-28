const mongoose = require('mongoose');
require('dotenv').config();

async function testMiddleware() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);

    const UserAssignment = require('./models/HierarchicalUserAssignment');
    const PersonnelService = require('./models/personnelServices');

    console.log('🔍 Testing middleware filtering for Department user...\n');

    // Get Department user
    const deptUser = await UserAssignment.findOne({
      userId: '751754',
      assignmentLevel: 'DEPARTMENT'
    });

    console.log('👤 Testing for User ID: 751754');
    console.log(`Assignment Level: ${deptUser.assignmentLevel}`);

    // Simulate middleware filtering (old structure)
    let hierarchicalFilters = {};
    let submissionFilters = {};

    // OLD STRUCTURE: Division → Department → Region
    switch (deptUser.assignmentLevel) {
      case 'DEPARTMENT':
        hierarchicalFilters = {
          region: deptUser.regionId?.Region,
          department: deptUser.departmentId?.Department
        };

        submissionFilters = {
          region: deptUser.regionId?.Region,
          department: deptUser.departmentId?.Department,
          $or: [
            // Own department data
            { workflowLevel: 'DEPARTMENT' },
            // Division data that has been submitted
            {
              workflowLevel: 'DIVISION',
              status: { $in: ['Division Submitted', 'Department Verified', 'Department Submitted', 'Region Approved', 'Finalized'] }
            }
          ]
        };
        break;
    }

    console.log('\n🎯 Middleware Filters:');
    console.log('Hierarchical:', JSON.stringify(hierarchicalFilters, null, 2));
    console.log('Submission:', JSON.stringify(submissionFilters, null, 2));

    // Test the query
    const visibleProposals = await PersonnelService.find(submissionFilters).countDocuments();
    console.log(`\n✅ Proposals visible with middleware filters: ${visibleProposals}`);

    // Test without middleware (raw query)
    const rawQuery = {
      originalLevel: 'DIVISION',
      status: 'Division Submitted',
      region: deptUser.regionId?.Region,
      department: deptUser.departmentId?.Department
    };

    const rawCount = await PersonnelService.find(rawQuery).countDocuments();
    console.log(`📊 Raw query count: ${rawCount}`);

    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMiddleware();