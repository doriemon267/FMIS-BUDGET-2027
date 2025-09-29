const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Proposal = require('../models/Proposal');

async function run() {
  const mongoUrl = process.env.MONGODB_BUDGET_URL;
  if (!mongoUrl) {
    console.error('Set MONGODB_BUDGET_URL'); process.exit(1);
  }
  await mongoose.connect(mongoUrl);

  const parents = await Proposal.find({ isConsolidated: true }).lean();
  console.log(`Found ${parents.length} consolidated parent proposals`);

  const rows = [];
  for (const p of parents) {
    const parentId = p._id.toString();
    const title = (p.title || '').replace(/"/g, '""');
    const dept = p.department || '';
    const div = p.division || '';
    const fy = p.fiscalYear || '';
    const bt = p.budgetType || '';
    const parentProposed = p.proposedBudget || 0;
    const parentExpenses = p.totalExpenses || 0;
    const parentIncome = p.totalIncome || 0;
    const childIds = Array.isArray(p.consolidatedProposals) ? p.consolidatedProposals.map(c => c.proposalId).filter(Boolean) : [];

    let children = [];
    if (childIds.length > 0) {
      children = await Proposal.find({ _id: { $in: childIds } }).lean();
    }

    const childProposedSum = children.reduce((s, c) => s + (c.proposedBudget || 0), 0);
    const childExpensesSum = children.reduce((s, c) => s + (c.totalExpenses || 0), 0);
    const childIncomeSum = children.reduce((s, c) => s + (c.totalIncome || 0), 0);

    rows.push({ parentId, title, dept, div, fy, bt, parentProposed, parentExpenses, parentIncome, childIds: childIds.join('|'), childProposedSum, childExpensesSum, childIncomeSum, childCount: childIds.length, updatedAt: p.updatedAt });
  }

  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const csvPath = path.join(logsDir, `consolidated-parents-report-${new Date().toISOString().slice(0,10)}.csv`);
  const header = 'parentId,title,department,division,fiscalYear,budgetType,parentProposed,parentExpenses,parentIncome,childIds,childProposedSum,childExpensesSum,childIncomeSum,childCount,updatedAt\n';
  const content = rows.map(r => `${r.parentId},"${r.title}","${r.dept}","${r.div}",${r.fy},${r.bt},${r.parentProposed},${r.parentExpenses},${r.parentIncome},"${r.childIds}",${r.childProposedSum},${r.childExpensesSum},${r.childIncomeSum},${r.childCount},${r.updatedAt ? new Date(r.updatedAt).toISOString() : ''}`).join('\n');
  fs.writeFileSync(csvPath, header + content);
  console.log(`Wrote report to ${csvPath}`);

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
