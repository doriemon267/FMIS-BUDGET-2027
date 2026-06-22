require('dotenv').config({ path: '../SERVER/.env' });
const mongoose = require('mongoose');

// Need to match exactly what your OrganizationStructure.js model uses or just run natively using raw mongodb connection
async function migrateRegionIds() {
  try {
    await mongoose.connect(process.env.MONGODB_BUDGET_URL || 'mongodb://superadmin:Today%404040@localhost:27017/fmis_budget?authSource=admin');
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db;
    const mappingsCol = db.collection('departmentdivisionmappings');

    // Find documents that have regionId instead of regionIds
    const mappingsToMigrate = await mappingsCol.find({
      $or: [
        { regionId: { $exists: true, $ne: null } },
        { regionIds: { $exists: false } }
      ]
    }).toArray();

    console.log(`Found ${mappingsToMigrate.length} mappings to migrate.`);

    let migratedCount = 0;
    for (const mapping of mappingsToMigrate) {
      let regionIds = mapping.regionIds || [];
      if (mapping.regionId && !regionIds.some(id => id.toString() === mapping.regionId.toString())) {
        regionIds.push(mapping.regionId);
      }
      
      await mappingsCol.updateOne(
        { _id: mapping._id },
        { 
          $set: { regionIds: regionIds },
          $unset: { regionId: "" }
        }
      );
      migratedCount++;
    }

    console.log(`Successfully migrated ${migratedCount} mappings.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

migrateRegionIds();
