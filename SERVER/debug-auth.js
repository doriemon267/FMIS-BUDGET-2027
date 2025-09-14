/**
 * Debug authentication issue
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function debugAuth() {
  try {
    // Create fresh JWT
    const regionUserData = {
      id: 416461,
      FirstName: "Nelson",
      LastName: "Eloso",
      Roles: ["EMPLOYEE"]
    };
    
    const token = jwt.sign(regionUserData, 'fmis_budget_secret_2024', { expiresIn: '1h' });
    console.log('🔑 Generated token for Region user');
    
    // Decode to verify
    const decoded = jwt.decode(token);
    console.log('📋 Token contents:', {
      id: decoded.id,
      name: decoded.FirstName + ' ' + decoded.LastName,
      roles: decoded.Roles,
      exp: new Date(decoded.exp * 1000),
      iat: new Date(decoded.iat * 1000)
    });
    
    // Test a simple API call first
    console.log('\n🧪 Testing simple API call...');
    try {
      const response = await axios.get('http://localhost:5005/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Root endpoint accessible:', response.data);
    } catch (error) {
      console.log('❌ Root endpoint failed:', error.response?.status, error.response?.data);
    }
    
    // Test without authentication to verify server is working
    console.log('\n🧪 Testing without auth...');
    try {
      const response = await axios.get('http://localhost:5005/');
      console.log('✅ Server is working:', response.data);
    } catch (error) {
      console.log('❌ Server not accessible:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugAuth();