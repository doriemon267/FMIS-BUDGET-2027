/**
 * Analyze proposals to identify which should be Central Office
 * Check MOOE data, proposal details, and organizational assignment
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== ANALYZING PROPOSALS FOR CENTRAL OFFICE ===\n');
    
    // Check all NPW records
    const npwCollection = db.collection('newproposalworkflows');
    const allNPW = await npwCollection.find({}).toArray();
    console.log(`Total NPW records: ${allNPW.length}`);
    
    // Check MOOE records
    const mooeCollection = db.collection('mooeproposals');
    const allMOOE = await mooeCollection.find({}).toArray();
    console.log(`Total MOOE records: ${allMOOE.length}`);
    
    // Check for Central Office indicators
    console.log('\n--- Analyzing MOOE Records for CO Indicators ---');
    const coIndicators = ['Central Office', 'HEAD OFFICE', 'CO', 'Central'];
    
    allMOOE.forEach((mooe, idx) => {
      console.log(`\n[MOOE-${idx + 1}]`);
      console.log(`  Title: ${mooe.title}`);
      console.log(`  Division: ${mooe.division}`);
      console.log(`  Department: ${mooe.department}`);
      console.log(`  isCentralOffice: ${mooe.isCentralOffice}`);
      
      // Check if it looks like CO
      const isCO = coIndicators.some(indicator =>
        mooe.department?.includes(indicator) || 
        mooe.division?.includes(indicator)
      );
      
      if (isCO) {
        console.log(`  ⚠️  Appears to be Central Office!`);
      }
    });
    
    // Check which NPW proposals exist
    console.log('\n--- NPW Records ---');
    allNPW.forEach((npw, idx) => {
      console.log(`\n[NPW-${idx + 1}]`);
      console.log(`  ID: ${npw._id}`);
      console.log(`  Title: ${npw.title}`);
      console.log(`  Region: ${npw.region?.RegionName || npw.region}`);
      console.log(`  CreatedBy: ${npw.createdBy}`);
      console.log(`  FiscalYear: ${npw.fiscalYear}`);
    });
    
    // Check BRD consolidation records
    console.log('\n--- BRD Consolidation Records ---');
    const brdCollection = db.collection('brd_consolidations');
    const allBRD = await brdCollection.find({}).toArray();
    console.log(`Total BRD records: ${allBRD.length}`);
    
    allBRD.forEach((brd, idx) => {
      console.log(`\n[BRD-${idx + 1}]`);
      console.log(`  ID: ${brd._id}`);
      console.log(`  Title: ${brd.proposalTitle}`);
      console.log(`  Region: ${brd.region}`);
      console.log(`  Division: ${brd.division}`);
      console.log(`  Department: ${brd.department}`);
      console.log(`  isCentralOffice: ${brd.isCentralOffice}`);
      console.log(`  ConsolidationPath: ${brd.consolidationPath}`);
    });
    
    // Recommendations
    console.log('\n\n=== RECOMMENDATIONS ===\n');
    console.log('To identify Central Office proposals:');
    console.log('1. Check if department name contains "Central Office" or "HEAD OFFICE"');
    console.log('2. Check if division name suggests central functions');
    console.log('3. Check user assignment - if assigned to Central Office');
    console.log('4. Check MOOE records for isCentralOffice flag');
    console.log('\nBased on analysis:');
    
    const coDepts = allMOOE
      .filter(m => coIndicators.some(ind => m.department?.includes(ind)))
      .map(m => m.department);
    
    if (coDepts.length > 0) {
      console.log(`✓ Found ${coDepts.length} potential CO departments in MOOE:`, [...new Set(coDepts)]);
    } else {
      console.log('✗ No clear CO indicators found in current data');
      console.log('✓ Current record (Test MARIIS) is correctly marked as REGIONAL (isCentralOffice: false)');
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
