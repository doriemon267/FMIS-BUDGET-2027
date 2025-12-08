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
  // NOTE: This is now DEPRECATED - we want to include all PS records and handle charged-to-income separately
  const tryMatchExcludingChargedToIncome = async (model, withAmountExpr) => {
    if (model.modelName !== 'PersonnelServices') {
      return tryMatch(model, withAmountExpr);
    }
    // For PersonnelServices, INCLUDE all records (even charged-to-income)
    // We'll handle the charged-to-income adjustment separately
    return tryMatch(model, withAmountExpr);
  };

  // Totals by module
  const incomeTotal = await tryMatch(Income, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  // CHANGED: psTotal now INCLUDES all PersonnelServices, including those marked as charged-to-income
  // We handle the charged-to-income deduction separately below
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
  
  // ADDED: Income components for MOOE and Capital Outlay
  const mooeIncomeTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$income", 0] } } });
  const coIncomeTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$income", 0] } } });

  // ADDED: Calculate PersonnelServices subsidy (all including charged-to-income)
  // Logic: Subsidy = Total - ChargedToIncomeAmount
  // This works for both cases:
  // 1. Not charged: ChargedToIncomeAmount is 0, so Subsidy = Total
  // 2. Charged: Subsidy = Total - ChargedToIncomeAmount (the remainder)
  let psSubsidyTotal = 0;
  
  const psSubsidyExpr = {
    $sum: {
      $subtract: [
        { $toDouble: { $ifNull: ["$Total", 0] } },
        { $toDouble: { $ifNull: ["$chargedToIncomeAmount", 0] } }
      ]
    }
  };

  if (proposalId) {
    const byProposal = { 
      proposalId: new mongoose.Types.ObjectId(proposalId)
    };
    psSubsidyTotal = await aggregateSum(PersonnelServices, byProposal, psSubsidyExpr);
  } else {
    const psMatch = { ...orgMatch };
    psSubsidyTotal = await aggregateSum(PersonnelServices, psMatch, psSubsidyExpr);
  }

  return {
    incomeTotal,
    psTotal,
    mooeAmountTotal,
    coAmountTotal,
    mooeSubsidyTotal,
    coSubsidyTotal,
    mooeIncomeTotal, // ADDED
    coIncomeTotal,   // ADDED
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
    // Build query by filtering out undefined/null/empty values
    // Proposals are typically at region level, not department level
    const query = {};
    
    // Core identifying fields (always required)
    if (keys.fiscalYear) query.fiscalYear = keys.fiscalYear;
    if (keys.budgetType) query.budgetType = keys.budgetType;
    if (keys.region) query.region = keys.region;
    
    // Optional fields - only add if provided and non-empty
    if (keys.department && keys.department.trim()) query.department = keys.department;
    if (keys.division && keys.division.trim()) query.division = keys.division;
    
    if (Object.keys(query).length === 0) {
      throw new Error('keys parameter contains no usable fields (all undefined/null)');
    }
    
    console.log('[recalculate] Querying Proposal with keys:', query);
    proposal = await Proposal.findOne(query).sort({ updatedAt: -1 });
    
    if (!proposal) {
      console.log('[recalculate] No proposal found with keys:', query);
      // If not found with these keys, try with just region + fiscal year + budget type
      // (proposals might be at organizational level, not department level)
      const basicQuery = {
        fiscalYear: keys.fiscalYear,
        budgetType: keys.budgetType,
        region: keys.region
      };
      console.log('[recalculate] Retrying with basic keys:', basicQuery);
      proposal = await Proposal.findOne(basicQuery).sort({ updatedAt: -1 });
      
      if (!proposal) {
        throw new Error(`No proposal found matching keys: ${JSON.stringify(query)}`);
      }
      console.log('[recalculate] Found proposal via basic keys:', proposal._id);
    } else {
      console.log('[recalculate] Found proposal via org keys:', proposal._id);
    }
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
    mooeIncomeTotal, // ADDED
    coIncomeTotal,   // ADDED
    psSubsidyTotal,  // ADDED: Include PersonnelServices subsidies
    chargedToIncomeTotal,
    chargedToIncomeSubsidyTotal
  } = await computeModuleTotals(filterKeys, proposal._id);

  // ADJUSTED TOTALS FOR CHARGED-TO-INCOME:
  // Logic: When personnel are marked as "charged to income", their chargedToIncomeAmount
  // moves from expenses (totalExpenses) to income (totalIncome), but the remainder stays as expenses
  // 
  // Example: Personnel with Total=₱100,000, chargedToIncomeAmount=₱40,000
  //   - OLD: Full ₱100,000 was in expenses
  //   - NEW: ₱40,000 moves to income, ₱60,000 stays in expenses
  //
  // 1. psTotal includes ALL PersonnelServices (including charged-to-income)
  // 2. Subtract chargedToIncomeTotal from psTotal to get the remaining expenses
  // 3. Add chargedToIncomeTotal to income
  // 4. Subsidy: deduct the subsidy of charged-to-income personnel
  
  // PROJECTED INCOME = Corporate Income + Personnelservices(charged to income total) + mooe(income) + capitaloutlay(income)
  const adjustedIncomeTotal = (incomeTotal || 0) + (chargedToIncomeTotal || 0) + (mooeIncomeTotal || 0) + (coIncomeTotal || 0);
  
  const adjustedPsTotal = (psTotal || 0) - (chargedToIncomeTotal || 0); // psTotal minus the amounts moved to income
  // NOTE: psSubsidyTotal now correctly calculates subsidy based on charged-to-income status
  const adjustedSubsidyTotal = ((psSubsidyTotal || 0) + (mooeSubsidyTotal || 0) + (coSubsidyTotal || 0));

  const expenseSum = (adjustedPsTotal || 0) + (mooeAmountTotal || 0) + (coAmountTotal || 0);
  const projectedSubsidy = Math.max(0, adjustedSubsidyTotal); // Ensure it doesn't go negative
  // CRITICAL: Proposed Budget formula = Projected Subsidy + Projected Corporate Income (no expenses added)
  const proposedBudget = projectedSubsidy + (adjustedIncomeTotal || 0);

  console.log('[recalculate] FINAL CALCULATION:', {
    proposalId: String(proposal._id),
    psSubsidyTotal: parseFloat(psSubsidyTotal).toFixed(2),
    mooeSubsidyTotal: parseFloat(mooeSubsidyTotal).toFixed(2),
    coSubsidyTotal: parseFloat(coSubsidyTotal).toFixed(2),
    mooeIncomeTotal: parseFloat(mooeIncomeTotal).toFixed(2),
    coIncomeTotal: parseFloat(coIncomeTotal).toFixed(2),
    adjustedSubsidyTotal: parseFloat(adjustedSubsidyTotal).toFixed(2),
    projectedSubsidy: parseFloat(projectedSubsidy).toFixed(2),
    adjustedIncomeTotal: parseFloat(adjustedIncomeTotal).toFixed(2),
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
