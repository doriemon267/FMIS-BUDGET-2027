/**
 * Test creating overtime with proper department/division fields
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testOvertimeCreation() {
  try {
    console.log('🧪 Testing overtime creation with Department/Division fields...\n');
    
    // Create JWT for Division user (345220) since they're already working
    const divisionUserPayload = {
      Username: [345220, 'division.user@test.com'],
      userId: 345220,
      id: 345220,
      FirstName: 'Test',
      LastName: 'Division',
      Email: 'division.user@test.com',
      roles: ['DIVISION_USER']
    };
    
    const secretKey = '3e0dba935edc94b41f89f983639f3612f317bfec0e10e98a9bab4c0db5c4b249cef94b208262991a8cde8f38e2f6a7c8f565311c88688596548699e870c96a27';
    const token = jwt.sign(divisionUserPayload, secretKey, { expiresIn: '1h' });
    
    console.log('✅ Created JWT for Division user');
    
    // Create overtime record
    const overtimeData = {
      employeeFullName: "Test Employee Division Level",
      positionTitle: "Computer Programmer III",
      weekdayHours: 20,
      weekendHours: 10,
      processBy: "Test Division User",
      processDate: new Date(),
      fiscalYear: "2026",
      budgetType: "Initial",
      monthlySalary: 46725
    };
    
    console.log('\n📝 Creating overtime record...');
    const response = await axios.post('http://localhost:5005/overtime-pay', overtimeData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Overtime created successfully!`);
    console.log(`Status: ${response.status}`);
    console.log(`Message: ${response.data.message}`);
    
    // Now check the database to see if department/division were saved
    console.log('\n🔍 Checking database record...');
    
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    
    const db = mongoose.connection.db;
    const createdRecord = await db.collection('overtimepays').findOne({
      employeeFullName: "Test Employee Division Level"
    });
    
    if (createdRecord) {
      console.log('\n📋 Created Record:');
      console.log(`Employee: ${createdRecord.employeeFullName}`);
      console.log(`Region: ${createdRecord.region || 'N/A'}`);
      console.log(`Department: ${createdRecord.department || 'N/A'}`);
      console.log(`Division: ${createdRecord.division || 'N/A'}`);
      console.log(`Status: ${createdRecord.status || 'N/A'}`);
      console.log(`Original Level: ${createdRecord.originalLevel || 'N/A'}`);
      
      if (createdRecord.department && createdRecord.division) {
        console.log('\n✅ SUCCESS: Department and Division fields are now being saved!');
      } else {
        console.log('\n❌ STILL MISSING: Department and/or Division fields not saved');
      }
    } else {
      console.log('❌ Record not found in database');
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testOvertimeCreation();