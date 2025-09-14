/**
 * Comprehensive test for Region user CRUD operations
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testRegionUserCRUD() {
  try {
    console.log('🧪 Comprehensive Region User CRUD Test\n');
    
    // Create JWT for Region user
    const regionUserData = {
      id: 416461,
      FirstName: "Nelson",
      LastName: "Eloso", 
      roles: ["EMPLOYEE"]
    };
    
    const token = jwt.sign(regionUserData, '3e0dba935edc94b41f89f983639f3612f317bfec0e10e98a9bab4c0db5c4b249cef94b208262991a8cde8f38e2f6a7c8f565311c88688596548699e870c96a27', { expiresIn: '1h' });
    console.log('✅ Created JWT for Region user (416461)\n');
    
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    
    // 1. READ - Test getting records
    console.log('1️⃣ Testing READ operation...');
    const readResponse = await axios.get('http://localhost:5005/overtime-pay', config);
    console.log(`📊 Can read ${readResponse.data?.length || 'unknown'} overtime records`);
    
    // 2. CREATE - Test creating new record
    console.log('\n2️⃣ Testing CREATE operation...');
    const newRecord = {
      employeeFullName: "Test Region Employee CRUD",
      fiscalYear: "2024",
      positionTitle: "Region Test Position",
      weekdayHours: 10,
      weekendHours: 5,
      monthlySalary: 50000,
      region: "CENTRAL OFFICE",
      department: "BUDGET",
      division: null,
      status: "Draft"
    };
    
    const createResponse = await axios.post('http://localhost:5005/overtime-pay', newRecord, config);
    console.log('✅ CREATE successful');
    console.log(`📝 Created record ID: ${createResponse.data.data._id}`);
    const createdId = createResponse.data.data._id;
    
    // 3. UPDATE - Test updating the record
    console.log('\n3️⃣ Testing UPDATE operation...');
    const updateData = {
      ...newRecord,
      weekdayHours: 15,
      amount: 1500
    };
    
    const updateResponse = await axios.put(`http://localhost:5005/overtime-pay/${createdId}`, updateData, config);
    console.log('✅ UPDATE successful');
    console.log(`📝 Updated weekday hours to: ${updateData.weekdayHours}`);
    
    // 4. DELETE - Test deleting the record
    console.log('\n4️⃣ Testing DELETE operation...');
    const deleteResponse = await axios.delete(`http://localhost:5005/overtime-pay/${createdId}`, config);
    console.log('✅ DELETE successful');
    console.log('📝 Record deleted and synced');
    
    console.log('\n🎉 All CRUD operations successful for Region user!');
    console.log('\n📋 Summary:');
    console.log('   ✅ READ: Can view region-level data');
    console.log('   ✅ CREATE: Can create new overtime records'); 
    console.log('   ✅ UPDATE: Can modify existing records');
    console.log('   ✅ DELETE: Can delete records');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.status || 'Error');
    if (error.response?.data) {
      console.error('   Error details:', error.response.data);
    } else {
      console.error('   Error message:', error.message);
    }
  }
}

testRegionUserCRUD();