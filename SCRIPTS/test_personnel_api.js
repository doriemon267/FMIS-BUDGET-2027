// Test script para sa Personnel Services API
// Using built-in fetch instead of axios
const baseURL = 'http://localhost:8000'; // Adjust if different port

async function testPersonnelAPI() {
  try {
    console.log('Testing Personnel Services API with new parameters...');
    
    // Test parameters na ginagamit sa BudgetarySupportTable
    const permanentParams = {
      statusOfAppointment: 'PERMANENT',
      fiscalYear: '2024', // Adjust based on your data
      budgetType: 'INITIAL',
      limit: 1000,
      page: 1,
      region: 'Central Office' // Adjust based on your data
    };
    
    const casualParams = {
      statusOfAppointment: 'CASUAL',
      fiscalYear: '2024', // Adjust based on your data
      budgetType: 'INITIAL',
      limit: 1000,
      page: 1,
      region: 'Central Office' // Adjust based on your data
    };
    
    console.log('\n=== Testing PERMANENT Personnel ===');
    console.log('Params:', permanentParams);
    
    const permanentURL = `${baseURL}/personnelServices?` + new URLSearchParams(permanentParams);
    const permanentResponse = await fetch(permanentURL);
    const permanentResult = await permanentResponse.json();
    
    console.log(`Permanent Records Found: ${permanentResult?.personnelServices?.length || 0}`);
    if (permanentResult?.personnelServices?.length > 0) {
      const sample = permanentResult.personnelServices[0];
      console.log('Sample Record Fields:', Object.keys(sample));
      console.log('Sample Total Value:', sample.Total || sample.annualSalary || sample.total);
    }
    
    console.log('\n=== Testing CASUAL Personnel ===');
    console.log('Params:', casualParams);
    
    const casualURL = `${baseURL}/personnelServices?` + new URLSearchParams(casualParams);
    const casualResponse = await fetch(casualURL);
    const casualResult = await casualResponse.json();
    
    console.log(`Casual Records Found: ${casualResult?.personnelServices?.length || 0}`);
    if (casualResult?.personnelServices?.length > 0) {
      const sample = casualResult.personnelServices[0];
      console.log('Sample Record Fields:', Object.keys(sample));
      console.log('Sample Total Value:', sample.Total || sample.annualSalary || sample.total);
    }
    
    // Test combined calculation like in BudgetarySupportTable
    const permanentData = permanentResult?.personnelServices || [];
    const casualData = casualResult?.personnelServices || [];
    const combinedData = [...permanentData, ...casualData];
    
    const totalPS = combinedData.reduce((sum, item) => {
      return sum + (Number(item.Total) || Number(item.annualSalary) || Number(item.total) || 0);
    }, 0);
    
    console.log('\n=== COMBINED RESULTS ===');
    console.log(`Total Personnel Records: ${combinedData.length}`);
    console.log(`Total Personnel Services Amount: ₱${totalPS.toLocaleString()}`);
    
  } catch (error) {
    console.error('Error testing Personnel API:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testPersonnelAPI();