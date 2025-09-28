/**
 * Direct database update script
 */
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Direct update using MongoDB driver
    const result = await db.collection('overtimepays').updateMany(
      { processBy: 'Frances Joshua Demafelez' },
      { 
        $set: {
          region: 'REGION I',
          department: 'CORPORATE PLANNING SERVICES',
          division: 'MANAGEMENT INFORMATION DIVISION'
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} documents`);
    
    // Check the updated document
    const updated = await db.collection('overtimepays').findOne({
      processBy: 'Frances Joshua Demafelez'
    });
    
    console.log('\n📋 Updated document:');
    console.log(JSON.stringify({
      employeeFullName: updated.employeeFullName,
      region: updated.region,
      department: updated.department,
      division: updated.division,
      processBy: updated.processBy
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();