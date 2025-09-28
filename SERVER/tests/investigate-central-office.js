/**
 * Investigate the CENTRAL OFFICE record issue
 */
const mongoose = require('mongoose');

async function investigateCentralOfficeRecord() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get all CENTRAL OFFICE records
    const centralOfficeRecords = await db.collection('overtimepays').find({ region: 'CENTRAL OFFICE' }).toArray();
    
    console.log(`📋 CENTRAL OFFICE records: ${centralOfficeRecords.length}`);
    
    centralOfficeRecords.forEach((record, i) => {
      console.log(`\n=== Record ${i+1} ===`);
      console.log(`Employee: ${record.employeeFullName}`);
      console.log(`Region: ${record.region}`);
      console.log(`Department: ${record.department || 'N/A'}`);
      console.log(`Division: ${record.division || 'N/A'}`);
      console.log(`Status: ${record.status || 'N/A'}`);
      console.log(`Original Level: ${record.originalLevel || 'N/A'}`);
      console.log(`Created At: ${record.createdAt}`);
      console.log(`Record ID: ${record._id}`);
      
      // Check if this record should be visible to Region users
      const hasNoSubLevel = (!record.department || record.department === 'N/A' || record.department === '') &&
                           (!record.division || record.division === 'N/A' || record.division === '');
      
      console.log(`Should be visible to Region user: ${hasNoSubLevel ? 'YES (pure region data)' : 'NO (has department/division)'}`);
    });
    
    // The issue: Need to fix the record that has department/division but no proper status
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

investigateCentralOfficeRecord();