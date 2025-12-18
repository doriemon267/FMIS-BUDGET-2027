const mongoose = require('mongoose');
const path = require('path');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node get-proposal-by-id.js <proposalId>');
  process.exit(2);
}

const MONGODB = process.env.MONGODB_BUDGET_URL || 'mongodb://localhost:27017/fmis_budget';

(async () => {
  try {
    await mongoose.connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true });
    // Ensure models path resolution
    const Proposal = require(path.join(__dirname, '..', 'models', 'Proposal'));
    const p = await Proposal.findById(id).lean();
    if (!p) {
      console.log('Proposal not found');
      process.exit(0);
    }
    console.log(JSON.stringify(p, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error fetching proposal:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
