/**
 * Add Income Records to MARIIS/HEAD OFFICE Consolidation
 * Update existing BRD record with 4 Income records
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    
    console.log('\n=== ADDING INCOME RECORDS TO MARIIS CONSOLIDATION ===\n');
    
    // 1. Get the 4 Income records from MARIIS/HEAD OFFICE
    const incomeColl = db.collection('incomes');
    const incomeRecords = await incomeColl.find({
      region: 'MARIIS'
    }).toArray();
    
    console.log(`Found ${incomeRecords.length} Income records from MARIIS:`);
    incomeRecords.forEach((inc, i) => {
      console.log(`  [${i+1}] ID: ${inc._id}`);
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
    
    // 3. Aggregate financial data from Income
    let totalIncomeAmount = 0;
    const incomeIds = incomeRecords.map(inc => inc._id);
    
    incomeRecords.forEach(inc => {
      if (inc.income) totalIncomeAmount += inc.income;
      if (inc.subsidy) totalIncomeAmount += inc.subsidy;
    });
    
    console.log(`\nIncome Records Amount: ₱${totalIncomeAmount.toLocaleString()}`);
    
    // 4. Update BRD record to include Income records
    const currentMooeAmount = mariisRecord.financialSummary?.mooeAmount || 0;
    const newTotalAmount = currentMooeAmount + totalIncomeAmount;
    
    const updateResult = await brdColl.updateOne(
      { _id: mariisRecord._id },
      {
        $set: {
          'sourceProposals.income': incomeIds,
          'financialSummary.incomeAmount': totalIncomeAmount,
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
    
    console.log('\n✅ Income records linked to MARIIS consolidation');
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
