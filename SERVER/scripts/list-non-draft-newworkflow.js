require('dotenv').config();
const mongoose = require('mongoose');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

(async function() {
  try {
    const mongo = process.env.MONGODB_URI || process.env.MONGODB_BUDGET_URL;
    if (!mongo) {
      console.error('Set MONGODB_URI or MONGODB_BUDGET_URL');
      process.exit(1);
    }
    await mongoose.connect(mongo, { useNewUrlParser: true, useUnifiedTopology: true });
    const docs = await NewProposalWorkflow.find({ status: { $ne: 'DRAFT' } }).limit(200).lean();
    console.log(`Found ${docs.length} non-DRAFT NewProposalWorkflow docs`);
    docs.forEach(d => {
      const regionString = d.region && (typeof d.region === 'string' ? d.region : (d.region.Region || d.region.regionName || d.region.RegionName || d.region._id));
      console.log(JSON.stringify({ _id: d._id, title: d.title, status: d.status, region: regionString, division: d.division, department: d.department }));
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
