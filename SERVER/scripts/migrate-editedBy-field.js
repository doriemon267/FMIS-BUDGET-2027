/**
 * Migration script to populate missing editedBy field in BudgetOfficerEdit documents
 * This handles documents created before the editedBy field was added
 * 
 * This script:
 * 1. Finds all BudgetOfficerEdit documents without editedBy.userId
 * 2. Sets editedBy to a default structure with placeholders
 * 3. Logs results for verification
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const BudgetOfficerEdit = require('../models/BudgetOfficerEdit');

async function migrateEditedByField() {
  try {
    // Connect to database
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.DB_CONNECTION_STRING || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find documents with missing or incomplete editedBy
    console.log('\n📊 Searching for documents with missing editedBy field...');
    const query = {
      $or: [
        { editedBy: { $exists: false } },
        { 'editedBy.userId': { $exists: false } }
      ]
    };

    const docsToUpdate = await BudgetOfficerEdit.find(query);
    console.log(`📝 Found ${docsToUpdate.length} documents that need migration`);

    if (docsToUpdate.length === 0) {
      console.log('✅ No documents need migration - all editedBy fields are present');
      await mongoose.disconnect();
      return;
    }

    // Update each document
    let successCount = 0;
    let errorCount = 0;

    for (const doc of docsToUpdate) {
      try {
        // Use processBy field as fallback for userName if not present
        const defaultEditedBy = {
          userId: `UNKNOWN_${doc._id.toString().substring(0, 8)}`,
          userName: doc.processBy || 'Unknown User',
          email: null,
          role: 'BUDGET_OFFICER' // Default role assumption
        };

        // Update the document
        await BudgetOfficerEdit.findByIdAndUpdate(
          doc._id,
          { $set: { editedBy: defaultEditedBy } },
          { new: true }
        );

        console.log(`✅ Updated document ${doc._id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error updating document ${doc._id}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully updated: ${successCount} documents`);
    console.log(`❌ Failed: ${errorCount} documents`);

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const stillMissing = await BudgetOfficerEdit.find({
      $or: [
        { editedBy: { $exists: false } },
        { 'editedBy.userId': { $exists: false } }
      ]
    });

    if (stillMissing.length === 0) {
      console.log('✅ Verification successful - all editedBy fields are now present!');
    } else {
      console.log(`⚠️  Warning: ${stillMissing.length} documents still missing editedBy field`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Migration complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateEditedByField().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});