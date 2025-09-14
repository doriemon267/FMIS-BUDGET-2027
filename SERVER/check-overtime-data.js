/**
 * Check what data is currently in overtime collection
 */
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check all overtime records
    const allRecords = await db.collection('overtimepays').find({}).toArray();
    
    console.log('\n📊 Current Overtime Records:');
    console.log(`Total records: ${allRecords.length}`);
    
    allRecords.forEach((record, i) => {
      console.log(`\n${i+1}. Employee: ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}`);
      console.log(`   Department: ${record.department}`);
      console.log(`   Division: ${record.division}`);
      console.log(`   Status: ${record.Status || 'N/A'}`);
      console.log(`   OriginalLevel: ${record.originalLevel || 'N/A'}`);
      console.log(`   ProcessBy: ${record.processBy}`);
      console.log(`   Created: ${record.createdAt}`);
    });
    
    // Check by division filtering
    console.log('\n🔍 Records with division:');
    const divisionRecords = await db.collection('overtimepays').find({
      division: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    console.log(`Found: ${divisionRecords.length} records`);
    
    // Check by region filtering
    console.log('\n🔍 Records by region:');
    const regionCounts = await db.collection('overtimepays').aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } }
    ]).toArray();
    regionCounts.forEach(r => {
      console.log(`${r._id}: ${r.count} records`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();