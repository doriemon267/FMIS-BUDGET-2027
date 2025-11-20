/**
 * CORRECTING: Move HEAD OFFICE from Central Office back to MARIIS Region
 * Test MARIIS belongs to: MARIIS Region > ADMINISTRATIVE AND FINANCE DIVISION > HEAD OFFICE
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    const brdCollection = db.collection('brd_consolidations');
    
    const consolidationId = new mongoose.Types.ObjectId('691e73a31e3a607805090cb4');
    
    console.log('\n=== CORRECTING HEAD OFFICE CLASSIFICATION ===\n');
    
    // Get current record
    let record = await brdCollection.findOne({ _id: consolidationId });
    console.log('BEFORE - Current state:');
    console.log(`  Region: ${record.region}`);
    console.log(`  Division: ${record.division}`);
    console.log(`  Department: ${record.department}`);
    console.log(`  isCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);
    
    // CORRECTION: Set isCentralOffice to FALSE
    // HEAD OFFICE is under MARIIS Region, not Central Office
    const correctPath = `${record.region}/${record.division}`;
    
    console.log('\nCORRECTION - Updated to:');
    console.log(`  isCentralOffice: false`);
    console.log(`  ConsolidationPath: ${correctPath}`);
    console.log(`\nRationale: MOOE data shows 3 records with Region=MARIIS, Division=ADMINISTRATIVE AND FINANCE DIVISION, Department=HEAD OFFICE`);
    console.log('           HEAD OFFICE is NOT Central Office, it is REGIONAL under MARIIS.\n');
    
    const result = await brdCollection.updateOne(
      { _id: consolidationId },
      {
        $set: {
          isCentralOffice: false,
          consolidationPath: correctPath
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      throw new Error('No document was updated');
    }
    
    // Verify update
    record = await brdCollection.findOne({ _id: consolidationId });
    console.log('✓ Correction successful!\n');
    console.log('AFTER - New state:');
    console.log(`  Region: ${record.region}`);
    console.log(`  Division: ${record.division}`);
    console.log(`  Department: ${record.department}`);
    console.log(`  isCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
