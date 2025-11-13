/**
 * CRITICAL FIX: Cross-Proposal Data Mixing Prevention
 * 
 * ISSUE: When Budget Approver forwards a proposal to Budget Planning Analyst, the Income
 * and MOOE values were changing/disappearing. This was caused by the recalculation logic
 * falling back to aggregating by organization keys (fiscal year, region, budget type, etc.)
 * when proposalId-based lookups returned no results.
 * 
 * PROBLEM: If multiple proposals existed with the same org keys, ALL their line items
 * would be aggregated together, mixing data across different proposals.
 * 
 * SOLUTION:
 * 1. When proposalId is provided (line 145), ONLY search for records with that proposalId
 * 2. Do NOT fall back to org-key matching for proposalId-based searches
 * 3. Ensure all line item creation endpoints (Income, MOOE, CapitalOutlay, PersonnelServices)
 *    properly set proposalId when creating records
 * 4. This guarantees each proposal only sees its own line items' totals
 * 
 * Changed: tryMatch() logic to remove count-check fallback (lines 79-88)
 * Now: If proposalId provided → search ONLY by proposalId (strict mode)
 *      If proposalId NOT provided → search by org keys (legacy fallback)
 */
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

// Build a resilient organizational match used when module rows lack proposalId
function buildOrgMatch(filterKeys) {
  const {
    fiscalYear,
    budgetType,
    region,
    processBy,
    department,
    division,
    originalDepartment,
    originalDivision
  } = filterKeys || {};
  const clauses = [];

  // Fiscal year resilient match: allow both string and numeric, and both field names
  if (fiscalYear !== undefined) {
    const fyNum = Number(fiscalYear);
    const fyOr = [{ fiscalYear }];
    if (!Number.isNaN(fyNum)) {
      fyOr.push({ fiscalYear: fyNum });
      fyOr.push({ fiscal_year: fyNum });
    }
    fyOr.push({ fiscal_year: fiscalYear });
    clauses.push({ $or: fyOr });
  }

  if (budgetType !== undefined) clauses.push({ budgetType });
  if (region !== undefined) clauses.push({ region });

  const ors = [];
  const addOr = (extra) => {
    const candidate = { ...extra };
    // Remove empty string or undefined values so we don't over-filter
    Object.keys(candidate).forEach((k) => {
      if (candidate[k] === '' || candidate[k] === undefined || candidate[k] === null) {
        delete candidate[k];
      }
    });
    if (Object.keys(candidate).length) ors.push(candidate);
  };

  // Prefer more specific org keys first; many legacy rows only carry one of these
  if (division) addOr({ division });
  if (originalDivision) addOr({ division: originalDivision });
  if (department) addOr({ department });
  if (originalDepartment) addOr({ department: originalDepartment });
  if (processBy) addOr({ processBy });

  if (ors.length > 0) {
    clauses.push({ $or: ors });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

// Attempt to sum by proposalId first; if empty, fall back to resilient org keys
async function computeModuleTotals(filterKeys, proposalId) {
  const orgMatch = buildOrgMatch(filterKeys);

  // Helper: try with proposalId then fallback
  const tryMatch = async (model, withAmountExpr) => {
    if (proposalId) {
      const byProposal = { proposalId: new mongoose.Types.ObjectId(proposalId) };
      // When proposalId is provided, ONLY search by proposalId to prevent cross-proposal data mixing
      // This ensures Budget Planning Analyst doesn't see data from other proposals
      return aggregateSum(model, byProposal, withAmountExpr);
    }
    // Only fall back to orgMatch if proposalId is not provided
    // orgMatch will look by fiscal year, budget type, region, department, division, processBy
    return aggregateSum(model, orgMatch, withAmountExpr);
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
    division: proposal.division,
    originalDepartment: proposal.originalDepartment,
    originalDivision: proposal.originalDivision
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
  await proposal.save({ validateBeforeSave: false });

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
