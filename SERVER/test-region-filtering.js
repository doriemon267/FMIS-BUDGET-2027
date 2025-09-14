/**
 * Test submission workflow filtering
 */
const mongoose = require('mongoose');
const HierarchicalUserAssignment = require('./models/HierarchicalUserAssignment');

async function simulateRegionFiltering() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    // Get the region user assignment (should be Nelson/Budget Analyst)
    const regionAssignment = await HierarchicalUserAssignment.findOne({
      assignmentLevel: 'REGION'
    }).populate('regionId').lean();
    
    if (!regionAssignment) {
      console.log('❌ No REGION level assignment found');
      return;
    }
    
    console.log('🔍 Region Assignment:', {
      userId: regionAssignment.userId,
      level: regionAssignment.assignmentLevel,
      regionName: regionAssignment.regionId?.Region || regionAssignment.regionId?.regionName
    });
    
    // Simulate the filtering logic from the middleware
    const regionName = regionAssignment.regionId?.Region || regionAssignment.regionId?.regionName;
    
    // This is the filter that should be applied for Region users
    const submissionFilters = {
      $and: [
        { region: regionName },
        {
          $or: [
            // Own region-level data (no department/division specified, any status)
            { 
              $and: [
                { region: regionName },
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
                { region: regionName },
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
    
    console.log('\n🎯 Expected Submission Filter:');
    console.log(JSON.stringify(submissionFilters, null, 2));
    
    // Test the filter against actual data
    const db = mongoose.connection.db;
    
    console.log('\n📋 Current overtime records:');
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    allRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}`);
      console.log(`   Department: ${record.department}`);
      console.log(`   Division: ${record.division}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Original Level: ${record.originalLevel}`);
      console.log('');
    });
    
    // Test the filter
    console.log('🧪 Testing filter against data...');
    const filteredRecords = await db.collection('overtimepays').find(submissionFilters).toArray();
    
    console.log(`\n📊 Filter Results: ${filteredRecords.length} records found`);
    filteredRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName} - Status: ${record.status}`);
    });
    
    // Explanation
    console.log('\n💡 Analysis:');
    const currentRecord = allRecords[0];
    if (currentRecord) {
      console.log(`Record has:`);
      console.log(`- Region: ${currentRecord.region} (matches filter: ${currentRecord.region === regionName})`);
      console.log(`- Department: ${currentRecord.department} (has department: ${!!currentRecord.department})`);
      console.log(`- Division: ${currentRecord.division} (has division: ${!!currentRecord.division})`);
      console.log(`- Status: ${currentRecord.status} (is submitted: ${['Submitted', 'Approved'].includes(currentRecord.status)})`);
      
      if (currentRecord.department && currentRecord.status !== 'Submitted' && currentRecord.status !== 'Approved') {
        console.log('\n❌ This record should NOT be visible to Region users!');
        console.log('   Reason: Has department/division but status is not Submitted/Approved');
      } else {
        console.log('\n✅ This record should be visible to Region users');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

simulateRegionFiltering();