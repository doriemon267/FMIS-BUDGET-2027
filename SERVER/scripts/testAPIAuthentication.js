/**
 * Test API Authentication and Organization Structure
 */

const fetch = require('node-fetch');

async function testAPI() {
  console.log('🔍 Testing Organization Structure API...');
  
  try {
    // First, let's try without authentication to see the response
    console.log('\n📡 Testing without authentication...');
    const response1 = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure');
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
    
    // Also test with a dummy token to see the authentication response
    console.log('\n📡 Testing with dummy token...');
    const response2 = await fetch('http://localhost:5005/api/hierarchical-rbac/organization-structure', {
      headers: {
        'Authorization': 'Bearer dummy_token',
        'Content-Type': 'application/json'
      }
    });
    const data2 = await response2.json();
    console.log('Response:', JSON.stringify(data2, null, 2));
    
  } catch (error) {
    console.error('❌ API Test Error:', error);
  }
}

testAPI();
