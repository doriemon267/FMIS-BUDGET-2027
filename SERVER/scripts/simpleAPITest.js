/**
 * Simple script to test organization structure API without depending on User model
 */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();
async function testOrganizationAPIWithToken() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    // Check if any users exist in any collection
    const collections = await mongoose.connection.db.listCollections().toArray();
    let userCollection = null;
    for (const collection of collections) {
      if (collection.name.toLowerCase().includes('user') || collection.name.toLowerCase().includes('auth')) {
        userCollection = collection.name;
      }
    }
    if (userCollection) {
      const users = await mongoose.connection.db.collection(userCollection).find({}).limit(1).toArray();
      if (users.length > 0) {
        );
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
    // Test the organization structure API with this token
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (data.data.availableUnits?.departmentsWithDivisions?.length > 0) {
        data.data.availableUnits.departmentsWithDivisions.slice(0, 2).forEach(dept => {
          });
      }
    } else {
      );
    }
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    mongoose.connection.close();
  }
}
testOrganizationAPIWithToken();