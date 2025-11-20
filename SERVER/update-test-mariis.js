/**
 * Update the Test MARIIS proposal with correct organizational information
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
    
    console.log('\n=== UPDATING TEST MARIIS PROPOSAL ===');
    console.log('ID: 691e73a31e3a607805090cb4');
    
    // Get current record
    let record = await brdCollection.findOne({ _id: consolidationId });
    console.log('\nCurrent values:');
    console.log(`  Division: ${record.division}`);
    console.log(`  Department: ${record.department}`);
    console.log(`  isCentralOffice: ${record.isCentralOffice}`);
    console.log(`  ConsolidationPath: ${record.consolidationPath}`);
    
    // Update with correct values
    const newDivision = 'ADMINISTRATIVE AND FINANCE DIVISION';
    const newDepartment = 'HEAD OFFICE';
    const newPath = `${record.region}/${newDivision}`;
    
    console.log('\nUpdating with:');
    console.log(`  Division: ${newDivision}`);
    console.log(`  Department: ${newDepartment}`);
    console.log(`  isCentralOffice: false (Regional)`);
    console.log(`  ConsolidationPath: ${newPath}`);
    
    const result = await brdCollection.updateOne(
      { _id: consolidationId },
      {
        $set: {
          division: newDivision,
          department: newDepartment,
          consolidationPath: newPath
        }
      }
    );
    
    if (result.modifiedCount === 0) {
      throw new Error('No document was updated');
    }
    
    // Verify update
    record = await brdCollection.findOne({ _id: consolidationId });
    console.log('\n✓ Update successful!');
    console.log('\nNew values:');
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
