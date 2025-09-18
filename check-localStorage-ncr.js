const axios = require('axios');

// Check localStorage for NCR data
async function checkLocalStorage() {
    console.log('🔍 Checking for NCR in localStorage...\n');

    // This would need to be run in browser console, but let's check if there are any
    // references to NCR in the application code that might be setting localStorage

    console.log('📋 Current localStorage keys that might contain region data:');
    console.log('   - activeRegion (from RegionContext)');
    console.log('   - token (encrypted user token)');

    console.log('\n💡 To check localStorage in browser:');
    console.log('   1. Open browser DevTools (F12)');
    console.log('   2. Go to Console tab');
    console.log('   3. Run: localStorage.getItem("activeRegion")');
    console.log('   4. If NCR appears, clear it with: localStorage.removeItem("activeRegion")');

    console.log('\n🔧 If NCR persists in UI, try:');
    console.log('   - Clear browser cache and localStorage');
    console.log('   - Hard refresh (Ctrl+F5)');
    console.log('   - Check if user has NCR in their assigned regions');

    // Check if there are any API endpoints that might be returning NCR
    console.log('\n🌐 Checking API endpoints for NCR references...');

    try {
        const response = await axios.get('http://localhost:5005/api/employees?page=1&limit=10');
        const employees = response.data.employees || [];

        console.log(`📊 Found ${employees.length} employees in API response`);

        if (employees.length > 0) {
            const regions = [...new Set(employees.map(emp => emp.Region))];
            console.log(`🏷️  Regions in current data: ${regions.join(', ')}`);

            const hasNCR = regions.includes('NCR');
            console.log(`🔍 NCR in current API data: ${hasNCR ? 'YES' : 'NO'}`);
        }
    } catch (error) {
        console.log('❌ Could not connect to API:', error.message);
    }
}

checkLocalStorage();