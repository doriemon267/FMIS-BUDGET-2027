// Test script to verify submission workflow is working
// This should be run from the SERVER directory: node test-submission-workflow.js

const PersonnelServices = require('./models/personnelServices');
const mongoose = require('mongoose');

async function testSubmissionWorkflow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://172.16.4.98:27017/fmis_budget_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔍 Testing Submission Workflow Filtering...\n');

    // Test 1: Check if personnel data has originalLevel and status fields
    const samplePersonnel = await PersonnelServices.findOne({}).lean();
    console.log('📋 Sample Personnel Record Structure:');
    console.log('- Has originalLevel:', samplePersonnel?.originalLevel !== undefined ? '✅' : '❌');
    console.log('- Has status:', samplePersonnel?.status !== undefined ? '✅' : '❌');
    console.log('- Has region:', samplePersonnel?.region !== undefined ? '✅' : '❌');
    console.log('- Has department:', samplePersonnel?.department !== undefined ? '✅' : '❌');
    console.log('- Has division:', samplePersonnel?.division !== undefined ? '✅' : '❌');
    
    if (samplePersonnel) {
      console.log('\n📊 Sample Record:');
      console.log(`- Employee: ${samplePersonnel.employeeFullName || 'N/A'}`);
      console.log(`- Region: ${samplePersonnel.region || 'N/A'}`);
      console.log(`- Department: ${samplePersonnel.department || 'N/A'}`);
      console.log(`- Division: ${samplePersonnel.division || 'N/A'}`);
      console.log(`- Original Level: ${samplePersonnel.originalLevel || 'N/A'}`);
      console.log(`- Status: ${samplePersonnel.status || 'N/A'}`);
    }

    // Test 2: Count data by status and original level
    console.log('\n📈 Data Distribution by Status:');
    const statusCounts = await PersonnelServices.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    statusCounts.forEach(status => {
      console.log(`- ${status._id || 'No Status'}: ${status.count} records`);
    });

    console.log('\n📈 Data Distribution by Original Level:');
    const levelCounts = await PersonnelServices.aggregate([
      {
        $group: {
          _id: '$originalLevel',
          count: { $sum: 1 }
        }
      }
    ]);
    levelCounts.forEach(level => {
      console.log(`- ${level._id || 'No Original Level'}: ${level.count} records`);
    });

    // Test 3: Simulate department user filtering
    console.log('\n🏢 Simulating Department User Query:');
    const departmentQuery = {
      $and: [
        { fiscalYear: 2025 },
        { region: 'CENTRAL OFFICE' },
        { department: 'CORPORATE PLANNING SERVICES' },
        {
          $or: [
            { originalLevel: 'DEPARTMENT' },
            { 
              $and: [
                { originalLevel: 'DIVISION' },
                { status: { $in: ['Submitted', 'Approved'] } }
              ]
            }
          ]
        }
      ]
    };
    
    const departmentResults = await PersonnelServices.find(departmentQuery).lean();
    console.log(`- Department user should see: ${departmentResults.length} records`);
    
    // Break down by original level
    const deptLevelBreakdown = departmentResults.reduce((acc, record) => {
      const level = record.originalLevel || 'No Level';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(deptLevelBreakdown).forEach(([level, count]) => {
      console.log(`  - ${level}: ${count} records`);
    });

    // Test 4: Simulate division user filtering
    console.log('\n📂 Simulating Division User Query:');
    const divisionQuery = {
      fiscalYear: 2025,
      region: 'CENTRAL OFFICE',
      department: 'CORPORATE PLANNING SERVICES',
      division: 'MANAGEMENT INFORMATION DIVISION'
    };
    
    const divisionResults = await PersonnelServices.find(divisionQuery).lean();
    console.log(`- Division user should see: ${divisionResults.length} records`);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testSubmissionWorkflow();
