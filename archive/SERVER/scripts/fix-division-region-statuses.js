// Migration script: fix-division-region-statuses.js
// Purpose: Convert Proposal.status 'Region Approved' -> 'Office Approved' for proposals
// that originated from DIVISION (originalLevel === 'DIVISION').
// Usage: node scripts/fix-division-region-statuses.js

const mongoose = require('mongoose');
const path = require('path');

async function main() {
  try {
    // Require explicit DB connection string to avoid accidental connections to the wrong DB
    const dbUri = process.env.MONGODB_BUDGET_URL;
    if (!dbUri) {
      console.error('ERROR: MONGODB_BUDGET_URL is not set. Aborting to avoid accidental DB connection.');
      console.error('Set the environment variable to your target MongoDB connection string and re-run the script.');
      console.error("Example (PowerShell): $env:MONGODB_BUDGET_URL='mongodb://host:27017/your_db'; node .\\scripts\\fix-division-region-statuses.js");
      process.exit(1);
    }
    console.log('Connecting to MongoDB at', dbUri);
    // Use modern mongoose connect without deprecated options
    await mongoose.connect(dbUri);

    // Require Proposal model after mongoose connect so model path resolution works
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    const query = {
      originalLevel: 'DIVISION',
      status: { $in: ['Region Approved', 'REGION APPROVED'] }
    };

    console.log('Querying proposals with:', JSON.stringify(query, null, 2));

    const docs = await Proposal.find(query).lean();
    console.log(`Found ${docs.length} proposal(s) matching criteria.`);

    if (docs.length === 0) {
      console.log('No records to update. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Build updates: set status and workflowLevel, and push workflowHistory entry
    const bulkOps = docs.map(doc => {
      const historyEntry = {
        action: 'MIGRATE_STATUS',
        comment: 'Normalized status from Region Approved -> Office Approved for DIVISION-origin proposal',
        userId: 'migration-script',
        userName: 'Migration Script',
        timestamp: new Date(),
        previousStatus: doc.status,
        newStatus: 'Office Approved'
      };

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: { status: 'Office Approved', workflowLevel: 'OFFICER', updatedAt: new Date() },
            $push: { workflowHistory: historyEntry }
          }
        }
      };
    });

    console.log('Performing bulkWrite to update proposals...');
    const result = await Proposal.bulkWrite(bulkOps);

    console.log('bulkWrite result:', JSON.stringify(result, null, 2));
    console.log('Migration complete. Closing DB connection.');

    await mongoose.connection.close();
  } catch (err) {
    console.error('Migration error:', err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
}

main();
