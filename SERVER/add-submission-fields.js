/**
 * Add submission workflow fields to overtime record
 */
const mongoose = require('mongoose');

async function main() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Update the overtime record to have proper submission workflow fields
    const result = await db.collection('overtimepays').updateOne(
      { processBy: 'Frances Joshua Demafelez' },
      { 
        $set: {
          status: 'Not Submitted',          // Division level data not yet submitted
          originalLevel: 'DIVISION',       // Created by Division level user
          submissionWorkflow: {
            currentLevel: 'DIVISION',
            isSubmitted: false,
            submittedAt: null,
            submittedBy: null
          }
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} records`);
    
    // Check the updated record
    const updatedRecord = await db.collection('overtimepays').findOne({
      processBy: 'Frances Joshua Demafelez'
    });
    
    console.log('\n📋 Updated record:');
    console.log({
      employeeFullName: updatedRecord.employeeFullName,
      region: updatedRecord.region,
      department: updatedRecord.department,
      division: updatedRecord.division,
      status: updatedRecord.status,
      originalLevel: updatedRecord.originalLevel,
      processBy: updatedRecord.processBy
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();