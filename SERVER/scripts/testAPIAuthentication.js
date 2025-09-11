/**
 * Test API Authentication and Organization Structure
 */
const fetch = require('node-fetch');
async function testAPI() {
  try {
    // First, let's try without authentication to see the response
    const response1 = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure');
    const data1 = await response1.json();
    );
    // Also test with a dummy token to see the authentication response
    const response2 = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure', {
      headers: {
        'Authorization': 'Bearer dummy_token',
        'Content-Type': 'application/json'
      }
    });
    const data2 = await response2.json();
    );
  } catch (error) {
    console.error('❌ API Test Error:', error);
  }
}
testAPI();