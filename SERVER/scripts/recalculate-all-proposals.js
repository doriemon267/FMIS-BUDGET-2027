const mongoose = require('mongoose');
require('dotenv').config();
const connect = require('../config/mongo_db');
const Proposal = require('../models/Proposal');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');

(async function main(){
  try {
    await connect();
    const count = await Proposal.countDocuments();
    console.log(`Found ${count} proposals. Recalculating totals...`);
    const cursor = Proposal.find().cursor();
    let i = 0, succeeded = 0, failed = 0;
    for await (const p of cursor) {
      i++;      
      try {
        const res = await recalculateAndSaveProposalTotals({ proposalId: p._id });
        succeeded++;
        if (i % 50 === 0) console.log(`Processed ${i}/${count}...`);
      } catch (e) {
        failed++;
        console.error(`Failed to recalc proposal ${p._id}:`, e.message);
      }
    }
    console.log(`Done. Succeeded: ${succeeded}, Failed: ${failed}`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
})();
