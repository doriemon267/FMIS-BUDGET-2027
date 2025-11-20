/**
 * Create BRD Consolidation for Central Office
 * Aggregates 4 MOOE records from CORPORATE PLANNING SERVICES
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== CREATING CENTRAL OFFICE BRD CONSOLIDATION ===\n');
    
    // 1. Get the 4 MOOE records from CORPORATE PLANNING SERVICES
    const mooeColl = db.collection('mooeproposals');
    const mooeRecords = await mooeColl.find({
      region: 'CENTRAL OFFICE',
      division: 'MANAGEMENT INFORMATION DIVISION',
      department: 'CORPORATE PLANNING SERVICES'
    }).toArray();
    
    console.log(`Found ${mooeRecords.length} MOOE records to consolidate:`);
    mooeRecords.forEach((m, i) => {
      console.log(`  [${i+1}] ID: ${m._id}`);
    });
    
    // 2. Aggregate financial data
    let totalAmount = 0;
    const mooeIds = mooeRecords.map(m => m._id);
    
    mooeRecords.forEach(m => {
      if (m.income) totalAmount += m.income;
      if (m.subsidy) totalAmount += m.subsidy;
    });
    
    console.log(`\nAggregated Amount: ₱${totalAmount.toLocaleString()}`);
    
    // 3. Create BRD Consolidation record
    const brdColl = db.collection('brd_consolidations');
    
    const consolidationRecord = {
      proposalTitle: 'CORPORATE PLANNING SERVICES - Central Office Consolidation',
      region: 'CENTRAL OFFICE',
      division: 'MANAGEMENT INFORMATION DIVISION',
      department: 'CORPORATE PLANNING SERVICES',
      office: null,
      isCentralOffice: true,
      consolidationPath: 'Central Office/CORPORATE PLANNING SERVICES',
      
      // Fiscal year from MOOE records (if available)
      fiscalYear: 2026,
      
      // Source data
      sourceProposals: {
        mooe: mooeIds,
        income: [],
        capital: [],
        personnel: []
      },
      
      // Financial summary
      financialSummary: {
        totalAmount: totalAmount,
        mooeAmount: totalAmount,
        incomeAmount: 0,
        capitalAmount: 0,
        personnelAmount: 0
      },
      
      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'ACTIVE',
      consolidationType: 'CENTRAL_OFFICE'
    };
    
    console.log('\nCreating BRD Consolidation record...');
    console.log('Data:', JSON.stringify(consolidationRecord, null, 2));
    
    const result = await brdColl.insertOne(consolidationRecord);
    
    console.log('\n✅ BRD Consolidation created successfully!');
    console.log(`ID: ${result.insertedId}`);
    
    // 4. Verify creation
    const created = await brdColl.findOne({ _id: result.insertedId });
    
    console.log('\n=== VERIFICATION ===\n');
    console.log(`Title: ${created.proposalTitle}`);
    console.log(`Region: ${created.region}`);
    console.log(`Division: ${created.division}`);
    console.log(`Department: ${created.department}`);
    console.log(`isCentralOffice: ${created.isCentralOffice}`);
    console.log(`ConsolidationPath: ${created.consolidationPath}`);
    console.log(`MOOE Records Linked: ${created.sourceProposals.mooe.length}`);
    console.log(`Total Amount: ₱${created.financialSummary.totalAmount.toLocaleString()}`);
    
    await mongoose.disconnect();
    
    console.log('\n✅ Central Office BRD Consolidation CREATED');
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
