/**
 * Simple script to test organization structure API without depending on User model
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

async function testOrganizationAPIWithToken() {
  console.log('🔄 Testing organization structure API with manually created token...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB');

    // Check if any users exist in any collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Available collections:');
    
    let userCollection = null;
    for (const collection of collections) {
      console.log('  📁', collection.name);
      if (collection.name.toLowerCase().includes('user') || collection.name.toLowerCase().includes('auth')) {
        userCollection = collection.name;
      }
    }
    
    if (userCollection) {
      console.log('\n👤 Found user-related collection:', userCollection);
      const users = await mongoose.connection.db.collection(userCollection).find({}).limit(1).toArray();
      if (users.length > 0) {
        console.log('📋 Sample user:', JSON.stringify(users[0], null, 2));
      }
    }

    // Create a test token manually with admin privileges
    const testPayload = {
      id: '507f1f77bcf86cd799439011', // dummy ObjectId
      username: 'test_admin',
      Roles: ['Admin', 'User'],
      email: 'admin@test.com'
    };

    const token = jwt.sign(
      testPayload,
      process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('\n🎫 Generated Test Token:');
    console.log(token);
    
    // Test the organization structure API with this token
    console.log('\n🧪 Testing API with token...');
    
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('\n📊 API Response:');
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    
    if (data.success && data.data) {
      console.log('\n🏢 Available Units:');
      console.log('Regions:', data.data.availableUnits?.regions?.length || 0);
      console.log('Departments:', data.data.availableUnits?.departments?.length || 0);
      console.log('Departments with Divisions:', data.data.availableUnits?.departmentsWithDivisions?.length || 0);
      console.log('Mappings:', data.data.mappings?.length || 0);
      
      if (data.data.availableUnits?.departmentsWithDivisions?.length > 0) {
        console.log('\n📂 Sample Departments with Divisions:');
        data.data.availableUnits.departmentsWithDivisions.slice(0, 2).forEach(dept => {
          console.log(`  🏬 ${dept.departmentName}: ${dept.divisions?.length || 0} divisions`);
        });
      }
    } else {
      console.log('Error details:', JSON.stringify(data, null, 2));
    }

    mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
}

testOrganizationAPIWithToken();
