/**
 * Test Region user delete operation to debug the assignment issue
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testRegionDelete() {
  try {
    console.log('🧪 Testing Region user delete operation...\n');
    
    // Create JWT for our Region user (416461)
    const regionUserPayload = {
      Username: [416461, 'nelson.region@test.com'],
      userId: 416461,
      id: 416461,
      FirstName: 'Nelson',
      LastName: 'Eloso',
      Email: 'nelson.region@test.com',
      roles: ['REGION_USER']
    };
    
    const secretKey = '3e0dba935edc94b41f89f983639f3612f317bfec0e10e98a9bab4c0db5c4b249cef94b208262991a8cde8f38e2f6a7c8f565311c88688596548699e870c96a27';
    const token = jwt.sign(regionUserPayload, secretKey, { expiresIn: '1h' });
    
    console.log('✅ Created JWT for Region user (416461)');
    
    // First, get the current records to see which one we can try to delete
    console.log('\n1. Getting current overtime records...');
    const getResponse = await axios.get('http://localhost:5005/overtime-pay', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Current records visible to Region user: ${getResponse.data.data.length}`);
    
    if (getResponse.data.data.length > 0) {
      const recordToDelete = getResponse.data.data[0];
      console.log(`\n2. Attempting to delete: ${recordToDelete.employeeFullName}`);
      console.log(`   Record ID: ${recordToDelete._id}`);
      
      // Try to delete the record
      try {
        const deleteResponse = await axios.delete(`http://localhost:5005/overtime-pay/${recordToDelete._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Delete successful!');
        console.log(`Status: ${deleteResponse.status}`);
        console.log(`Response:`, deleteResponse.data);
        
      } catch (deleteError) {
        console.log('❌ Delete failed!');
        console.log(`Status: ${deleteError.response?.status}`);
        console.log(`Error:`, deleteError.response?.data);
        
        if (deleteError.response?.data?.message?.includes('organizational assignment')) {
          console.log('\n🔍 This is the assignment issue we need to fix!');
        }
      }
    } else {
      console.log('\n⚠️ No records visible to Region user for deletion test');
      
      // Let's try to delete a record we know exists (from database)
      const mongoose = require('mongoose');
      await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
      
      const db = mongoose.connection.db;
      const anyRecord = await db.collection('overtimepays').findOne({});
      
      if (anyRecord) {
        console.log(`\n3. Attempting to delete any record: ${anyRecord._id}`);
        
        try {
          const deleteResponse = await axios.delete(`http://localhost:5005/overtime-pay/${anyRecord._id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Delete successful!');
          
        } catch (deleteError) {
          console.log('❌ Delete failed!');
          console.log(`Status: ${deleteError.response?.status}`);
          console.log(`Error:`, deleteError.response?.data);
        }
      }
      
      await mongoose.connection.close();
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
  }
}

testRegionDelete();