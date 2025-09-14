// Check database for sample data structure
const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabaseData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check OvertimePay collection structure
    const OvertimePay = require('./models/overtimePay');
    
    console.log('\n🔍 Checking OvertimePay collection...');
    
    // Get a few sample records to see data structure
    const sampleRecords = await OvertimePay.find({}).limit(3).lean();
    
    if (sampleRecords.length === 0) {
      console.log('❌ No records found in OvertimePay collection');
    } else {
      console.log(`✅ Found ${sampleRecords.length} sample records:`);
      sampleRecords.forEach((record, index) => {
        console.log(`\n📄 Record ${index + 1}:`);
        console.log('- Region:', record.region);
        console.log('- Department:', record.department); 
        console.log('- Division:', record.division);
        console.log('- Employee:', record.employeeFullName);
        console.log('- Status:', record.status);
        console.log('- Fiscal Year:', record.fiscalYear);
      });
    }

    // Check for CORPORATE PLANNING SERVICES department specifically
    console.log('\n🎯 Checking for CORPORATE PLANNING SERVICES department...');
    const corpPlanningRecords = await OvertimePay.find({ 
      department: 'CORPORATE PLANNING SERVICES' 
    }).lean();
    
    console.log(`Found ${corpPlanningRecords.length} records for CORPORATE PLANNING SERVICES`);
    
    if (corpPlanningRecords.length > 0) {
      console.log('Sample CORPORATE PLANNING SERVICES record:');
      console.log(corpPlanningRecords[0]);
    }

    // Check all departments in CENTRAL OFFICE
    console.log('\n🏢 All departments in CENTRAL OFFICE:');
    const departments = await OvertimePay.distinct('department', { region: 'CENTRAL OFFICE' });
    console.log(departments);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Database check error:', error);
    await mongoose.disconnect();
  }
}

checkDatabaseData();