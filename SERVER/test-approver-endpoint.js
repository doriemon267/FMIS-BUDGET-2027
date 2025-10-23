const jwt = require('jsonwebtoken');
const axios = require('axios');

// Create a test JWT token for Nelson Eloso (APPROVER)
const createApproverToken = () => {
  const payload = {
    userId: "416461", // Nelson Eloso's userId
    name: "Nelson Eloso",
    email: "nelson.eloso@gmail.com",
    roles: ["divisionApprover"], // APPROVER role
    accessToken: "mock-access-token"
  };
  // Use a default secret if JWT_SECRET_KEY is not set
  const secret = process.env.JWT_SECRET_KEY || "default-test-secret";
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

const testApproverEndpoint = async () => {
  const token = createApproverToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('🧪 Testing APPROVER endpoint: /api/my-proposals/all');
  console.log('User: Nelson Eloso (416461) - divisionApprover for ADMINISTRATIVE AND FINANCE DIVISION');

  try {
    const response = await axios.get('http://localhost:5005/api/my-proposals/all', { headers });
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    console.log('Full response data:', JSON.stringify(response.data, null, 2));
    
    const proposals = response.data.proposals || response.data.data || [];
    console.log('Total proposals returned:', proposals.length);

    if (proposals.length > 0) {
      console.log('\n📋 Proposals:');
      proposals.forEach((p, index) => {
        console.log(`${index + 1}. ${p.title} | Status: ${p.status} | Assignee: ${p.currentAssigneeRole}`);
      });
    } else {
      console.log('📭 No proposals returned');
    }

  } catch (error) {
    console.error("❌ Error testing APPROVER endpoint:");
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
testApproverEndpoint();