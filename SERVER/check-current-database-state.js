/**
 * Check current database state after overtime creation
 */
const mongoose = require('mongoose');

async function checkCurrentDatabaseState() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get all overtime records
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    
    console.log(`📊 Current Overtime Records: ${allRecords.length}`);
    
    allRecords.forEach((record, i) => {
      console.log(`\n${i+1}. Employee: ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}`);
      console.log(`   Department: ${record.department || 'N/A'}`);
      console.log(`   Division: ${record.division || 'N/A'}`);
      console.log(`   Status: ${record.status || 'N/A'}`);
      console.log(`   Original Level: ${record.originalLevel || 'N/A'}`);
      console.log(`   Created: ${record.createdAt}`);
      
      // Analyze what a CENTRAL OFFICE Region user should see
      const isFromCentralOffice = record.region === 'CENTRAL OFFICE';
      const hasSubLevels = (record.department && record.department !== 'N/A') || 
                          (record.division && record.division !== 'N/A');
      const isSubmitted = record.status === 'Submitted' || record.status === 'Approved';
      
      console.log(`   For CENTRAL OFFICE Region user:`);
      console.log(`   - Same region: ${isFromCentralOffice ? 'YES' : 'NO'}`);
      console.log(`   - Has dept/div: ${hasSubLevels ? 'YES' : 'NO'}`);
      console.log(`   - Is submitted: ${isSubmitted ? 'YES' : 'NO'}`);
      
      if (isFromCentralOffice) {
        if (!hasSubLevels) {
          console.log(`   ✅ SHOULD BE VISIBLE: Pure region data`);
        } else if (isSubmitted) {
          console.log(`   ✅ SHOULD BE VISIBLE: Has dept/div but submitted`);
        } else {
          console.log(`   ❌ SHOULD BE HIDDEN: Has dept/div but NOT submitted`);
        }
      } else {
        console.log(`   ❌ SHOULD BE HIDDEN: Different region`);
      }
    });
    
    // Test the exact filter that should be applied
    console.log('\n\n🧪 Testing CENTRAL OFFICE Region filter...');
    
    const regionName = 'CENTRAL OFFICE';
    const submissionFilters = {
      $and: [
        { region: regionName },
        {
          $or: [
            // Own region-level data (no department/division specified, any status)
            { 
              $and: [
                { region: regionName },
                { $or: [
                  { department: { $exists: false } }, 
                  { department: null }, 
                  { department: "" },
                  { department: "N/A" }
                ] }
              ]
            },
            // Submitted department/division data within their region
            { 
              $and: [
                { $or: [
                  { department: { $exists: true, $ne: null, $ne: "", $ne: "N/A" } },
                  { division: { $exists: true, $ne: null, $ne: "", $ne: "N/A" } }
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
    
    console.log('Filter being applied:');
    console.log(JSON.stringify(submissionFilters, null, 2));
    
    const filteredRecords = await db.collection('overtimepays').find(submissionFilters).toArray();
    
    console.log(`\n📊 Filter Results: ${filteredRecords.length} records`);
    filteredRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName} - Status: ${record.status || 'N/A'}`);
    });
    
    if (filteredRecords.length === 0) {
      console.log('\n🤔 Why no results? Let me check each condition...');
      
      // Test just region filter
      const regionOnly = await db.collection('overtimepays').find({ region: regionName }).toArray();
      console.log(`\nRegion only filter: ${regionOnly.length} records`);
      
      // Test pure region data filter
      const pureRegionFilter = {
        $and: [
          { region: regionName },
          { $or: [
            { department: { $exists: false } }, 
            { department: null }, 
            { department: "" },
            { department: "N/A" }
          ] }
        ]
      };
      
      const pureRegionResults = await db.collection('overtimepays').find(pureRegionFilter).toArray();
      console.log(`Pure region data filter: ${pureRegionResults.length} records`);
      
      if (pureRegionResults.length > 0) {
        pureRegionResults.forEach(record => {
          console.log(`- ${record.employeeFullName}: dept=${record.department}, div=${record.division}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkCurrentDatabaseState();