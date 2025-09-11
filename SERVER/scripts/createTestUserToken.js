/**
 * Create a test user and get authentication token for testing organization structure API
 */
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();
// Load models
const User = require('../models/User');
async function createTestUserAndToken() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // Find any existing admin user
    let testUser = await User.findOne({ Roles: { $in: ['Admin'] } });
    if (!testUser) {
      // If no admin user exists, find any user
      testUser = await User.findOne({});
      if (!testUser) {
        mongoose.connection.close();
        return;
      }
      :', testUser.username);
    } else {
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
    // Test the organization structure API with this token
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    );
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
}
createTestUserAndToken();