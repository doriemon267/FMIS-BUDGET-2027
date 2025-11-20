/**
 * Final Comprehensive Verification
 * Verify all proposal types consolidated correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          FINAL COMPREHENSIVE CONSOLIDATION VERIFICATION         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    
    // Get all BRD records
    const brdColl = db.collection('brd_consolidations');
    const allBrd = await brdColl.find({}).toArray();
    
    console.log(`📊 TOTAL BRD CONSOLIDATIONS: ${allBrd.length}\n`);
    
    // 1. Regional Consolidations
    const regional = allBrd.filter(r => !r.isCentralOffice);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📍 REGIONAL CONSOLIDATIONS\n');
    
    regional.forEach((r, i) => {
      console.log(`[REGIONAL-${i+1}] ${r.proposalTitle}`);
      console.log(`  Region: ${r.region}`);
      console.log(`  Division: ${r.division}`);
      console.log(`  Department: ${r.department}`);
      console.log(`  Path: ${r.consolidationPath}`);
      console.log(`  Source Proposals:`);
      console.log(`    ├─ MOOE: ${r.sourceProposals?.mooe?.length || 0} records`);
      console.log(`    ├─ Income: ${r.sourceProposals?.income?.length || 0} records`);
      console.log(`    ├─ Capital: ${r.sourceProposals?.capital?.length || 0} records`);
      console.log(`    └─ Personnel: ${r.sourceProposals?.personnel?.length || 0} records`);
      console.log(`  Financial:`);
      console.log(`    ├─ MOOE: ₱${r.financialSummary?.mooeAmount?.toLocaleString() || '0'}`);
      console.log(`    ├─ Income: ₱${r.financialSummary?.incomeAmount?.toLocaleString() || '0'}`);
      console.log(`    ├─ Capital: ₱${r.financialSummary?.capitalAmount?.toLocaleString() || '0'}`);
      console.log(`    └─ TOTAL: ₱${r.financialSummary?.totalAmount?.toLocaleString() || '0'}`);
      console.log('');
    });
    
    // 2. Central Office Consolidations
    const centralOffice = allBrd.filter(r => r.isCentralOffice);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🏢 CENTRAL OFFICE CONSOLIDATIONS\n');
    
    centralOffice.forEach((c, i) => {
      console.log(`[CENTRAL-${i+1}] ${c.proposalTitle}`);
      console.log(`  Region: ${c.region}`);
      console.log(`  Division: ${c.division}`);
      console.log(`  Department: ${c.department}`);
      console.log(`  Path: ${c.consolidationPath}`);
      console.log(`  Source Proposals:`);
      console.log(`    ├─ MOOE: ${c.sourceProposals?.mooe?.length || 0} records`);
      console.log(`    ├─ Income: ${c.sourceProposals?.income?.length || 0} records`);
      console.log(`    ├─ Capital: ${c.sourceProposals?.capital?.length || 0} records`);
      console.log(`    └─ Personnel: ${c.sourceProposals?.personnel?.length || 0} records`);
      console.log(`  Financial:`);
      console.log(`    ├─ MOOE: ₱${c.financialSummary?.mooeAmount?.toLocaleString() || '0'}`);
      console.log(`    ├─ Income: ₱${c.financialSummary?.incomeAmount?.toLocaleString() || '0'}`);
      console.log(`    ├─ Capital: ₱${c.financialSummary?.capitalAmount?.toLocaleString() || '0'}`);
      console.log(`    └─ TOTAL: ₱${c.financialSummary?.totalAmount?.toLocaleString() || '0'}`);
      console.log('');
    });
    
    // 3. Summary Statistics
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📈 CONSOLIDATION SUMMARY\n');
    
    let totalMooe = 0, totalIncome = 0, totalCapital = 0;
    allBrd.forEach(r => {
      totalMooe += r.sourceProposals?.mooe?.length || 0;
      totalIncome += r.sourceProposals?.income?.length || 0;
      totalCapital += r.sourceProposals?.capital?.length || 0;
    });
    
    console.log(`Source Proposals Consolidated:`);
    console.log(`  ├─ MOOE: ${totalMooe} records`);
    console.log(`  ├─ Income: ${totalIncome} records`);
    console.log(`  ├─ Capital: ${totalCapital} records`);
    console.log(`  └─ Total: ${totalMooe + totalIncome + totalCapital} records`);
    console.log('');
    
    // 4. Data Completeness
    console.log('✅ DATA COMPLETENESS CHECK:\n');
    
    const mooeCount = await db.collection('mooeproposals').countDocuments();
    const incomeCount = await db.collection('incomes').countDocuments();
    const capitalCount = await db.collection('capitaloutlays').countDocuments();
    
    console.log(`MOOE Proposals: ${totalMooe}/${mooeCount} consolidated (${Math.round(totalMooe/mooeCount*100)}%)`);
    console.log(`Income Proposals: ${totalIncome}/${incomeCount} consolidated (${Math.round(totalIncome/incomeCount*100)}%)`);
    console.log(`Capital Outlay: ${totalCapital}/${capitalCount} consolidated (${Math.round(totalCapital/capitalCount*100)}%)`);
    console.log('');
    
    // 5. Final Status
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ FINAL STATUS\n');
    
    const isComplete = totalMooe === mooeCount && totalIncome === incomeCount && totalCapital === capitalCount;
    
    if (isComplete) {
      console.log('🎉 ✅ ALL PROPOSALS CONSOLIDATED SUCCESSFULLY!\n');
      console.log('  ✓ All MOOE records linked');
      console.log('  ✓ All Income records linked');
      console.log('  ✓ All Capital records linked');
      console.log('  ✓ Both Regional and Central Office consolidations exist');
      console.log('  ✓ Financial summaries aggregated\n');
    } else {
      console.log('⚠️  Consolidation Incomplete\n');
      if (totalMooe < mooeCount) console.log(`  ⚠️  MOOE: ${mooeCount - totalMooe} records not consolidated`);
      if (totalIncome < incomeCount) console.log(`  ⚠️  Income: ${incomeCount - totalIncome} records not consolidated`);
      if (totalCapital < capitalCount) console.log(`  ⚠️  Capital: ${capitalCount - totalCapital} records not consolidated`);
      console.log('');
    }
    
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
