/**
 * Add Capital Outlay to Central Office Consolidation
 * Update existing BRD record with Capital Outlay record
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== ADDING CAPITAL OUTLAY TO CENTRAL OFFICE CONSOLIDATION ===\n');
    
    // 1. Get the Capital Outlay record
    const capitalColl = db.collection('capitaloutlays');
    const capitalRecords = await capitalColl.find({
      region: 'CENTRAL OFFICE'
    }).toArray();
    
    console.log(`Found ${capitalRecords.length} Capital Outlay record(s) from CENTRAL OFFICE:`);
    capitalRecords.forEach((cap, i) => {
      console.log(`  [${i+1}] ID: ${cap._id}`);
      console.log(`       Item: ${cap.item || 'N/A'}`);
    });
    
    // 2. Get the Central Office BRD consolidation record
    const brdColl = db.collection('brd_consolidations');
    const coRecord = await brdColl.findOne({
      region: 'CENTRAL OFFICE',
      isCentralOffice: true
    });
    
    console.log(`\nFound Central Office BRD record: ${coRecord._id}`);
    console.log(`Current MOOE records: ${coRecord.sourceProposals?.mooe?.length || 0}`);
    console.log(`Current Capital records: ${coRecord.sourceProposals?.capital?.length || 0}`);
    
    // 3. Aggregate financial data from Capital
    let totalCapitalAmount = 0;
    const capitalIds = capitalRecords.map(cap => cap._id);
    
    capitalRecords.forEach(cap => {
      if (cap.estimatedCost) totalCapitalAmount += cap.estimatedCost;
      if (cap.amount) totalCapitalAmount += cap.amount;
    });
    
    console.log(`\nCapital Outlay Records Amount: ₱${totalCapitalAmount.toLocaleString()}`);
    
    // 4. Update BRD record to include Capital records
    const currentMooeAmount = coRecord.financialSummary?.mooeAmount || 0;
    const newTotalAmount = currentMooeAmount + totalCapitalAmount;
    
    const updateResult = await brdColl.updateOne(
      { _id: coRecord._id },
      {
        $set: {
          'sourceProposals.capital': capitalIds,
          'financialSummary.capitalAmount': totalCapitalAmount,
          'financialSummary.totalAmount': newTotalAmount,
          'updatedAt': new Date()
        }
      }
    );
    
    console.log(`\nUpdating BRD record...`);
    console.log(`Modified: ${updateResult.modifiedCount} record(s)`);
    
    // 5. Verify update
    const updated = await brdColl.findOne({ _id: coRecord._id });
    
    console.log('\n=== VERIFICATION ===\n');
    console.log(`Title: ${updated.proposalTitle}`);
    console.log(`Region: ${updated.region}`);
    console.log(`Path: ${updated.consolidationPath}`);
    console.log(`Source Proposals:`);
    console.log(`  - MOOE Records: ${updated.sourceProposals?.mooe?.length || 0}`);
    console.log(`  - Capital Records: ${updated.sourceProposals?.capital?.length || 0}`);
    console.log(`Financial Summary:`);
    console.log(`  - MOOE Amount: ₱${updated.financialSummary?.mooeAmount?.toLocaleString() || 0}`);
    console.log(`  - Capital Amount: ₱${updated.financialSummary?.capitalAmount?.toLocaleString() || 0}`);
    console.log(`  - Total Amount: ₱${updated.financialSummary?.totalAmount?.toLocaleString() || 0}`);
    
    console.log('\n✅ Capital Outlay records linked to Central Office consolidation');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
