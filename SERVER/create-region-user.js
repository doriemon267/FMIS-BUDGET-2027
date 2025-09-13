// Script to create a Region level user for testing hierarchical access control
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

// Connect to the correct MongoDB instance
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URL || 'mongodb://172.16.4.98:27017/fmis_budget';
    console.log('🔌 Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function createRegionLevelUser() {
  try {
    console.log('👤 Creating Region Level User for Testing\n');

    // Check if Region level user already exists
    const existingRegionUser = await HierarchicalUserAssignment.findOne({
      assignmentLevel: 'REGION',
      'regions.regionName': 'CENTRAL OFFICE' // Using existing region from sample data
    });

    if (existingRegionUser) {
      console.log('✅ Region level user already exists:');
      console.log('   User ID:', existingRegionUser.userId);
      console.log('   Region:', existingRegionUser.regions[0]?.regionName);
      console.log('   Assignment Level:', existingRegionUser.assignmentLevel);
      return existingRegionUser;
    }

    // Create new Region level user
    const regionUser = new HierarchicalUserAssignment({
      userId: 'region_admin_test',
      assignmentLevel: 'REGION',
      regions: [{
        regionName: 'CENTRAL OFFICE',
        regionCode: 'CO'
      }],
      departments: [], // Empty for Region level
      divisions: [], // Empty for Region level
      rolePermissions: {
        canCreateProposals: true,
        canEditOwnProposals: true,
        canEditAllProposals: true,
        canDeleteProposals: true,
        canApproveSubmissions: true,
        canViewAllRegions: false, // Only their assigned region
        canViewAllDepartments: true, // All departments in their region
        canViewAllDivisions: true // All divisions in their region
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await regionUser.save();
    console.log('✅ Region level user created successfully:');
    console.log('   User ID:', regionUser.userId);
    console.log('   Region:', regionUser.regions[0]?.regionName);
    console.log('   Assignment Level:', regionUser.assignmentLevel);
    console.log('   Permissions: Full access within CENTRAL OFFICE region');

    return regionUser;

  } catch (error) {
    console.error('❌ Failed to create Region level user:', error);
    throw error;
  }
}

async function testRegionUserAccess() {
  try {
    console.log('\n🧪 Testing Region Level User Access\n');

    const PersonnelServices = require('./models/personnelServices');

    // Test the access filters
    console.log('Testing Region Level Access Filters:');

    // 1. Standard hierarchical access
    const standardFilter = {
      region: 'CENTRAL OFFICE'
    };

    const standardResults = await PersonnelServices.find(standardFilter).lean();
    console.log(`✅ Standard access: ${standardResults.length} records from CENTRAL OFFICE`);
    standardResults.forEach(record => {
      console.log(`   - ${record.employeeNumber} (${record.region}/${record.department}/${record.division})`);
    });

    // 2. Submission workflow access (if status field exists)
    const submissionFilter = {
      $and: [
        { region: 'CENTRAL OFFICE' },
        {
          $or: [
            // Region-level data
            {
              $and: [
                { region: 'CENTRAL OFFICE' },
                { $or: [{ department: { $exists: false } }, { department: null }, { department: "" }] }
              ]
            },
            // Department/Division data with submitted status
            {
              $and: [
                { $or: [
                  { department: { $exists: true, $ne: null, $ne: "" } },
                  { division: { $exists: true, $ne: null, $ne: "" } }
                ] },
                { region: 'CENTRAL OFFICE' },
                {
                  $or: [
                    { status: 'Submitted' },
                    { status: 'Approved' },
                    { status: 'Initial' } // Include existing status
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const submissionResults = await PersonnelServices.find(submissionFilter).lean();
    console.log(`✅ Submission workflow access: ${submissionResults.length} records`);
    submissionResults.forEach(record => {
      console.log(`   - ${record.employeeNumber} (Status: ${record.status || 'N/A'})`);
    });

  } catch (error) {
    console.error('❌ Access test failed:', error);
  }
}

// Run the script
async function main() {
  await connectDB();

  try {
    const regionUser = await createRegionLevelUser();
    await testRegionUserAccess();

    console.log('\n🎯 Region Level User Setup Complete!');
    console.log('The user can now access all personnel data within the CENTRAL OFFICE region.');
    console.log('This demonstrates the top-level access that Region users have in the hierarchy.');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

main().catch(console.error);