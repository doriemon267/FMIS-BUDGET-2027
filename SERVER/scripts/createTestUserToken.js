/**
 * Create a test user and get authentication token for testing organization structure API
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Load models
const User = require('../models/User');

async function createTestUserAndToken() {
  console.log('🔄 Getting existing user for authentication token...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find any existing admin user
    let testUser = await User.findOne({ Roles: { $in: ['Admin'] } });
    
    if (!testUser) {
      // If no admin user exists, find any user
      testUser = await User.findOne({});
      
      if (!testUser) {
        console.log('❌ No users found in database. Please create a user first.');
        mongoose.connection.close();
        return;
      }
      
      console.log('✅ Found existing user (not admin):', testUser.username);
    } else {
      console.log('✅ Found existing admin user:', testUser.username);
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: testUser._id,
        username: testUser.username,
        Roles: testUser.Roles
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('\n🎫 Authentication Token:');
    console.log(token);
    
    console.log('\n📋 Test User Info:');
    console.log('Username:', testUser.username);
    console.log('Roles:', testUser.Roles);
    console.log('ID:', testUser._id);

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
    console.log('Available Units:', JSON.stringify(data.data?.availableUnits, null, 2));

    mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
}

createTestUserAndToken();
