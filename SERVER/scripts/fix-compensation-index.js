/**
 * Fix Script: Remove E11000 Duplicate Key Error on CompensationSettings
 * 
 * Problem: MongoDB collection 'compensationsettings' has an old unique index on (fiscalYear, budgetType)
 * This was from the old schema, but new schema is standalone (no fiscal year)
 * Multiple documents with null values violate the unique constraint
 * 
 * Solution: Drop the old index to allow standalone compensation creation
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://172.16.4.98:27017/fmis_budget";

async function fixCompensationIndex() {
  try {
    console.log("🔧 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected!");

    const db = mongoose.connection.db;
    const collectionName = "compensationsettings";
    
    // Check if collection exists
    const collectionList = await db.listCollections({ name: collectionName }).toArray();
    
    if (collectionList.length === 0) {
      console.log(`\n✅ Collection '${collectionName}' does not exist yet`);
      console.log("✅ This is fine! Fresh start - no problematic indexes to remove");
      console.log("\n🎉 You can now create compensations without E11000 errors!");
    } else {
      const collection = db.collection(collectionName);
      
      // Get all indexes using the newer API
      console.log("\n📋 Current indexes on 'compensationsettings' collection:");
      const indexes = await collection.listIndexes().toArray();
      console.log(indexes.map(idx => ({ name: idx.name, key: idx.key })));

      // Check if the problematic index exists
      const problematicIndexName = "fiscalYear_1_budgetType_1";
      const problematicIndexExists = indexes.some(idx => idx.name === problematicIndexName);
      
      if (problematicIndexExists) {
        console.log(`\n⚠️ Found problematic index: ${problematicIndexName}`);
        console.log("🗑️ Dropping index...");
        
        await collection.dropIndex(problematicIndexName);
        
        console.log(`✅ Index '${problematicIndexName}' dropped successfully!`);
      } else {
        console.log(`\n✅ Index '${problematicIndexName}' does not exist`);
      }

      // Verify indexes after deletion
      console.log("\n📋 Indexes after fix:");
      const newIndexes = await collection.listIndexes().toArray();
      console.log(newIndexes.map(idx => ({ name: idx.name, key: idx.key })));

      console.log("\n🎉 Fix completed! CompensationSettings can now be created independently.");
    }
    
  } catch (error) {
    console.error("❌ Error fixing index:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

fixCompensationIndex();