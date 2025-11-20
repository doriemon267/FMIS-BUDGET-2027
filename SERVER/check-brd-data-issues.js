/**
 * Check BRD Consolidation Data - Why Amount is 0
 * Check API response structure for Regional/CO endpoints
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
    
    console.log('\n=== CHECKING BRD CONSOLIDATION DATA ===\n');
    
    const allBrd = await brdColl.find({}).toArray();
    
    allBrd.forEach((record, i) => {
      const type = record.isCentralOffice ? '🏢 CENTRAL OFFICE' : '📍 REGIONAL';
      console.log(`[${i+1}] ${type}`);
      console.log(`  Title: ${record.proposalTitle}`);
      console.log(`  Region: ${record.region}`);
      console.log(`  Division: ${record.division}`);
      console.log(`  Department: ${record.department}`);
      console.log(`  Path: ${record.consolidationPath}`);
      console.log(`\n  Financial Summary Object:`);
      console.log(`    ${JSON.stringify(record.financialSummary, null, 4)}`);
      console.log(`\n  Source Proposals Object:`);
      console.log(`    ${JSON.stringify(record.sourceProposals, null, 4)}`);
      console.log('\n');
    });
    
    console.log('=== ISSUES FOUND ===\n');
    
    // Check for missing amounts
    allBrd.forEach((record, i) => {
      if (!record.financialSummary || record.financialSummary.totalAmount === 0) {
        console.log(`❌ Record ${i+1}: Missing or zero amount`);
        console.log(`   Title: ${record.proposalTitle}`);
        console.log(`   Total Amount: ${record.financialSummary?.totalAmount || 'NOT SET'}`);
      }
    });
    
    // Check for missing division
    console.log('\n');
    allBrd.forEach((record, i) => {
      if (!record.division || record.division.trim() === '') {
        console.log(`❌ Record ${i+1}: Missing division`);
        console.log(`   Title: ${record.proposalTitle}`);
        console.log(`   Division: ${record.division || 'NOT SET'}`);
      }
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
