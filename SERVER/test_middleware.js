require('dotenv').config();
const mongoose = require('mongoose');

async function testMiddlewareLoading() {
  try {
    console.log('Testing middleware hierarchical assignment loading...');
    await mongoose.connect(process.env.MONGODB_BUDGET_URL);

    // Simulate what the middleware does
    const userId = '345220';
    const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');
    const assignment = await HierarchicalUserAssignment.findOne({ userId: userId });

    if (assignment) {
      console.log('Assignment found:', {
        userId: assignment.userId,
        userRole: assignment.userRole,
        divisionName: assignment.divisionName,
        departmentId: assignment.departmentId,
        regionId: assignment.regionId
      });

      // Test department lookup
      if (assignment.departmentId) {
        const Department = require('./models/Department');
        const dept = await Department.findById(assignment.departmentId);
        console.log('Department lookup result:', dept ? { Department: dept.Department } : 'Not found');
      }

      // Test region lookup
      if (assignment.regionId) {
        const Region = require('./models/Region');
        const region = await Region.findById(assignment.regionId);
        console.log('Region lookup result:', region ? { Region: region.Region } : 'Not found');
      }

      // Test proposal query
      const Proposal = require('./models/Proposal');

      // Simulate the filter building
      const userName = assignment.userName;
      const userDivision = assignment.divisionName;

      let userDepartment = null;
      let userRegion = null;

      if (assignment.departmentId) {
        const Department = require('./models/Department');
        const dept = await Department.findById(assignment.departmentId);
        userDepartment = dept ? dept.Department : null;
      }

      if (assignment.regionId) {
        const Region = require('./models/Region');
        const region = await Region.findById(assignment.regionId);
        userRegion = region ? region.Region : null;
      }

      console.log('Filter components:', {
        userId,
        userName,
        userDivision,
        userDepartment,
        userRegion
      });

      // Build the filter
      const visibilityFilter = {
        $or: [
          { createdByUserId: userId },
          { $or: [
            { processBy: userId },
            { processBy: userName }
          ]},
          ...(userDivision ? [{ division: userDivision }] : []),
          ...(userDepartment ? [{ department: userDepartment }] : []),
          ...(userRegion ? [{ region: userRegion }] : [])
        ]
      };

      console.log('Built visibility filter:', JSON.stringify(visibilityFilter, null, 2));

      // Test the query
      const proposals = await Proposal.find(visibilityFilter);
      console.log('Query result: Found', proposals.length, 'proposals');

      proposals.forEach((p, i) => {
        console.log('Matching proposal ' + (i+1) + ':', {
          _id: p._id,
          status: p.status,
          processBy: p.processBy,
          division: p.division,
          department: p.department,
          region: p.region
        });
      });

    } else {
      console.log('No assignment found for userId:', userId);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testMiddlewareLoading();