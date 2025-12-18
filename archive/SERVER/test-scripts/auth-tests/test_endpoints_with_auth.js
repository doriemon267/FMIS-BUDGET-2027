const jwt = require('jsonwebtoken');
const axios = require('axios');
// Create a test JWT token
const createTestToken = () => {
  const payload = {
    userId: "test-admin-123",
    name: "Test Admin",
    email: "admin@example.com",
    roles: ["SUPER ADMIN"],
    accessToken: "mock-access-token"
  };
  // Use a default secret if JWT_SECRET_KEY is not set
  const secret = process.env.JWT_SECRET_KEY || "default-test-secret";
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};
const testEndpoints = async () => {
  const token = createTestToken();
  + "...");
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  try {
    const regionsResponse = await axios.get('http://localhost:5005/api/regions', { headers });
    ? 'Array' : typeof regionsResponse.data);
    ? regionsResponse.data.length : 'N/A');
    const myAccessResponse = await axios.get('http://localhost:5005/api/hierarchical-rbac/my-access', { headers });
    .join(', ') || 'None');
  } catch (error) {
    console.error("❌ Error testing endpoints:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
};
// Load environment variables
require('dotenv').config();
testEndpoints();