// inspect-region-statuses.js
// Prints counts and samples of proposals with status 'Region Approved' (case-insensitive)

const mongoose = require('mongoose');
const path = require('path');

async function main() {
  try {
    const dbUri = process.env.MONGODB_BUDGET_URL;
    if (!dbUri) {
      console.error('ERROR: MONGODB_BUDGET_URL is not set. Aborting to avoid accidental DB connection.');
      console.error("Set the environment variable and re-run. Example (PowerShell): $env:MONGODB_BUDGET_URL='mongodb://host:27017/your_db'; node .\\scripts\\inspect-region-statuses.js");
      process.exit(1);
    }
    console.log('Connecting to MongoDB at', dbUri);
    await mongoose.connect(dbUri);

    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    const statuses = ['Region Approved', 'REGION APPROVED', 'region approved'];
    const query = { status: { $in: statuses } };

    const total = await Proposal.countDocuments(query);
    console.log(`Total proposals with Region Approved (any case): ${total}`);

    // group by originalLevel
    const agg = await Proposal.aggregate([
      { $match: query },
      { $group: { _id: { originalLevel: '$originalLevel' }, count: { $sum: 1 } } }
    ]);
    console.log('Counts by originalLevel:');
    console.log(JSON.stringify(agg, null, 2));

    const samples = await Proposal.find(query).limit(5).select('_id title status originalLevel workflowLevel division department createdByUserId approvedByOfficer approvedByManager workflowHistory updatedAt createdAt').lean();

    console.log('Sample documents (up to 5):');
    samples.forEach(s => console.log(JSON.stringify(s, null, 2)));

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error inspecting proposals:', err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
}

main();
