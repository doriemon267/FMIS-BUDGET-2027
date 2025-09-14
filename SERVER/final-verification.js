/**
 * Check what happened to original records and test submission workflow
 */
const mongoose = require('mongoose');

async function finalVerification() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Look for all records with "John Rey Solivares"
    console.log('🔍 Checking for John Rey Solivares records...');
    const johnRecords = await db.collection('overtimepays').find({
      employeeFullName: { $regex: 'John Rey Solivares', $options: 'i' }
    }).toArray();
    
    console.log(`Found ${johnRecords.length} records for John Rey Solivares:`);
    johnRecords.forEach((record, i) => {
      console.log(`${i+1}. Region: ${record.region}, Dept: ${record.department || 'N/A'}, Status: ${record.status || 'N/A'}`);
    });
    
    // Create a test pure region record to verify filtering
    console.log('\n🧪 Creating pure region test record...');
    
    const pureRegionRecord = {
      employeeFullName: "Pure Region Test Employee",
      positionTitle: "Test Position",
      weekdayHours: 10,
      weekendHours: 5,
      amount: 15000,
      fiscalYear: "2026",
      budgetType: "Initial",
      processBy: "Test User",
      processDate: new Date(),
      monthlySalary: 30000,
      region: "CENTRAL OFFICE",
      // No department, division - pure region data
      status: "Draft", // Status shouldn't matter for pure region data
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('overtimepays').insertOne(pureRegionRecord);
    console.log('✅ Pure region record created');
    
    // Test the filter again
    console.log('\n🧪 Testing Region filter with pure region record...');
    
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
    
    const filteredRecords = await db.collection('overtimepays').find(submissionFilters).toArray();
    
    console.log(`📊 Region filter results: ${filteredRecords.length} records`);
    filteredRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName} - Dept: ${record.department || 'N/A'} - Status: ${record.status || 'N/A'}`);
    });
    
    if (filteredRecords.length > 0) {
      console.log('\n✅ SUCCESS: Region users can see pure region data!');
    } else {
      console.log('\n❌ Issue: Region users cannot see even pure region data');
    }
    
    // Also test what happens if we change the Division record to Submitted
    console.log('\n🧪 Testing: What if Division record is submitted?');
    
    await db.collection('overtimepays').updateOne(
      { employeeFullName: "Test Employee Division Level" },
      { $set: { status: "Submitted" } }
    );
    
    const submittedFilterResults = await db.collection('overtimepays').find(submissionFilters).toArray();
    console.log(`After changing Division record to Submitted: ${submittedFilterResults.length} records`);
    submittedFilterResults.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName} - Status: ${record.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

finalVerification();