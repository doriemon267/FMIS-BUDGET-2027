const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');

const MODELS = [
  { name: 'PersonnelServices', model: PersonnelService },
  { name: 'MooeProposals', model: MooeProposal },
  { name: 'CapitalOutlay', model: CapitalOutlay },
  { name: 'Income', model: Income }
];

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) { console.error('Set MONGODB_BUDGET_URL'); process.exit(1); }
  const apply = process.argv.includes('--apply');
  await mongoose.connect(mongoUrl);

  const targetStatuses = ['Office Approved', 'OFFICE APPROVED'];
  const auditRows = [];

  for (const entry of MODELS) {
    const { name, model } = entry;
    const docs = await model.find({ status: { $in: targetStatuses } }).limit(200).lean();
    const count = await model.countDocuments({ status: { $in: targetStatuses } });
    console.log(`Model: ${name} -> matched: ${count}`);
    if (docs.length) {
      console.log(' Sample ids:', docs.slice(0,10).map(d => String(d._id)).join(', '));
    }

    if (count > 0 && apply) {
      const res = await model.updateMany(
        { status: { $in: targetStatuses } },
        { $set: { status: 'Office Submitted' } }
      );
      console.log(` Applied update for ${name}: modifiedCount=${res.modifiedCount}`);

      // collect audit rows (fetch changed docs to record old status -> new)
      const changedDocs = await model.find({ status: 'Office Submitted' }).sort({ updatedAt: -1 }).limit(res.modifiedCount).lean();
      changedDocs.forEach(d => {
        auditRows.push({ model: name, _id: String(d._id), oldStatus: 'Office Approved', newStatus: 'Office Submitted', updatedAt: (d.updatedAt || new Date()).toISOString() });
      });
    }
  }

  if (apply && auditRows.length) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, `status-change-officeapproved-to-submitted-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`);
    const header = 'model,_id,oldStatus,newStatus,updatedAt\n';
    const body = auditRows.map(r => `${r.model},${r._id},${r.oldStatus},${r.newStatus},${r.updatedAt}`).join('\n');
    fs.writeFileSync(file, header + body);
    console.log('Wrote audit CSV:', file);
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
