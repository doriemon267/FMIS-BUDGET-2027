/**
 * Check organizational structure for HEAD OFFICE
 * Verify if HEAD OFFICE belongs to MARIIS Region or Central Office
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== CHECKING HEAD OFFICE ORGANIZATIONAL STRUCTURE ===\n');
    
    // 1. Check BRD records with HEAD OFFICE
    const brdColl = db.collection('brd_consolidations');
    const brdHeadOfficeRecords = await brdColl.find({ department: 'HEAD OFFICE' }).toArray();
    
    console.log('BRD Records with HEAD OFFICE department:');
    console.log(`Count: ${brdHeadOfficeRecords.length}\n`);
    
    brdHeadOfficeRecords.forEach((r, i) => {
      console.log(`[Record ${i+1}]`);
      console.log(`  Title: ${r.proposalTitle}`);
      console.log(`  Region: ${r.region}`);
      console.log(`  Division: ${r.division}`);
      console.log(`  Department: ${r.department}`);
      console.log(`  isCentralOffice: ${r.isCentralOffice}`);
      console.log(`  ConsolidationPath: ${r.consolidationPath}`);
      console.log('');
    });
    
    // 2. Check MOOE records with HEAD OFFICE
    const mooeColl = db.collection('mooeproposals');
    const mooeHeadOfficeRecords = await mooeColl.find({ department: 'HEAD OFFICE' }).toArray();
    
    console.log('\nMOOE Records with HEAD OFFICE department:');
    console.log(`Count: ${mooeHeadOfficeRecords.length}\n`);
    
    mooeHeadOfficeRecords.forEach((m, i) => {
      console.log(`[MOOE Record ${i+1}]`);
      console.log(`  Title: ${m.title}`);
      console.log(`  Region: ${m.region}`);
      console.log(`  Division: ${m.division}`);
      console.log(`  Department: ${m.department}`);
      console.log(`  isCentralOffice: ${m.isCentralOffice}`);
      console.log('');
    });
    
    // 3. Check HierarchicalUserAssignment with HEAD OFFICE
    const huaColl = db.collection('hierarchicaluserassignments');
    const huaHeadOfficeRecords = await huaColl.find({ office: 'HEAD OFFICE' }).toArray();
    
    console.log('\nHierarchicalUserAssignment with HEAD OFFICE:');
    console.log(`Count: ${huaHeadOfficeRecords.length}\n`);
    
    huaHeadOfficeRecords.slice(0, 3).forEach((h, i) => {
      console.log(`[HUA Record ${i+1}]`);
      console.log(`  User: ${h.userId}`);
      console.log(`  Region: ${h.region}`);
      console.log(`  Division: ${h.division}`);
      console.log(`  Office: ${h.office}`);
      console.log('');
    });
    
    // 4. Summary and Analysis
    console.log('\n=== ANALYSIS ===\n');
    
    const isCOMooe = mooeHeadOfficeRecords.filter(m => m.isCentralOffice).length;
    const isRegionalMooe = mooeHeadOfficeRecords.filter(m => !m.isCentralOffice).length;
    
    console.log(`MOOE Classification:`);
    console.log(`  Central Office: ${isCOMooe}`);
    console.log(`  Regional (under MARIIS): ${isRegionalMooe}`);
    
    const coBrd = brdHeadOfficeRecords.filter(b => b.isCentralOffice).length;
    const regionalBrd = brdHeadOfficeRecords.filter(b => !b.isCentralOffice).length;
    
    console.log(`\nBRD Classification:`);
    console.log(`  Central Office: ${coBrd}`);
    console.log(`  Regional (under MARIIS): ${regionalBrd}`);
    
    console.log(`\n\n=== RECOMMENDATION ===\n`);
    console.log('Question: Is HEAD OFFICE truly Central Office or under MARIIS Region?');
    console.log('');
    console.log('Answer based on data:');
    if (isRegionalMooe > 0) {
      console.log('⚠️  MOOE data suggests HEAD OFFICE is REGIONAL (under MARIIS)');
      console.log('   → Action: Change isCentralOffice from TRUE to FALSE');
      console.log('   → Update consolidationPath to: MARIIS/HEAD OFFICE (not CentralOffice/HEAD OFFICE)');
    }
    if (isCOMooe > 0) {
      console.log('✓ MOOE data suggests HEAD OFFICE is CENTRAL OFFICE');
      console.log('   → Current isCentralOffice: TRUE is CORRECT');
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
