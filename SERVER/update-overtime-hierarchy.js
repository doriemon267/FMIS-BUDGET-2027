/**
 * Script to properly set hierarchical data for overtime records
 */
const mongoose = require('mongoose');
const OvertimePay = require('./models/overtimePay');

async function connectToDatabase() {
  try {
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
}

async function updateOvertimeRecords() {
  try {
    console.log('🔧 Setting proper hierarchical data for overtime records...');
    
    // Update all records processed by Frances Joshua Demafelez (Division user)
    const result = await OvertimePay.updateMany(
      { 
        processBy: 'Frances Joshua Demafelez'
      },
      { 
        $set: {
          region: 'REGION I',
          department: 'CORPORATE PLANNING SERVICES',
          division: 'MANAGEMENT INFORMATION DIVISION'
        }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} records`);
    
    // Check updated records
    const updatedRecords = await OvertimePay.find({
      processBy: 'Frances Joshua Demafelez'
    }).lean();
    
    console.log('\n📋 Updated records:');
    updatedRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.employeeFullName}`);
      console.log(`   Region: ${record.region}`);
      console.log(`   Department: ${record.department}`);
      console.log(`   Division: ${record.division}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error updating records:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await updateOvertimeRecords();
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

main();