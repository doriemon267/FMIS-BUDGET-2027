/**
 * Check user and test API
 */
const axios = require('axios');

async function checkUser() {
  try {
    // Try with a known working user first
    console.log('🔍 Testing with a different Region user...');
    
    // Let's check what users exist with a simple database query
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://172.16.4.98:27017/fmis_budget');
    
    const db = mongoose.connection.db;
    
    // Check for users with REGION assignment
    const regionUsers = await db.collection('hierarchicaluserassignments').find({
      assignmentLevel: 'REGION'
    }).toArray();
    
    console.log(`Found ${regionUsers.length} Region users:`);
    regionUsers.forEach((user, i) => {
      console.log(`${i+1}. User ID: ${user.userId}`);
      console.log(`   Regions: ${user.regions?.map(r => r.regionName).join(', ')}`);
    });
    
    // Get user details
    if (regionUsers.length > 0) {
      const userId = regionUsers[0].userId;
      const userDetails = await db.collection('users').findOne({ _id: userId });
      
      if (userDetails) {
        console.log('\n📋 Region user details:');
        console.log(`Email: ${userDetails.Email}`);
        console.log(`Name: ${userDetails.FirstName} ${userDetails.LastName}`);
        
        // Now try API test with this user
        console.log('\n🧪 Testing API with this user...');
        const loginResponse = await axios.post('http://localhost:5005/api/auth/login', {
          email: userDetails.Email,
          password: 'MITnmv2025!'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        const response = await axios.get('http://localhost:5005/api/overtime/overtime-pay', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`\n📊 API Response: ${response.data.totalRecords} records`);
        if (response.data.data.length > 0) {
          console.log('❌ Region user can see data - checking what...');
          response.data.data.forEach(record => {
            console.log(`- ${record.employeeFullName}: Status=${record.status}`);
          });
        } else {
          console.log('✅ Region user sees no data - correct!');
        }
      }
    }
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkUser();