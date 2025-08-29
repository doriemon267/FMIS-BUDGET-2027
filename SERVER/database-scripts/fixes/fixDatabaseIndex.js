const mongoose = require('mongoose');
require('./config/mongo_db'); // Connect to database

async function fixDatabaseIndex() {
  console.log('🔧 Fixing database index for region isolation...');
  
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
    
    console.log('📊 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
    // Find and drop the problematic index
    const problematicIndex = indexes.find(idx => 
      idx.key && 
      idx.key.uacsCode === 1 && 
      idx.key.fiscalYear === 1 && 
      !idx.key.region
    );
    
    if (problematicIndex) {
      console.log('🗑️ Found problematic index:', problematicIndex.name);
      console.log('Dropping old index...');
      await collection.dropIndex(problematicIndex.name);
      console.log('✅ Old index dropped successfully');
    } else {
      console.log('ℹ️ No problematic index found - this is good');
    }
    
    // Create the new index with region
    console.log('📝 Creating new index with region...');
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 }, 
        { unique: true, name: 'uacsCode_fiscalYear_region_unique' }
      );
      console.log('✅ New index created successfully');
    } catch (error) {
      if (error.code === 85) {
        console.log('ℹ️ Index already exists - this is fine');
      } else {
        throw error;
      }
    }
    
    // Verify the fix
    console.log('📊 Verifying updated indexes...');
    const newIndexes = await collection.indexes();
    const hasRegionIndex = newIndexes.some(idx => 
      idx.key && 
      idx.key.uacsCode === 1 && 
      idx.key.fiscalYear === 1 && 
      idx.key.region === 1
    );
    
    if (hasRegionIndex) {
      console.log('🎉 SUCCESS! Database index is now fixed for region isolation');
      console.log('✅ You can now save the same UACS codes for different regions');
    } else {
      console.log('❌ Something went wrong - region index not found');
    }
    
    console.log('\nUpdated indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key })));
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.error('Please try running this script again or contact support');
  } finally {
    console.log('🔌 Closing database connection...');
    mongoose.connection.close();
  }
}

// Run the fix
fixDatabaseIndex();