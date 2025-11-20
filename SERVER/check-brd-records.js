require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== CHECKING BRD CONSOLIDATION RECORDS ===');
    const db = mongoose.connection.db;
    
    // Get all BRD consolidation records
    const brdCollection = db.collection('brd_consolidations');
    const allRecords = await brdCollection.find({}).toArray();
    
    console.log(`Total BRD consolidation records: ${allRecords.length}`);
    
    allRecords.forEach((record, i) => {
      console.log(`\n[${i+1}] ${record.proposalTitle}`);
      console.log(`  ID: ${record._id}`);
      console.log(`  Region: ${record.region}`);
      console.log(`  Division: ${record.division}`);
      console.log(`  Department: ${record.department}`);
      console.log(`  isCentralOffice: ${record.isCentralOffice}`);
      console.log(`  Consolidation Path: ${record.consolidationPath}`);
    });
    
    // Now check how many are marked as Central Office
    const coCount = await brdCollection.countDocuments({ isCentralOffice: true });
    console.log(`\nCentral Office records: ${coCount}`);
    
    const coRecords = await brdCollection.find({ isCentralOffice: true }).toArray();
    console.log('\n=== CENTRAL OFFICE RECORDS ===');
    coRecords.forEach((record, i) => {
      console.log(`\n[CO-${i+1}] ${record.proposalTitle}`);
      console.log(`  ID: ${record._id}`);
      console.log(`  Department: ${record.department}`);
      console.log(`  Division: ${record.division}`);
    });
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
