const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');

async function aggregateSum(model, match, amountExpr) {
  const pipeline = [
    { $match: match },
    { $group: { _id: null, total: amountExpr } }
  ];
  const res = await model.aggregate(pipeline);
  return res?.[0]?.total || 0;
}

// Attempt to sum by proposalId first; if empty, fall back to org keys
async function computeModuleTotals(filterKeys, proposalId) {
  const { fiscalYear, budgetType, region, processBy } = filterKeys;

  // IMPORTANT: Match on the same keys used by edit views to avoid excluding items
  // that are missing department/division. We intentionally DO NOT require
  // department/division here because many legacy rows have empty or null values.
  const baseMatch = { fiscalYear, budgetType, region, processBy };

  // Helper: try with proposalId then fallback
  const tryMatch = async (model, withAmountExpr) => {
    if (proposalId) {
      const byProposal = { proposalId: new mongoose.Types.ObjectId(proposalId) };
      const count = await model.countDocuments(byProposal);
      if (count > 0) {
        return aggregateSum(model, byProposal, withAmountExpr);
      }
    }
    return aggregateSum(model, baseMatch, withAmountExpr);
  };

  // Totals by module
  const incomeTotal = await tryMatch(Income, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  const psTotal = await tryMatch(PersonnelServices, { $sum: { $toDouble: { $ifNull: ["$total", { $ifNull: ["$Total", 0] }] } } });
  const mooeAmountTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  const coAmountTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$cost", { $ifNull: ["$total", 0] }] } } });

  // Subsidy components (should match UI logic for Budget Summary)
  const mooeSubsidyTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$subsidy", 0] } } });
  const coSubsidyTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$subsidy", 0] } } });

  return {
    incomeTotal,
    psTotal,
    mooeAmountTotal,
    coAmountTotal,
    mooeSubsidyTotal,
    coSubsidyTotal
  };
}

/**
 * Recalculate and persist totals onto the Proposal document.
 * Accepts either a proposalId or the identifying org keys.
 */
async function recalculateAndSaveProposalTotals({ proposalId, keys } = {}) {
  let proposal = null;
  if (proposalId) {
    proposal = await Proposal.findById(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);
  } else if (keys) {
    const query = { ...keys };
    proposal = await Proposal.findOne(query).sort({ updatedAt: -1 });
    if (!proposal) throw new Error(`Proposal not found for keys: ${JSON.stringify(keys)}`);
  } else {
    throw new Error('Must provide proposalId or keys');
  }

  const filterKeys = {
    fiscalYear: proposal.fiscalYear,
    budgetType: proposal.budgetType,
    region: proposal.region,
    processBy: proposal.processBy,
    department: proposal.department,
    division: proposal.division
  };

  const {
    incomeTotal,
    psTotal,
    mooeAmountTotal,
    coAmountTotal,
    mooeSubsidyTotal,
    coSubsidyTotal
  } = await computeModuleTotals(filterKeys, proposal._id);

  const expenseSum = (psTotal || 0) + (mooeAmountTotal || 0) + (coAmountTotal || 0);
  const projectedSubsidy = (mooeSubsidyTotal || 0) + (coSubsidyTotal || 0);
  const proposedBudget = expenseSum + (incomeTotal || 0);

  proposal.totalIncome = incomeTotal;
  proposal.totalExpenses = expenseSum;
  proposal.projectedCorporateIncome = incomeTotal;
  // CRITICAL: Projected Subsidy should sum MOOE/CO subsidy columns, not their costs
  proposal.projectedSubsidy = projectedSubsidy;
  proposal.proposedBudget = proposedBudget;
  proposal.updatedAt = new Date();
  await proposal.save();

  return {
    proposalId: proposal._id,
    totals: {
      income: incomeTotal,
      personnel: psTotal,
      mooe: mooeAmountTotal,
      capitalOutlay: coAmountTotal,
      expenses: expenseSum,
      subsidies: projectedSubsidy,
      proposedBudget
    }
  };
}

module.exports = { recalculateAndSaveProposalTotals };
