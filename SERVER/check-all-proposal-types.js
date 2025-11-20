/**
 * Comprehensive Check: All Proposal Types in the System
 * Check beyond just MOOE - look at all proposal types
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== CHECKING ALL PROPOSAL TYPES IN SYSTEM ===\n');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const proposalCollections = collections.filter(c => 
      c.name.toLowerCase().includes('proposal') || 
      c.name.toLowerCase().includes('income') ||
      c.name.toLowerCase().includes('personnel') ||
      c.name.toLowerCase().includes('capital')
    );
    
    console.log('Proposal-related collections found:');
    proposalCollections.forEach(c => console.log(`  - ${c.name}`));
    
    console.log('\n--- CHECKING EACH COLLECTION ---\n');
    
    // 1. MOOEProposals
    const mooeColl = db.collection('mooeproposals');
    const mooeCount = await mooeColl.countDocuments();
    console.log(`1. MOOE Proposals: ${mooeCount} records`);
    if (mooeCount > 0) {
      const mooeRecords = await mooeColl.find({}).limit(3).toArray();
      mooeRecords.forEach((m, i) => {
        console.log(`   [${i+1}] Region: ${m.region}, Division: ${m.division}, Dept: ${m.department}`);
      });
    }
    
    // 2. NewProposalWorkflow
    const npwColl = db.collection('newproposalworkflows');
    const npwCount = await npwColl.countDocuments();
    console.log(`\n2. NewProposalWorkflow (NPW): ${npwCount} records`);
    if (npwCount > 0) {
      const npwRecords = await npwColl.find({}).limit(3).toArray();
      npwRecords.forEach((n, i) => {
        console.log(`   [${i+1}] Title: ${n.title}`);
        console.log(`       Region: ${n.region?.RegionName || n.region}`);
        console.log(`       Type: ${n.modelType}`);
        console.log(`       FY: ${n.fiscalYear}`);
      });
    }
    
    // 3. Income Proposals
    const incomeColl = db.collection('incomes');
    const incomeCount = await incomeColl.countDocuments();
    console.log(`\n3. Income Proposals: ${incomeCount} records`);
    if (incomeCount > 0) {
      const incomeRecords = await incomeColl.find({}).limit(2).toArray();
      incomeRecords.forEach((inc, i) => {
        console.log(`   [${i+1}] Title: ${inc.title || 'N/A'}`);
        console.log(`       Region: ${inc.region || 'N/A'}`);
      });
    }
    
    // 4. Personnel Proposals
    const personnelColl = db.collection('personnels');
    const personnelCount = await personnelColl.countDocuments();
    console.log(`\n4. Personnel Proposals: ${personnelCount} records`);
    if (personnelCount > 0) {
      const personalRecords = await personnelColl.find({}).limit(2).toArray();
      personalRecords.forEach((p, i) => {
        console.log(`   [${i+1}] Name: ${p.employeeName || 'N/A'}`);
        console.log(`       Region: ${p.region || 'N/A'}`);
      });
    }
    
    // 5. Capital Outlay
    const capitalColl = db.collection('capitaloutlays');
    const capitalCount = await capitalColl.countDocuments();
    console.log(`\n5. Capital Outlay Proposals: ${capitalCount} records`);
    if (capitalCount > 0) {
      const capitalRecords = await capitalColl.find({}).limit(2).toArray();
      capitalRecords.forEach((c, i) => {
        console.log(`   [${i+1}] Item: ${c.item || 'N/A'}`);
        console.log(`       Region: ${c.region || 'N/A'}`);
      });
    }
    
    // 6. BRD Consolidations
    const brdColl = db.collection('brd_consolidations');
    const brdCount = await brdColl.countDocuments();
    console.log(`\n6. BRD Consolidations: ${brdCount} records`);
    if (brdCount > 0) {
      const brdRecords = await brdColl.find({}).limit(3).toArray();
      brdRecords.forEach((b, i) => {
        console.log(`   [${i+1}] Title: ${b.proposalTitle || 'N/A'}`);
        console.log(`       Region: ${b.region}, isCentralOffice: ${b.isCentralOffice}`);
        console.log(`       Path: ${b.consolidationPath}`);
      });
    }
    
    // 7. DraftProposals
    const draftColl = db.collection('draftproposals');
    const draftCount = await draftColl.countDocuments();
    console.log(`\n7. Draft Proposals: ${draftCount} records`);
    
    // 8. Proposals (old/legacy)
    const proposalColl = db.collection('proposals');
    const proposalCount = await proposalColl.countDocuments();
    console.log(`\n8. Proposals (Legacy): ${proposalCount} records`);
    
    // 9. ProposalWorkflow
    const pwfColl = db.collection('proposalworkflows');
    const pwfCount = await pwfColl.countDocuments();
    console.log(`\n9. ProposalWorkflow (Legacy): ${pwfCount} records`);
    
    console.log('\n\n=== SUMMARY ===\n');
    
    const totalProposals = mooeCount + npwCount + incomeCount + personnelCount + capitalCount + draftCount + proposalCount + pwfCount;
    
    console.log(`Total Proposals in System: ${totalProposals}`);
    console.log(`\nBreakdown:`);
    console.log(`  - MOOE Proposals: ${mooeCount}`);
    console.log(`  - NewProposalWorkflow: ${npwCount}`);
    console.log(`  - Income: ${incomeCount}`);
    console.log(`  - Personnel: ${personnelCount}`);
    console.log(`  - Capital Outlay: ${capitalCount}`);
    console.log(`  - Draft Proposals: ${draftCount}`);
    console.log(`  - Legacy Proposals: ${proposalCount}`);
    console.log(`  - Legacy ProposalWorkflow: ${pwfCount}`);
    console.log(`  - BRD Consolidations: ${brdCount}`);
    
    console.log('\n=== KEY INSIGHTS ===\n');
    console.log('1. NewProposalWorkflow (NPW) = Current active proposal system');
    console.log('2. MOOE, Income, Personnel, Capital = Detailed items within proposals');
    console.log('3. Legacy Proposals = Old system data (may or may not be used)');
    console.log('4. BRD Consolidations = Aggregated/consolidated view of proposals');
    console.log('\n🔑 For organizational data (Region, Division, Department):');
    console.log('   - Primary source: NPW (NewProposalWorkflow)');
    console.log('   - Secondary source: Detail items (MOOE, Income, etc.)');
    console.log('   - Should consolidate both sources for complete picture!');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
