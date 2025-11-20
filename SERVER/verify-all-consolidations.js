/**
 * Verify: Check all BRD Consolidations now
 * Should show 1 Regional + 1 Central Office
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    const brdColl = db.collection('brd_consolidations');
    
    console.log('\n=== BRD CONSOLIDATIONS SUMMARY ===\n');
    
    const allRecords = await brdColl.find({}).toArray();
    console.log(`Total BRD Consolidations: ${allRecords.length}\n`);
    
    // Count by type
    const centralOffice = allRecords.filter(r => r.isCentralOffice).length;
    const regional = allRecords.filter(r => !r.isCentralOffice).length;
    
    console.log(`Distribution:`);
    console.log(`  - Central Office: ${centralOffice} records`);
    console.log(`  - Regional: ${regional} records`);
    console.log('');
    
    // List all records
    console.log('=== DETAILED LIST ===\n');
    
    allRecords.forEach((record, i) => {
      const type = record.isCentralOffice ? '🏢 CENTRAL OFFICE' : '📍 REGIONAL';
      console.log(`[${i+1}] ${type}`);
      console.log(`  Title: ${record.proposalTitle}`);
      console.log(`  Region: ${record.region}`);
      console.log(`  Division: ${record.division}`);
      console.log(`  Department: ${record.department}`);
      console.log(`  Path: ${record.consolidationPath}`);
      console.log(`  MOOE Records: ${record.sourceProposals?.mooe?.length || 0}`);
      console.log(`  Amount: ₱${record.financialSummary?.totalAmount?.toLocaleString() || 'N/A'}`);
      console.log('');
    });
    
    console.log('=== STATUS ===\n');
    console.log(`✅ Central Office Consolidation: ${centralOffice > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Regional Consolidations: ${regional > 0 ? 'EXISTS' : 'MISSING'}`);
    console.log(`✅ Total: ${allRecords.length} consolidations`);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
