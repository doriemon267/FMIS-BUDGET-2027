/**
 * Add MOOE Records to MARIIS/HEAD OFFICE Consolidation
 * Link the 3 MOOE records to regional consolidation
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== ADDING MOOE RECORDS TO MARIIS CONSOLIDATION ===\n');
    
    // 1. Get the 3 MOOE records from MARIIS/HEAD OFFICE
    const mooeColl = db.collection('mooeproposals');
    const mooeRecords = await mooeColl.find({
      region: 'MARIIS',
      division: 'ADMINISTRATIVE AND FINANCE DIVISION',
      department: 'HEAD OFFICE'
    }).toArray();
    
    console.log(`Found ${mooeRecords.length} MOOE records from MARIIS/HEAD OFFICE:`);
    mooeRecords.forEach((m, i) => {
      console.log(`  [${i+1}] ID: ${m._id}`);
    });
    
    // 2. Get the MARIIS BRD consolidation record
    const brdColl = db.collection('brd_consolidations');
    const mariisRecord = await brdColl.findOne({
      region: 'MARIIS',
      isCentralOffice: false
    });
    
    console.log(`\nFound MARIIS BRD record: ${mariisRecord._id}`);
    console.log(`Current MOOE records: ${mariisRecord.sourceProposals?.mooe?.length || 0}`);
    console.log(`Current Income records: ${mariisRecord.sourceProposals?.income?.length || 0}`);
    
    // 3. Aggregate financial data from MOOE
    let totalMooeAmount = 0;
    const mooeIds = mooeRecords.map(m => m._id);
    
    mooeRecords.forEach(m => {
      if (m.income) totalMooeAmount += m.income;
      if (m.subsidy) totalMooeAmount += m.subsidy;
    });
    
    console.log(`\nMOOE Records Amount: ₱${totalMooeAmount.toLocaleString()}`);
    
    // 4. Update BRD record to include MOOE records
    const currentIncomeAmount = mariisRecord.financialSummary?.incomeAmount || 0;
    const newTotalAmount = totalMooeAmount + currentIncomeAmount;
    
    const updateResult = await brdColl.updateOne(
      { _id: mariisRecord._id },
      {
        $set: {
          'sourceProposals.mooe': mooeIds,
          'financialSummary.mooeAmount': totalMooeAmount,
          'financialSummary.totalAmount': newTotalAmount,
          'updatedAt': new Date()
        }
      }
    );
    
    console.log(`\nUpdating BRD record...`);
    console.log(`Modified: ${updateResult.modifiedCount} record(s)`);
    
    // 5. Verify update
    const updated = await brdColl.findOne({ _id: mariisRecord._id });
    
    console.log('\n=== VERIFICATION ===\n');
    console.log(`Title: ${updated.proposalTitle}`);
    console.log(`Region: ${updated.region}`);
    console.log(`Path: ${updated.consolidationPath}`);
    console.log(`Source Proposals:`);
    console.log(`  - MOOE Records: ${updated.sourceProposals?.mooe?.length || 0}`);
    console.log(`  - Income Records: ${updated.sourceProposals?.income?.length || 0}`);
    console.log(`Financial Summary:`);
    console.log(`  - MOOE Amount: ₱${updated.financialSummary?.mooeAmount?.toLocaleString() || 0}`);
    console.log(`  - Income Amount: ₱${updated.financialSummary?.incomeAmount?.toLocaleString() || 0}`);
    console.log(`  - Total Amount: ₱${updated.financialSummary?.totalAmount?.toLocaleString() || 0}`);
    
    console.log('\n✅ MOOE records linked to MARIIS consolidation');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
