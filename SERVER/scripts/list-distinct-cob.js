// Read-only script: list distinct cobExpenditures values across models
const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');

async function run() {
  const url = process.env.MONGODB_BUDGET_URL;
  if (!url) {
    console.error('Please set MONGODB_BUDGET_URL environment variable');
    process.exit(1);
  }
  await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const models = [
      { name: 'Proposal', model: Proposal },
      { name: 'PersonnelService', model: PersonnelService },
      { name: 'MooeProposal', model: MooeProposal },
      { name: 'CapitalOutlay', model: CapitalOutlay },
      { name: 'Income', model: Income }
    ];

    for (const m of models) {
      try {
        const distinct = await m.model.distinct('cobExpenditures');
        const cleaned = (distinct || []).filter(Boolean).map(d => String(d));
        console.log(`\n=== ${m.name} distinct cobExpenditures (${cleaned.length}) ===`);
        cleaned.forEach(c => console.log(' -', c));

        // Print top 3 samples and counts for each distinct value
        for (const val of cleaned) {
          const count = await m.model.countDocuments({ cobExpenditures: val });
          console.log(`   ${val} => ${count}`);
        }
      } catch (err) {
        console.error(`Error processing ${m.name}:`, err.message || err);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
