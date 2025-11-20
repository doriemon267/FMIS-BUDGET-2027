require('dotenv').config();
const mongoose = require('mongoose');
const BRDConsolidation = require('./models/BRDConsolidation');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    console.log('=== BRD CONSOLIDATION RECORDS ===');
    const records = await BRDConsolidation.find().lean();
    
    records.forEach(record => {
      console.log(`\nProposal: ${record.proposalTitle}`);
      console.log(`  Fiscal Year: ${record.fiscalYear}`);
      console.log(`  Region: ${record.region}`);
      console.log(`  Division: ${record.division}`);
      console.log(`  Amount: ₱${record.proposalAmount.toLocaleString()}`);
    });
    
    console.log('\n=== TESTING FISCAL YEAR FILTER ===');
    
    for (const fy of [2024, 2025, 2026, 2027]) {
      const count = await BRDConsolidation.countDocuments({ fiscalYear: fy });
      console.log(`Fiscal Year ${fy}: ${count} records`);
    }
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
