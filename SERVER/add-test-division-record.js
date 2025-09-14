/**
 * Add a Division-level record from CENTRAL OFFICE with "Not Submitted" status
 * This should NOT be visible to Region users
 */
const mongoose = require('mongoose');

async function addTestRecord() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Add a Division-level record that should be filtered out
    const testRecord = {
      employeeFullName: 'Test Employee Division',
      region: 'CENTRAL OFFICE', // Same region as our test Region user
      department: 'TEST DEPARTMENT',
      division: 'TEST DIVISION',
      status: 'Not Submitted', // This should make it invisible to Region users
      originalLevel: 'DIVISION',
      positionTitle: 'Test Position',
      weekdayHours: 10,
      weekendHours: 5,
      totalAmount: 5000,
      fiscalYear: '2025',
      budgetType: 'Regular',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('overtimepays').insertOne(testRecord);
    
    console.log('✅ Test record added:', result.insertedId);
    console.log('Record details:');
    console.log(`Employee: ${testRecord.employeeFullName}`);
    console.log(`Region: ${testRecord.region}`);
    console.log(`Department: ${testRecord.department}`);
    console.log(`Division: ${testRecord.division}`);
    console.log(`Status: ${testRecord.status}`);
    
    // Now check current total records
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    console.log(`\n📊 Total overtime records now: ${allRecords.length}`);
    
    // Show all records
    allRecords.forEach((record, i) => {
      console.log(`${i+1}. ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}, Dept: ${record.department || 'N/A'}, Div: ${record.division || 'N/A'}`);
      console.log(`   Status: ${record.status || 'N/A'}, Level: ${record.originalLevel || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

addTestRecord();