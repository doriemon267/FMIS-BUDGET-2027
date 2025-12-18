/**
 * Test script to verify VACANT position duplicate prevention
 * Run this after starting the server to test the bulk add functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5005/api';

// Test data for VACANT positions
const testVacantData = {
  statusOfAppointment: 'PERMANENT', // or CASUAL depending on your test data
  RATA: [1000, 2000, 3000], // Sample RATA values
  region: 'Central Office', // Adjust based on your test region
  processBy: 'Test User'
};

async function testVacantDuplicatePrevention() {
  try {
    console.log('🧪 Testing VACANT Position Duplicate Prevention...\n');

    // Test bulk add for personnel services
    console.log('📤 Testing Personnel Services bulk add...');
    const personnelResponse = await axios.post(`${API_BASE}/personnelServices/bulk-add`, testVacantData);

    console.log('✅ Personnel Services Response:');
    console.log('- Added records:', personnelResponse.data?.addedRecords?.length || 0);
    console.log('- Duplicates found:', personnelResponse.data?.duplicates?.length || 0);

    if (personnelResponse.data?.duplicates) {
      console.log('📋 Duplicates detected:');
      personnelResponse.data.duplicates.forEach((dup, index) => {
        console.log(`  ${index + 1}. ${dup.employeeName} (${dup.positionTitle})`);
      });
    }

    // Test bulk add for COS personnel
    console.log('\n📤 Testing COS Personnel bulk add...');
    const cosResponse = await axios.post(`${API_BASE}/cos-personnel/bulk-add`, {
      ...testVacantData,
      statusOfAppointment: 'COS'
    });

    console.log('✅ COS Personnel Response:');
    console.log('- Added records:', cosResponse.data?.addedRecords?.length || 0);
    console.log('- Duplicates found:', cosResponse.data?.duplicates?.length || 0);

    if (cosResponse.data?.duplicates) {
      console.log('📋 Duplicates detected:');
      cosResponse.data.duplicates.forEach((dup, index) => {
        console.log(`  ${index + 1}. ${dup.employeeName} (${dup.positionTitle})`);
      });
    }

    console.log('\n🎉 Test completed! Check the results above.');
    console.log('💡 If duplicates are still being created, check:');
    console.log('   1. ItemNumber field in EmployeeList records');
    console.log('   2. Position details matching logic');
    console.log('   3. Database indexes and constraints');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testVacantDuplicatePrevention();