const mongoose = require('mongoose');
require('./config/mongo_db'); // Connect to database
async function fixDatabaseIndex() {
  try {
    // Wait for connection
    await new Promise(resolve => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });
    const db = mongoose.connection.db;
    const collection = db.collection('mooeproposals');
    const indexes = await collection.indexes();
    ));
    // Find and drop the problematic index
    const problematicIndex = indexes.find(idx => 
      idx.key && 
      idx.key.uacsCode === 1 && 
      idx.key.fiscalYear === 1 && 
      !idx.key.region
    );
    if (problematicIndex) {
      await collection.dropIndex(problematicIndex.name);
      } else {
      }
    // Create the new index with region
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 }, 
        { unique: true, name: 'uacsCode_fiscalYear_region_unique' }
      );
      } catch (error) {
      if (error.code === 85) {
        } else {
        throw error;
      }
    }
    // Verify the fix
    const newIndexes = await collection.indexes();
    const hasRegionIndex = newIndexes.some(idx => 
      idx.key && 
      idx.key.uacsCode === 1 && 
      idx.key.fiscalYear === 1 && 
      idx.key.region === 1
    );
    if (hasRegionIndex) {
      } else {
      }
    ));
  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error('Please try running this script again or contact support');
  } finally {
    mongoose.connection.close();
  }
}
// Run the fix
fixDatabaseIndex();