// inspect-proposal-statuses-summary.js
// Prints counts by status and originalLevel for proposals, and samples for key statuses

const mongoose = require('mongoose');
const path = require('path');

async function main() {
  try {
    const dbUri = process.env.MONGODB_BUDGET_URL;
    if (!dbUri) {
      console.error('ERROR: MONGODB_BUDGET_URL is not set. Aborting to avoid accidental DB connection.');
      console.error("Set the environment variable and re-run. Example (PowerShell): $env:MONGODB_BUDGET_URL='mongodb://host:27017/your_db'; node .\\scripts\\inspect-proposal-statuses-summary.js");
      process.exit(1);
    }
    console.log('Connecting to MongoDB at', dbUri);
    await mongoose.connect(dbUri);

    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));

    // statuses to inspect
    const interestingStatuses = ['Office Approved','OFFICE APPROVED','Region Approved','REGION APPROVED','Office Submitted','OFFICE SUBMITTED','Division Submitted','DIVISION SUBMITTED','Returned','Finalized'];

    const pipeline = [
      { $match: { status: { $in: interestingStatuses } } },
      { $group: { _id: { status: '$status', originalLevel: '$originalLevel' }, count: { $sum: 1 } } },
      { $sort: { '_id.status': 1, '_id.originalLevel': 1 } }
    ];

    const agg = await Proposal.aggregate(pipeline);
    console.log('Counts by status and originalLevel:');
    console.log(JSON.stringify(agg, null, 2));

    // Print samples for Office Approved / Region Approved
    for (const s of ['Office Approved','Region Approved','Office Submitted']) {
      console.log('\nSamples for status:', s);
      const samples = await Proposal.find({ status: { $in: [s, s.toUpperCase()] } }).limit(5).select('_id title status originalLevel workflowLevel division department createdByUserId approvedByOfficer approvedByManager workflowHistory updatedAt createdAt').lean();
      if (!samples.length) {
        console.log('  (none)');
      } else {
        samples.forEach(doc => console.log(JSON.stringify(doc, null, 2)));
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error inspecting proposals:', err);
    try { await mongoose.connection.close(); } catch (e) {}
    process.exit(1);
  }
}

main();
