/**
 * Test: Verify API Response with Fixed Amount Fields
 * Simulate what getRegionStructure and getCentralOfficeStructure will return
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const consolidationService = require('./utils/consolidationService');
    
    console.log('\n=== TESTING API RESPONSES WITH FIXED AMOUNTS ===\n');
    
    // Test Regional Structure
    console.log('📍 REGIONAL STRUCTURE:\n');
    const regionalStructure = await consolidationService.getRegionStructure(2026);
    
    console.log(JSON.stringify(regionalStructure, null, 2));
    
    console.log('\n\n🏢 CENTRAL OFFICE STRUCTURE:\n');
    const coStructure = await consolidationService.getCentralOfficeStructure(2026);
    
    console.log(JSON.stringify(coStructure, null, 2));
    
    console.log('\n\n=== VERIFICATION ===\n');
    
    // Check if amounts are showing
    if (regionalStructure.length > 0) {
      const firstRegion = regionalStructure[0];
      if (firstRegion.divisions.length > 0) {
        const firstDiv = firstRegion.divisions[0];
        console.log(`✅ Regional Division: ${firstDiv.division}`);
        console.log(`✅ Total Amount: ₱${firstDiv.totalAmount?.toLocaleString() || 0}`);
        console.log(`✅ Proposal Count: ${firstDiv.proposalCount}`);
      }
    }
    
    if (coStructure.length > 0) {
      const firstDept = coStructure[0];
      console.log(`\n✅ CO Department: ${firstDept.department}`);
      console.log(`✅ Total Amount: ₱${firstDept.totalAmount?.toLocaleString() || 0}`);
      console.log(`✅ Proposal Count: ${firstDept.proposalCount}`);
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
