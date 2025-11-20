/**
 * Detailed Analysis: Where are ACTUAL Central Office Proposals?
 * Check MOOE data to identify real Central Office vs Regional proposals
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== ANALYZING PROPOSAL ORGANIZATION ACROSS ALL SOURCES ===\n');
    
    // 1. Check MOOE for all regions and divisions
    const mooeColl = db.collection('mooeproposals');
    const allMooe = await mooeColl.find({}).toArray();
    
    console.log('=== MOOE PROPOSALS (Detail Items) ===\n');
    
    const mooeByRegion = {};
    const mooeByDivision = {};
    
    allMooe.forEach(m => {
      const region = m.region || 'UNKNOWN';
      const division = m.division || 'UNKNOWN';
      const dept = m.department || 'UNKNOWN';
      
      if (!mooeByRegion[region]) mooeByRegion[region] = [];
      mooeByRegion[region].push({ division, dept, isCO: m.isCentralOffice });
      
      if (!mooeByDivision[division]) mooeByDivision[division] = [];
      mooeByDivision[division].push({ region, dept, isCO: m.isCentralOffice });
    });
    
    console.log('MOOE Records Grouped by REGION:\n');
    Object.entries(mooeByRegion).forEach(([region, items]) => {
      console.log(`📍 ${region}:`);
      items.forEach(item => {
        console.log(`   - Division: ${item.division} | Dept: ${item.dept} | CO: ${item.isCO}`);
      });
      console.log('');
    });
    
    console.log('\nMOOE Records Grouped by DIVISION:\n');
    Object.entries(mooeByDivision).forEach(([division, items]) => {
      console.log(`📂 ${division}:`);
      items.forEach(item => {
        console.log(`   - Region: ${item.region} | Dept: ${item.dept} | CO: ${item.isCO}`);
      });
      console.log('');
    });
    
    // 2. Check NewProposalWorkflow
    console.log('\n=== NEW PROPOSAL WORKFLOW (NPW) ===\n');
    
    const npwColl = db.collection('newproposalworkflows');
    const allNpw = await npwColl.find({}).toArray();
    
    allNpw.forEach((n, i) => {
      console.log(`[NPW-${i+1}] ${n.title}`);
      console.log(`  Region ID: ${n.region?.RegionName || n.region}`);
      console.log(`  CreatedBy: ${n.createdBy}`);
      console.log(`  Type: ${n.modelType}`);
      console.log(`  Org Fields:`);
      console.log(`    - division: ${n.division || 'NOT SET'}`);
      console.log(`    - department: ${n.department || 'NOT SET'}`);
      console.log(`    - office: ${n.office || 'NOT SET'}`);
      console.log(`    - isCentralOffice: ${n.isCentralOffice || 'NOT SET'}`);
      console.log('');
    });
    
    // 3. Check Income
    console.log('\n=== INCOME PROPOSALS ===\n');
    
    const incomeColl = db.collection('incomes');
    const allIncome = await incomeColl.find({}).toArray();
    
    console.log(`Total Income records: ${allIncome.length}`);
    if (allIncome.length > 0) {
      const incomeByRegion = {};
      allIncome.forEach(inc => {
        const region = inc.region || 'UNKNOWN';
        if (!incomeByRegion[region]) incomeByRegion[region] = 0;
        incomeByRegion[region]++;
      });
      
      console.log('Income by Region:');
      Object.entries(incomeByRegion).forEach(([region, count]) => {
        console.log(`  - ${region}: ${count} records`);
      });
    }
    console.log('');
    
    // 4. Check Capital Outlay
    console.log('\n=== CAPITAL OUTLAY ===\n');
    
    const capitalColl = db.collection('capitaloutlays');
    const allCapital = await capitalColl.find({}).toArray();
    
    console.log(`Total Capital Outlay records: ${allCapital.length}`);
    if (allCapital.length > 0) {
      const capitalByRegion = {};
      allCapital.forEach(cap => {
        const region = cap.region || 'UNKNOWN';
        if (!capitalByRegion[region]) capitalByRegion[region] = 0;
        capitalByRegion[region]++;
      });
      
      console.log('Capital Outlay by Region:');
      Object.entries(capitalByRegion).forEach(([region, count]) => {
        console.log(`  - ${region}: ${count} records`);
      });
    }
    
    // 5. Summary
    console.log('\n\n=== SUMMARY & INSIGHTS ===\n');
    
    const centralOfficeCount = allMooe.filter(m => m.region === 'CENTRAL OFFICE').length;
    const regionalCount = allMooe.filter(m => m.region !== 'CENTRAL OFFICE' && m.region).length;
    
    console.log(`MOOE Proposals:`);
    console.log(`  - Region = CENTRAL OFFICE: ${centralOfficeCount} records`);
    console.log(`  - Region = Other (MARIIS, CAR, etc): ${regionalCount} records`);
    
    console.log(`\nCentral Office Divisions Found:`);
    const centralOfficeItems = allMooe.filter(m => m.region === 'CENTRAL OFFICE');
    const coDivisions = [...new Set(centralOfficeItems.map(m => m.division))];
    coDivisions.forEach(div => {
      console.log(`  ✓ ${div}`);
    });
    
    console.log(`\nRegional Divisions Found:`);
    const regionalItems = allMooe.filter(m => m.region && m.region !== 'CENTRAL OFFICE');
    const regionalDivisions = [...new Set(regionalItems.map(m => `${m.region} > ${m.division}`))];
    regionalDivisions.forEach(div => {
      console.log(`  ✓ ${div}`);
    });
    
    console.log('\n\n🎯 KEY FINDING:\n');
    if (centralOfficeCount > 0) {
      console.log(`✓ TRUE CENTRAL OFFICE PROPOSALS EXIST: ${centralOfficeCount} MOOE records`);
      console.log('  → Should create separate BRD consolidation for these');
      console.log('  → Organize by Department, NOT Division');
    } else {
      console.log('✗ NO TRUE CENTRAL OFFICE PROPOSALS in current data');
      console.log('  → All MOOE records belong to regions (MARIIS, etc)');
      console.log('  → Central Office tab may not need data yet');
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
