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
const NewProposalWorkflow = require('../models/NewProposalWorkflow');

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

  // Helper: like tryMatch but EXCLUDES charged-to-income PersonnelServices
  const tryMatchExcludingChargedToIncome = async (model, withAmountExpr) => {
    if (model.modelName !== 'PersonnelServices') {
      return tryMatch(model, withAmountExpr);
    }
    // For PersonnelServices, exclude chargedToIncomeEligible = true
    if (proposalId) {
      const byProposal = { 
        proposalId: new mongoose.Types.ObjectId(proposalId),
        chargedToIncomeEligible: { $ne: true }  // CRITICAL: Exclude charged-to-income
      };
      return aggregateSum(model, byProposal, withAmountExpr);
    }
    const excludeMatch = { ...orgMatch, chargedToIncomeEligible: { $ne: true } };
    return aggregateSum(model, excludeMatch, withAmountExpr);
  };

  // Totals by module
  const incomeTotal = await tryMatch(Income, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  // CRITICAL: psTotal MUST exclude charged-to-income personnel (they've moved to income)
  const psTotal = await tryMatchExcludingChargedToIncome(PersonnelServices, { $sum: { $toDouble: { $ifNull: ["$total", { $ifNull: ["$Total", 0] }] } } });
  const mooeAmountTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  const coAmountTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$cost", { $ifNull: ["$total", 0] }] } } });

  // NEW: Charged-to-Income totals (these move from Personnel Services to Income)
  // Calculate total amount charged to income from personnel services
  let chargedToIncomeTotal = 0;
  if (proposalId) {
    const byProposal = { 
      proposalId: new mongoose.Types.ObjectId(proposalId),
      chargedToIncomeEligible: true 
    };
    chargedToIncomeTotal = await aggregateSum(PersonnelServices, byProposal, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeAmount", 0] } } });
  } else {
    const chargedMatch = { ...orgMatch, chargedToIncomeEligible: true };
    chargedToIncomeTotal = await aggregateSum(PersonnelServices, chargedMatch, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeAmount", 0] } } });
  }
  // Calculate amount to subtract from subsidy (subsidy of charged-to-income personnel)
  let chargedToIncomeSubsidyTotal = 0;
  if (proposalId) {
    const byProposal = { 
      proposalId: new mongoose.Types.ObjectId(proposalId),
      chargedToIncomeEligible: true 
    };
    chargedToIncomeSubsidyTotal = await aggregateSum(PersonnelServices, byProposal, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeSubsidyAmount", 0] } } });
  } else {
    const chargedMatch = { ...orgMatch, chargedToIncomeEligible: true };
    chargedToIncomeSubsidyTotal = await aggregateSum(PersonnelServices, chargedMatch, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeSubsidyAmount", 0] } } });
  }

  // Subsidy components (should match UI logic for Budget Summary)
  const mooeSubsidyTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$subsidy", 0] } } });
  const coSubsidyTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$subsidy", 0] } } });
  
  // ADDED: Calculate PersonnelServices subsidy (all except charged-to-income ones)
  let psSubsidyTotal = 0;
  if (proposalId) {
    const byProposal = { 
      proposalId: new mongoose.Types.ObjectId(proposalId),
      chargedToIncomeEligible: { $ne: true }  // Exclude charged-to-income
    };
    // DEBUG: Count all PS records and those marked as charged-to-income
    const allPsCount = await PersonnelServices.countDocuments({ proposalId: new mongoose.Types.ObjectId(proposalId) });
    const chargedPsCount = await PersonnelServices.countDocuments({ proposalId: new mongoose.Types.ObjectId(proposalId), chargedToIncomeEligible: true });
    const notChargedPsCount = await PersonnelServices.countDocuments({ proposalId: new mongoose.Types.ObjectId(proposalId), chargedToIncomeEligible: { $ne: true } });
    console.log('[recalculate] DEBUG PS Records for proposalId ' + proposalId + ':', { allPsCount, chargedPsCount, notChargedPsCount, expectedToSum: notChargedPsCount });
    
    // Also list which ones have subsidies
    const recordsWithSubsidy = await PersonnelServices.find(byProposal).select('name subsidyAmount chargedToIncomeEligible chargedToIncomeAmount chargedToIncomeSubsidyAmount').lean();
    const subsidySum = recordsWithSubsidy.reduce((sum, r) => sum + (r.subsidyAmount || 0), 0);
    console.log('[recalculate] DEBUG PS Subsidy records (NOT charged-to-income):', { 
      count: recordsWithSubsidy.length, 
      manualSum: subsidySum,
      records: recordsWithSubsidy.map(r => ({ name: r.name, subsidyAmount: r.subsidyAmount, chargedToIncomeAmount: r.chargedToIncomeAmount }))
    });
    
    // ALSO list the CHARGED-TO-INCOME records to see their subsidies
    const chargedRecords = await PersonnelServices.find({ proposalId: new mongoose.Types.ObjectId(proposalId), chargedToIncomeEligible: true }).select('name subsidyAmount chargedToIncomeEligible chargedToIncomeSubsidyAmount').lean();
    const chargedSubsidySum = chargedRecords.reduce((sum, r) => sum + (r.chargedToIncomeSubsidyAmount || 0), 0);
    console.log('[recalculate] DEBUG PS Charged-to-Income records:', { 
      count: chargedRecords.length,
      chargedSubsidySum: chargedSubsidySum,
      records: chargedRecords.map(r => ({ name: r.name, subsidyAmount: r.subsidyAmount, chargedToIncomeSubsidyAmount: r.chargedToIncomeSubsidyAmount }))
    });
    
    psSubsidyTotal = await aggregateSum(PersonnelServices, byProposal, { $sum: { $toDouble: { $ifNull: ["$subsidyAmount", 0] } } });
  } else {
    const psMatch = { ...orgMatch, chargedToIncomeEligible: { $ne: true } };
    psSubsidyTotal = await aggregateSum(PersonnelServices, psMatch, { $sum: { $toDouble: { $ifNull: ["$subsidyAmount", 0] } } });
  }

  return {
    incomeTotal,
    psTotal,
    mooeAmountTotal,
    coAmountTotal,
    mooeSubsidyTotal,
    coSubsidyTotal,
    psSubsidyTotal,  // ADDED: Include PersonnelServices subsidies
    chargedToIncomeTotal,
    chargedToIncomeSubsidyTotal
  };
}

/**
 * Recalculate and persist totals onto the Proposal document.
 * Accepts either a proposalId, workflowRef, or the identifying org keys.
 */
async function recalculateAndSaveProposalTotals({ proposalId, workflowRef, keys } = {}) {
  let proposal = null;
  
  // Try proposalId first (legacy Proposal._id)
  if (proposalId) {
    proposal = await Proposal.findById(proposalId);
    if (proposal) return await persistProposalTotals(proposal);
  }
  
  // Try workflowRef (NewProposalWorkflow._id)
  if (workflowRef) {
    proposal = await Proposal.findOne({ workflowRef });
    if (proposal) return await persistProposalTotals(proposal);
  }
  
  // Fall back to org keys
  if (keys) {
    // Build query by filtering out undefined/null values
    const query = {};
    if (keys.fiscalYear) query.fiscalYear = keys.fiscalYear;
    if (keys.budgetType) query.budgetType = keys.budgetType;
    if (keys.region) query.region = keys.region;
    if (keys.department) query.department = keys.department;
    if (keys.division) query.division = keys.division;
    
    if (Object.keys(query).length === 0) {
      throw new Error('keys parameter contains no usable fields (all undefined/null)');
    }
    
    console.log('[recalculate] Querying Proposal with keys:', query);
    proposal = await Proposal.findOne(query).sort({ updatedAt: -1 });
    
    if (!proposal) {
      console.log('[recalculate] No proposal found with keys:', query);
      throw new Error(`No proposal found matching keys: ${JSON.stringify(query)}`);
    }
    
    console.log('[recalculate] Found proposal via org keys:', proposal._id);
    return await persistProposalTotals(proposal);
  }
  
  throw new Error('Must provide proposalId, workflowRef, or keys');
}

/**
 * Helper function to calculate and persist proposal totals
 */
async function persistProposalTotals(proposal) {
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
    coSubsidyTotal,
    psSubsidyTotal,  // ADDED: Include PersonnelServices subsidies
    chargedToIncomeTotal,
    chargedToIncomeSubsidyTotal
  } = await computeModuleTotals(filterKeys, proposal._id);

  // ADJUSTED TOTALS FOR CHARGED-TO-INCOME:
  // 1. Income includes charged-to-income amounts (they move from Personnel to Income)
  // 2. Personnel total excludes charged-to-income amounts (already moved to income)
  // 3. Subsidy calculation: psSubsidyTotal EXCLUDES charged-to-income (filtered in query)
  //    So the final subsidy should not include their amounts
  const adjustedIncomeTotal = (incomeTotal || 0) + (chargedToIncomeTotal || 0);
  const adjustedPsTotal = (psTotal || 0); // psTotal already excludes chargedToIncome (it's filtered out in query)
  // NOTE: psSubsidyTotal already excludes charged-to-income personnel, so no deduction needed
  const adjustedSubsidyTotal = ((psSubsidyTotal || 0) + (mooeSubsidyTotal || 0) + (coSubsidyTotal || 0));

  const expenseSum = (adjustedPsTotal || 0) + (mooeAmountTotal || 0) + (coAmountTotal || 0);
  const projectedSubsidy = Math.max(0, adjustedSubsidyTotal); // Ensure it doesn't go negative
  const proposedBudget = expenseSum + (adjustedIncomeTotal || 0);

  console.log('[recalculate] FINAL CALCULATION:', {
    proposalId: String(proposal._id),
    psSubsidyTotal: parseFloat(psSubsidyTotal).toFixed(2),
    mooeSubsidyTotal: parseFloat(mooeSubsidyTotal).toFixed(2),
    coSubsidyTotal: parseFloat(coSubsidyTotal).toFixed(2),
    adjustedSubsidyTotal: parseFloat(adjustedSubsidyTotal).toFixed(2),
    projectedSubsidy: parseFloat(projectedSubsidy).toFixed(2),
    'OLD VALUE': proposal.projectedSubsidy,
    'NEW VALUE': projectedSubsidy
  });
  
  // DETAILED BREAKDOWN
  console.log('[recalculate] Subsidy breakdown - Individual personnel records:');
  const allRecords = await PersonnelServices.find({ proposalId: proposal._id }).select('name subsidyAmount chargedToIncomeEligible chargedToIncomeSubsidyAmount').lean();
  console.log('[recalculate] Total records:', allRecords.length);
  for (const rec of allRecords) {
    console.log(`  - ${rec.name}: subsidyAmount=${rec.subsidyAmount}, chargedToIncomeEligible=${rec.chargedToIncomeEligible}, chargedToIncomeSubsidyAmount=${rec.chargedToIncomeSubsidyAmount}`);
  }

  proposal.totalIncome = adjustedIncomeTotal;
  proposal.totalExpenses = expenseSum;
  proposal.projectedCorporateIncome = adjustedIncomeTotal;
  // CRITICAL: Projected Subsidy is the total expenses (Personnel + MOOE + CapitalOutlay) minus charged-to-income subsidies
  proposal.projectedSubsidy = projectedSubsidy;
  proposal.proposedBudget = proposedBudget;
  proposal.updatedAt = new Date();
  await proposal.save({ validateBeforeSave: false });
  
  console.log('[recalculate] SAVED TO DATABASE:', {
    proposalId: String(proposal._id),
    projectedSubsidy: proposal.projectedSubsidy,
    proposedBudget: proposal.proposedBudget,
    totalExpenses: proposal.totalExpenses,
    totalIncome: proposal.totalIncome
  });

  // Also update the linked NewProposalWorkflow if it exists
  if (proposal.workflowRef || proposal.proposalId) {
    const workflowId = proposal.workflowRef || proposal.proposalId;
    try {
      await NewProposalWorkflow.findByIdAndUpdate(
        workflowId,
        {
          projectedCorporateIncome: adjustedIncomeTotal,
          projectedSubsidy: projectedSubsidy,
          amount: proposedBudget,
          updatedAt: new Date()
        },
        { new: true }
      );
    } catch (err) {
      console.error('Error updating NewProposalWorkflow totals:', err);
      // Don't throw - we successfully saved Proposal, just log workflow update failure
    }
  }

  return {
    proposalId: proposal._id,
    totals: {
      income: adjustedIncomeTotal,
      chargedToIncome: chargedToIncomeTotal,
      personnel: adjustedPsTotal,
      mooe: mooeAmountTotal,
      capitalOutlay: coAmountTotal,
      expenses: expenseSum,
      subsidies: projectedSubsidy,
      chargedToIncomeSubsidiesMinus: chargedToIncomeSubsidyTotal,
      proposedBudget
    }
  };
  
  // Try proposalId first (legacy Proposal._id)
  if (proposalId) {
    proposal = await Proposal.findById(proposalId);
    if (proposal) return await persistProposalTotals(proposal);
  }
  
  // Try workflowRef (NewProposalWorkflow._id)
  if (workflowRef) {
    proposal = await Proposal.findOne({ workflowRef });
    if (proposal) return await persistProposalTotals(proposal);
  }
  
  // Fall back to org keys
  if (keys) {
    const query = { ...keys };
    proposal = await Proposal.findOne(query).sort({ updatedAt: -1 });
    if (proposal) return await persistProposalTotals(proposal);
  }
  
  throw new Error('Must provide proposalId, workflowRef, or keys');
}

module.exports = { recalculateAndSaveProposalTotals };
