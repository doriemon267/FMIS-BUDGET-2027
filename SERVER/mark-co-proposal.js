/**
 * Mark Test MARIIS proposal as Central Office
 * Since it belongs to HEAD OFFICE department
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
    
    console.log('\n=== MARKING TEST MARIIS AS CENTRAL OFFICE ===\n');
    
    // Get current record
    let record = await brdCollection.findOne({ _id: consolidationId });
    console.log('Current state:');
    console.log(`  Department: ${record.department}`);
    console.log(`  isCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);
    
    // Update to Central Office
    const newPath = `CentralOffice/${record.department}`;
    
    console.log('\nUpdating to Central Office:');
    console.log(`  isCentralOffice: true`);
    console.log(`  ConsolidationPath: ${newPath}`);
    
    const result = await brdCollection.updateOne(
      { _id: consolidationId },
      {
        $set: {
          isCentralOffice: true,
          consolidationPath: newPath
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      throw new Error('No document was updated');
    }
    
    // Verify update
    record = await brdCollection.findOne({ _id: consolidationId });
    console.log('\n✓ Update successful!\n');
    console.log('New state:');
    console.log(`  Department: ${record.department}`);
    console.log(`  isCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
