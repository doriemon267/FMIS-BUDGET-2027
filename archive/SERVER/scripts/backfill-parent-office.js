const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Proposal = require('../models/Proposal');
const PersonnelService = require('../models/PersonnelServices');
const MooeProposal = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const Income = require('../models/Income');

const MODELS = [Proposal, PersonnelService, MooeProposal, CapitalOutlay, Income];

async function findChildById(id) {
  for (const M of MODELS) {
    try {
      const doc = await M.findById(id).lean();
      if (doc) return doc;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) { console.error('Set MONGODB_BUDGET_URL'); process.exit(1); }
  const apply = process.argv.includes('--apply');
  await mongoose.connect(mongoUrl);

  // Find parent proposals that have consolidatedProposals but missing office or responsibilityCenter
  const parents = await Proposal.find({
    consolidatedProposals: { $exists: true, $ne: [] },
    $or: [ { office: { $exists: false } }, { office: null }, { office: '' } ]
  }).lean();

  console.log('Found parent proposals missing office:', parents.length);
  const audit = [];

  for (const p of parents) {
    // Try to find a child proposal that has office/department/division
    let found = null;
    if (Array.isArray(p.consolidatedProposals) && p.consolidatedProposals.length) {
      for (const cid of p.consolidatedProposals) {
        const child = await findChildById(cid);
        if (child) {
          const office = child.office || child.department || child.region || null;
          const rc = child.division || child.responsibilityCenter || null;
          if (office || rc) {
            found = { office, responsibilityCenter: rc, childId: String(child._id) };
            break;
          }
        }
      }
    }

    if (!found) {
      // fallback: try to use department/region from parent itself
      const office = p.office || p.department || p.region || null;
      const rc = p.division || null;
      if (office || rc) found = { office, responsibilityCenter: rc, childId: null };
    }

    if (found) {
      console.log(`Parent ${p._id} -> will set office='${found.office}' rc='${found.responsibilityCenter}' from child ${found.childId}`);
      audit.push({ parentId: String(p._id), fromChildId: found.childId, oldOffice: p.office || '', newOffice: found.office || '', oldRC: p.responsibilityCenter || '', newRC: found.responsibilityCenter || '' });
      if (apply) {
        const update = {};
        if (found.office) update.office = found.office;
        if (found.responsibilityCenter) update.responsibilityCenter = found.responsibilityCenter;
        await Proposal.updateOne({ _id: p._id }, { $set: update });
      }
    } else {
      console.log(`Parent ${p._id} -> no candidate child found to derive office/responsibilityCenter`);
    }
  }

  if (apply && audit.length) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, `backfill-parent-office-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`);
    const header = 'parentId,fromChildId,oldOffice,newOffice,oldRC,newRC\n';
    const body = audit.map(r => `${r.parentId},${r.fromChildId || ''},${r.oldOffice},${r.newOffice},${r.oldRC},${r.newRC}`).join('\n');
    fs.writeFileSync(file, header + body);
    console.log('Wrote audit CSV:', file);
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
