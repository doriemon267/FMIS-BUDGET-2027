const jwt = require('jsonwebtoken');
const axios = require('axios');

const createTestToken = (roles = ['BUDGET_ADMIN']) => {
  const payload = {
    id: 'test-user-123',
    userId: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    Roles: roles
  };
  const secret = process.env.JWT_SECRET_KEY || 'default-test-secret';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

const testUserLookup = async () => {
  const token = createTestToken(['BUDGET_ADMIN']);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('Testing user lookup endpoint...');
    const response = await axios.get('http://localhost:5005/api/hierarchical-rbac/user-lookup/12345', { headers });
    console.log('✅ User lookup successful:', response.data);
  } catch (error) {
    console.error('❌ User lookup failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
};

// Load environment variables
require('dotenv').config();
testUserLookup();