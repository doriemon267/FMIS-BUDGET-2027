// Test workflow history endpoint
const axios = require('axios');

async function testWorkflowHistory() {
  try {
    const proposalId = '68f05c11a70efb0f3e6a4671';
    
    console.log('Testing workflow history endpoint...\n');
    console.log(`URL: http://localhost:5005/api/workflow/history/${proposalId}\n`);
    
    const response = await axios.get(`http://localhost:5005/api/workflow/history/${proposalId}`);
    
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR!');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
    console.error('Full error:', error.response?.data || error.message);
  }
}

testWorkflowHistory();
