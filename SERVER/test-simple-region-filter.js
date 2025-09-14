/**
 * Test Region filtering without populate
 */
const mongoose = require('mongoose');

async function testRegionFiltering() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check current assignment (we know it's REGION level from before)
    // Region name should be "CENTRAL OFFICE" based on earlier tests
    const regionName = 'CENTRAL OFFICE';
    
    console.log(`🔍 Testing Region filtering for: ${regionName}`);
    
    // This is the EXACT filter from submission workflow middleware for REGION users
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
    
    console.log('\n🎯 Region Filter (should filter OUT "Not Submitted" division data):');
    console.log(JSON.stringify(submissionFilters, null, 2));
    
    // Check current data
    console.log('\n📋 Current overtime records:');
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    allRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}`);
      console.log(`   Department: ${record.department || 'N/A'}`);
      console.log(`   Division: ${record.division || 'N/A'}`);
      console.log(`   Status: ${record.status || 'N/A'}`);
      console.log(`   Original Level: ${record.originalLevel || 'N/A'}`);
      console.log('');
    });
    
    // Apply the Region filter
    console.log('🧪 Applying Region filter...');
    const regionFilteredRecords = await db.collection('overtimepays').find(submissionFilters).toArray();
    
    console.log(`\n📊 Region Filter Results: ${regionFilteredRecords.length} records`);
    if (regionFilteredRecords.length > 0) {
      regionFilteredRecords.forEach((record, i) => {
        console.log(`${i+1}. ${record.employeeFullName} - Status: ${record.status}`);
      });
      console.log('\n❌ PROBLEM: Region user should NOT see this data!');
      console.log('The record has department/division but status is "Not Submitted"');
    } else {
      console.log('✅ CORRECT: No records returned for Region user');
    }
    
    // Also test simple region filter (what might be happening)
    console.log('\n🧪 Testing simple region filter (incorrect behavior):');
    const simpleFilter = { region: regionName };
    const simpleResults = await db.collection('overtimepays').find(simpleFilter).toArray();
    
    console.log(`Simple filter results: ${simpleResults.length} records`);
    if (simpleResults.length > 0) {
      console.log('❌ This might be what\'s happening - only region filtering, no status check');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testRegionFiltering();