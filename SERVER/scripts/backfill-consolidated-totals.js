const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Proposal = require('../models/Proposal');

async function main() {
  const apply = process.argv.includes('--apply');
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Please set MONGODB_BUDGET_URL');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

  // Find consolidated parents with zero or missing totals (check common numeric total fields)
  const zeroFilter = {
    isConsolidated: true,
    $and: [
      { $or: [ { proposedBudget: { $exists: false } }, { proposedBudget: 0 } ] },
      { $or: [ { totalExpenses: { $exists: false } }, { totalExpenses: 0 } ] }
    ]
  };
  const parents = await Proposal.find(zeroFilter).lean();
  console.log(`Found ${parents.length} consolidated parent proposals with zero totals`);

  const auditLines = [];
  for (const parent of parents) {
    // If parent lists consolidatedProposals, aggregate totals from those proposals
  let aggregated = null;
  let childIds = [];
    if (Array.isArray(parent.consolidatedProposals) && parent.consolidatedProposals.length > 0) {
      const ids = parent.consolidatedProposals.map(p => p.proposalId).filter(Boolean);
      if (ids.length > 0) {
        const children = await Proposal.find({ _id: { $in: ids } }).lean();
        if (children && children.length > 0) {
          childIds = children.map(c => c._id.toString());
          aggregated = children.reduce((acc, c) => {
            acc.proposedBudget = (acc.proposedBudget || 0) + (c.proposedBudget || 0);
            acc.totalExpenses = (acc.totalExpenses || 0) + (c.totalExpenses || 0);
            acc.totalIncome = (acc.totalIncome || 0) + (c.totalIncome || 0);
            acc.projectedCorporateIncome = (acc.projectedCorporateIncome || 0) + (c.projectedCorporateIncome || 0);
            acc.projectedSubsidy = (acc.projectedSubsidy || 0) + (c.projectedSubsidy || 0);
            // merge categoryBreakdown by summing numeric values when possible
            acc.categoryBreakdown = acc.categoryBreakdown || {};
            if (c.categoryBreakdown) {
              Object.keys(c.categoryBreakdown).forEach(k => {
                const v = Number(c.categoryBreakdown[k]) || 0;
                acc.categoryBreakdown[k] = (acc.categoryBreakdown[k] || 0) + v;
              });
            }
            return acc;
          }, {});
        }
      }
    }

    if (!aggregated) {
      // fallback: try to find one representative child proposal by matching identifiers
      const childFilter = {
        isConsolidated: { $ne: true },
        fiscalYear: parent.fiscalYear,
        budgetType: parent.budgetType,
        department: parent.department,
        region: parent.region,
        $or: [ { division: parent.division }, { originalDivision: parent.division }, { division: { $exists: false } } ],
        $or: [ { proposedBudget: { $gt: 0 } }, { totalExpenses: { $gt: 0 } }, { totalIncome: { $gt: 0 } } ]
      };
      const child = await Proposal.findOne(childFilter).sort({ proposedBudget: -1, totalExpenses: -1 }).lean();
      if (child) {
        childIds = [child._id.toString()];
        aggregated = {
          proposedBudget: child.proposedBudget || 0,
          totalExpenses: child.totalExpenses || 0,
          totalIncome: child.totalIncome || 0,
          projectedCorporateIncome: child.projectedCorporateIncome || 0,
          projectedSubsidy: child.projectedSubsidy || 0,
          categoryBreakdown: child.categoryBreakdown || {}
        };
      }
    }

    if (!aggregated) continue;

  auditLines.push({ parentId: parent._id.toString(), childIds, aggregated });

    if (apply) {
      const update = { $set: {
        proposedBudget: aggregated.proposedBudget || 0,
        totalExpenses: aggregated.totalExpenses || 0,
        totalIncome: aggregated.totalIncome || 0,
        projectedCorporateIncome: aggregated.projectedCorporateIncome || 0,
        projectedSubsidy: aggregated.projectedSubsidy || 0,
        categoryBreakdown: aggregated.categoryBreakdown || {}
      } };
      await Proposal.updateOne({ _id: parent._id }, update);
      console.log(`Applied aggregated totals -> parent ${parent._id}`);
    } else {
      console.log(`Dry-run: would apply aggregated totals to parent ${parent._id} (proposedBudget=${aggregated.proposedBudget}, totalExpenses=${aggregated.totalExpenses})`);
    }
  }

  if (auditLines.length > 0) {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const csvPath = path.join(logsDir, `backfill-consolidated-totals-${new Date().toISOString().slice(0,10)}.csv`);
    const header = 'parentId,childIds,proposedBudget,totalExpenses,totalIncome,projectedCorporateIncome,projectedSubsidy,applied\n';
    const rows = auditLines.map(r => {
      const a = r.aggregated || {};
      return `${r.parentId},"${(r.childIds||[]).join('|')}",${a.proposedBudget||0},${a.totalExpenses||0},${a.totalIncome||0},${a.projectedCorporateIncome||0},${a.projectedSubsidy||0},${apply}`;
    }).join('\n');
    fs.writeFileSync(csvPath, header + rows);
    console.log(`Wrote audit CSV to ${csvPath}`);
  } else {
    console.log('No matching child proposals found to copy totals from');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
