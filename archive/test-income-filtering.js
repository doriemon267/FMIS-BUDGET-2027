// Test Income Controller Submission Workflow Filtering
// This tests if department users can only see SUBMITTED division data

const http = require('http');

const BASE_URL = 'http://localhost:5005';

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5005,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function testIncomeFiltering() {
  console.log('🧪 TESTING INCOME CONTROLLER SUBMISSION WORKFLOW...\n');

  try {
    // Test 1: Department User (should only see SUBMITTED division data)
    console.log('1️⃣ Testing DEPARTMENT user access...');
    const deptResponse = await makeRequest('/api/income', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImRlcGFydG1lbnQxIiwiaWF0IjoxNzM4NDA5MTE1LCJleHAiOjE3Mzg0OTU1MTV9.ozbPNzGvAJcOa4-ZOuZ5k4mBSCUgGI4nt2f2wVfvZKg');
    console.log(`   📊 Department user sees: ${Array.isArray(deptResponse.data) ? deptResponse.data.length : 'Error'} income records`);
    
    // Test 2: Division User (should see their division data)  
    console.log('2️⃣ Testing DIVISION user access...');
    const divResponse = await makeRequest('/api/income', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImRpdmlzaW9uMSIsImlhdCI6MTczODQwOTEzMiwiZXhwIjoxNzM4NDk1NTMyfQ.Dt2UAWrBusVRLaKiwu3_mrw6vL9FgJ9zrDfig2Heuts');
    console.log(`   📊 Division user sees: ${Array.isArray(divResponse.data) ? divResponse.data.length : 'Error'} income records`);

    console.log('\n🎯 EXPECTED BEHAVIOR:');
    console.log('   - Department users: 0 records (or only SUBMITTED division data)');
    console.log('   - Division users: Can see their division data regardless of status');
    
    console.log('\n✅ TEST COMPLETED - Check server logs for filtering details');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testIncomeFiltering();
