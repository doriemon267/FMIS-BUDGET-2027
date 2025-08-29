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
  console.log("🔑 Generated test token:", token.substring(0, 50) + "...");
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  try {
    console.log("\n🧪 Testing /api/regions endpoint...");
    const regionsResponse = await axios.get('http://localhost:5005/api/regions', { headers });
    console.log("✅ Regions endpoint successful:");
    console.log("Response status:", regionsResponse.status);
    console.log("Response data type:", Array.isArray(regionsResponse.data) ? 'Array' : typeof regionsResponse.data);
    console.log("Number of regions:", Array.isArray(regionsResponse.data) ? regionsResponse.data.length : 'N/A');
    
    console.log("\n🧪 Testing /api/hierarchical-rbac/my-access endpoint...");
    const myAccessResponse = await axios.get('http://localhost:5005/api/hierarchical-rbac/my-access', { headers });
    console.log("✅ my-access endpoint successful:");
    console.log("Response status:", myAccessResponse.status);
    console.log("Scope:", myAccessResponse.data?.accessInfo?.scope);
    console.log("Accessible Regions:", myAccessResponse.data?.accessInfo?.accessibleRegions?.map(r => r.regionName).join(', ') || 'None');
    
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
