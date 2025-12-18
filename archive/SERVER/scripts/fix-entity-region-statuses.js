// fix-entity-region-statuses.js
// Purpose: Convert entity records (PersonnelServices, mooeProposals, CapitalOutlay)
// with status 'Region Approved' -> 'Office Approved' when they are division-origin items
// so they appear in AllProposals division/analyst views.
// Safety: Requires MONGODB_BUDGET_URL env var (no fallback). Creates workflowHistory entry.
// Usage (PowerShell):
// $env:MONGODB_BUDGET_URL='mongodb://172.16.4.98:27017/fmis_budget'
// node .\scripts\fix-entity-region-statuses.js

const mongoose = require('mongoose');
const path = require('path');

async function updateModel(modelPath, modelName) {
  const Model = require(modelPath);
  // Match records that are likely division-origin and marked 'Region Approved'
  const query = {
    status: { $in: ['Region Approved', 'REGION APPROVED', 'region approved'] },
    // division present (to avoid touching pure office/region-level records)
    division: { $exists: true, $ne: null, $ne: '' }
  };

  const total = await Model.countDocuments(query);
  console.log(`${modelName}: found ${total} matching documents`);

  if (total === 0) return { matched: 0, modified: 0, samples: [] };

  const samples = await Model.find(query).limit(5).select('_id division department status workflowLevel').lean();

  // Prepare history entry
  const historyEntry = {
    action: 'MIGRATE_STATUS',
    comment: 'Normalized status from Region Approved -> Office Approved for division-origin entity',
    userId: 'migration-script',
    userName: 'Migration Script',
    timestamp: new Date(),
    previousStatus: 'Region Approved',
    newStatus: 'Office Approved'
  };

  const update = {
    $set: {
      status: 'Office Approved',
      workflowLevel: 'OFFICER',
      lastActionBy: 'Migration Script',
      lastActionDate: new Date(),
      updatedAt: new Date()
    },
    $push: { workflowHistory: historyEntry }
  };

  const result = await Model.updateMany(query, update);

  return { matched: result.matchedCount || result.matched || 0, modified: result.modifiedCount || result.nModified || 0, samples };
}

async function main() {
  try {
    const dbUri = process.env.MONGODB_BUDGET_URL;
    if (!dbUri) {
      console.error('ERROR: MONGODB_BUDGET_URL is not set. Aborting to avoid accidental DB connection.');
      process.exit(1);
    }
    console.log('Connecting to MongoDB at', dbUri);
    await mongoose.connect(dbUri);

    // Resolve model paths
    const personnelPath = path.join(__dirname, '..', 'models', 'PersonnelServices');
    const mooePath = path.join(__dirname, '..', 'models', 'mooeProposals');
    const capitalPath = path.join(__dirname, '..', 'models', 'CapitalOutlay');

    console.log('Checking entity collections...');

    const resPersonnel = await updateModel(personnelPath, 'PersonnelServices');
    const resMOOE = await updateModel(mooePath, 'mooeProposals');
    const resCO = await updateModel(capitalPath, 'CapitalOutlay');

    console.log('\nSummary:');
    console.log(`PersonnelServices: matched=${resPersonnel.matched}, modified=${resPersonnel.modified}`);
    console.log(`mooeProposals: matched=${resMOOE.matched}, modified=${resMOOE.modified}`);
    console.log(`CapitalOutlay: matched=${resCO.matched}, modified=${resCO.modified}`);

    console.log('\nSample documents changed (up to 5 per collection):');
    console.log('PersonnelServices samples:', JSON.stringify(resPersonnel.samples, null, 2));
    console.log('mooeProposals samples:', JSON.stringify(resMOOE.samples, null, 2));
    console.log('CapitalOutlay samples:', JSON.stringify(resCO.samples, null, 2));

    await mongoose.connection.close();
    console.log('\nDone.');
  } catch (err) {
    console.error('Migration error:', err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
}

main();
