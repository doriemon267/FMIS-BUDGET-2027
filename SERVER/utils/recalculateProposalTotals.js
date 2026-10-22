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
const { splitPersonnelFunding } = require('./personnelIncomeAllocation');
const Proposal = require('../models/Proposal');
const Income = require('../models/Income');
const PersonnelServices = require('../models/PersonnelServices');
const MOOE = require('../models/mooeProposals');
const CapitalOutlay = require('../models/CapitalOutlay');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const DiscountSettings = require('../models/DiscountSettings');
const IncomeCategory = require('../models/IncomeCategory');

async function aggregateSum(model, match, amountExpr) {
  const pipeline = [
    { $match: match },
    { $group: { _id: null, total: amountExpr } }
  ];
  const res = await model.aggregate(pipeline);
  return res?.[0]?.total || 0;
}

function toNumberExpr(fieldPath) {
  return {
    $convert: {
      input: { $ifNull: [fieldPath, 0] },
      to: 'double',
      onError: 0,
      onNull: 0
    }
  };
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
async function computeModuleTotals(filterKeys, proposalId, workflowRefId) {
  const orgMatch = buildOrgMatch(filterKeys);

  // Helper: try with proposalId then fallback
  const tryMatch = async (model, withAmountExpr) => {
    if (proposalId || workflowRefId) {
      const orClauses = [];
      if (proposalId) orClauses.push({ proposalId: new mongoose.Types.ObjectId(proposalId) });
      if (workflowRefId) {
        try {
          orClauses.push({ workflowRef: new mongoose.Types.ObjectId(workflowRefId) });
        } catch (_) {}
      }
      
      const byProposal = { $or: orClauses };
      // When proposalId or workflowRefId is provided, ONLY search by those to prevent cross-proposal data mixing
      return aggregateSum(model, byProposal, withAmountExpr);
    }
    // Only fall back to orgMatch if neither proposalId nor workflowRefId is provided
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
  // SPECIAL HANDLING FOR INCOME: Merge linked and relevant unlinked records
  let incomeTotal = 0;
  let rawIncomeRecords = [];
  if (proposalId) {
    const workflowId = new mongoose.Types.ObjectId(proposalId);
    
    // Build a resilient unlinked match for Income (matching IncomeController.js logic)
    // This allows centralized/bulk-uploaded income to be included in proposal totals
    // EXCLUDE system-generated uploads from regular proposal totals
    const unlinkedIncomeMatch = {
      $and: [
        { $or: [{ workflowRef: null }, { workflowRef: { $exists: false } }] },
        { $or: [{ proposalId: null }, { proposalId: { $exists: false } }] },
        { isSystemGenerated: { $ne: true } } // Exclude administrative uploads
      ]
    };

    // Add org keys to unlinked match
    if (filterKeys.fiscalYear) {
      const fyNum = Number(filterKeys.fiscalYear);
      const fyOr = [{ fiscalYear: String(filterKeys.fiscalYear) }];
      if (!Number.isNaN(fyNum)) {
        fyOr.push({ fiscalYear: fyNum });
      }
      unlinkedIncomeMatch.$and.push({ $or: fyOr });
    }
    if (filterKeys.budgetType) unlinkedIncomeMatch.$and.push({ budgetType: filterKeys.budgetType });
    // Add region filter to unlinked match with inclusive search (Global + Proposal Region)
    const searchRegions = [null, ""];
    if (filterKeys.region) {
      const reg = String(filterKeys.region).trim();
      searchRegions.push(reg);
      // Handle common region naming variations
      if (reg === 'Region 10') searchRegions.push('Region X');
      if (reg === 'Region X') searchRegions.push('Region 10');
    }
    unlinkedIncomeMatch.$and.push({ region: { $in: searchRegions } });
    
    // Resilient Division/Department matching: Match if either field matches either provided value
    const orgClauses = [];
    if (filterKeys.division) {
      const div = String(filterKeys.division).trim();
      orgClauses.push({ division: div });
      orgClauses.push({ department: div });
    }
    if (filterKeys.department) {
      const dept = String(filterKeys.department).trim();
      orgClauses.push({ department: dept });
      orgClauses.push({ division: dept });
    }
    // Also include records that have NO division/department (Central/Region level income)
    orgClauses.push({ $and: [{ division: { $in: [null, ""] } }, { department: { $in: [null, ""] } }] });
    
    unlinkedIncomeMatch.$and.push({ $or: orgClauses });

    const incomeOrClauses = [
      { proposalId: workflowId },
      unlinkedIncomeMatch
    ];
    if (workflowRefId) {
      try {
        incomeOrClauses.splice(1, 0, { workflowRef: new mongoose.Types.ObjectId(workflowRefId) });
      } catch (_) {}
    }
    const incomeMatch = { $or: incomeOrClauses };
    incomeTotal = await aggregateSum(Income, incomeMatch, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
    rawIncomeRecords = await Income.find(incomeMatch).populate('incomecategory').lean();
  } else {
    incomeTotal = await aggregateSum(Income, orgMatch, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
    rawIncomeRecords = await Income.find(orgMatch).populate('incomecategory').lean();
  }

  // ✅ NEW: Apply ISF Discount logic (matching IncomeController.js)
  let netIsfAdjustment = 0;
  try {
    const sampleRegion = rawIncomeRecords?.[0]?.region || filterKeys.region || "";
    const settingsQuery = {
      fiscalYear: filterKeys.fiscalYear || rawIncomeRecords?.[0]?.fiscalYear,
      budgetType: filterKeys.budgetType || rawIncomeRecords?.[0]?.budgetType,
      name: "ISF_DISCOUNT"
    };
    if (sampleRegion) {
      const escapedRegion = String(sampleRegion).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      settingsQuery.region = new RegExp(`^${escapedRegion}$`, "i");
    }
    const settings = settingsQuery.fiscalYear && settingsQuery.budgetType
        ? await DiscountSettings.findOne(settingsQuery).lean()
        : null;

    if (settings?.applyDiscount && Number(settings.discountValue) > 0) {
      const normalizeName = (value) =>
        String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^a-z0-9\s\-()/]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const hasNetEntry = rawIncomeRecords.some((item) => {
        const rawCategory =
          item?.incomecategory?.name ||
          item?.incomecategory?.incomeCategoryName ||
          item?.category ||
          item?.categoryName ||
          item?.type ||
          "";
        return normalizeName(rawCategory).includes("net irrigation service fees");
      });

      if (!hasNetEntry) {
        let irrigationGross = 0;
        let currentAccountTotal = 0;

        rawIncomeRecords.forEach((item) => {
          const rawCategory =
            item?.incomecategory?.name ||
            item?.incomecategory?.incomeCategoryName ||
            item?.category ||
            item?.categoryName ||
            item?.type ||
            "";
          const category = normalizeName(rawCategory);
          if (!category.includes("irrigation service fees")) return;
          if (category.includes("net irrigation service fees")) return;

          const amount = Number(item?.amount || 0);
          irrigationGross += amount;

          const subcategory = normalizeName(item?.subcategory || item?.subCategory || "");
          if (subcategory.includes("current account")) {
            currentAccountTotal += amount;
          }
        });

        if (irrigationGross > 0) {
          const discountType = settings.discountType || "percentage";
          const discountValue = Number(settings.discountValue || 0);
          const discountBase = currentAccountTotal > 0 ? currentAccountTotal : irrigationGross;
          const discountAmount =
            discountType === "percentage"
              ? discountBase * (discountValue / 100)
              : Math.min(discountValue, discountBase);
          
          // netIsfAdjustment is the discount amount to be SUBTRACTED from the total
          // (Actually, the UI adds a Net ISF item, but since we already summed all Gross ISF,
          // we should just subtract the discount from the total income calculation)
          netIsfAdjustment = -discountAmount;
          console.log(`[recalculate] Applied ISF Discount: ${discountAmount} (Base: ${discountBase}, Value: ${discountValue}${discountType === 'percentage' ? '%' : ''})`);
        }
      }
    }
  } catch (isfErr) {
    console.warn("[recalculate] ISF Discount calculation failed:", isfErr?.message);
  }
  
  // Apply adjustment to incomeTotal
  incomeTotal += netIsfAdjustment;
  
  const personnelComponentTotalExpr = {
    $add: [
      toNumberExpr("$annualSalary"),
      toNumberExpr("$RATA"),
      toNumberExpr("$PERA"),
      toNumberExpr("$uniformALLOWANCE"),
      toNumberExpr("$productivityIncentive"),
      toNumberExpr("$medical"),
      toNumberExpr("$meal"),
      toNumberExpr("$cashGift"),
      toNumberExpr("$midyearBonus"),
      toNumberExpr("$yearEndBonus"),
      toNumberExpr("$gsisPremium"),
      toNumberExpr("$providentFund"),
      toNumberExpr("$philhealthPremium"),
      toNumberExpr("$pagibigPremium"),
      toNumberExpr("$employeeCompensation"),
      toNumberExpr("$subsistenceAllowanceMDS"),
      toNumberExpr("$subsistenceAllowanceST"),
      toNumberExpr("$overtimePay"),
      toNumberExpr("$loyaltyAward"),
      toNumberExpr("$earnedLeaves"),
      toNumberExpr("$retirementBenefits"),
      toNumberExpr("$terminalLeave"),
      toNumberExpr("$courtAppearance"),
      toNumberExpr("$hazardPay"),
      toNumberExpr("$subsistenceAllowance"),
      toNumberExpr("$additionalMedical"),
      toNumberExpr("$honoraria"),
      toNumberExpr("$childrenAllowance")
    ]
  };
  const personnelLegacyTotalExpr = {
    $convert: {
      input: { $ifNull: ["$total", { $ifNull: ["$Total", 0] }] },
      to: 'double',
      onError: 0,
      onNull: 0
    }
  };
  // NEP editor and ceiling checks use the saved Total as the authoritative
  // personnel amount. Rebuilding it from components can omit legacy or newly
  // added components and make submit validation disagree with the page.
  const personnelLineTotalExpr =
    String(filterKeys.budgetType || '').toUpperCase() === 'NEP'
      ? personnelLegacyTotalExpr
      : {
          $cond: [
            { $gt: [personnelComponentTotalExpr, 0] },
            personnelComponentTotalExpr,
            personnelLegacyTotalExpr
          ]
        };
  // CHANGED: psTotal now INCLUDES all PersonnelServices, including those marked as charged-to-income
  // We handle the charged-to-income deduction separately below
  const psTotal = await tryMatchExcludingChargedToIncome(PersonnelServices, { $sum: personnelLineTotalExpr });
  const mooeAmountTotal = await tryMatch(MOOE, { $sum: { $toDouble: { $ifNull: ["$amount", 0] } } });
  const coAmountTotal = await tryMatch(CapitalOutlay, { $sum: { $toDouble: { $ifNull: ["$cost", { $ifNull: ["$total", 0] }] } } });

  // NEW: Charged-to-Income totals (these move from Personnel Services to Income)
  // Calculate total amount charged to income from personnel services
  let chargedToIncomeTotal = 0;
  if (proposalId || workflowRefId) {
    const orClauses = [];
    if (proposalId) orClauses.push({ proposalId: new mongoose.Types.ObjectId(proposalId) });
    if (workflowRefId) {
      try {
        orClauses.push({ workflowRef: new mongoose.Types.ObjectId(workflowRefId) });
      } catch (_) {}
    }
    const byProposal = { 
      $or: orClauses,
      chargedToIncomeEligible: true 
    };
    chargedToIncomeTotal = await aggregateSum(PersonnelServices, byProposal, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeAmount", 0] } } });
  } else {
    const chargedMatch = { ...orgMatch, chargedToIncomeEligible: true };
    chargedToIncomeTotal = await aggregateSum(PersonnelServices, chargedMatch, { $sum: { $toDouble: { $ifNull: ["$chargedToIncomeAmount", 0] } } });
  }
  // Calculate amount to subtract from subsidy (subsidy of charged-to-income personnel)
  let chargedToIncomeSubsidyTotal = 0;
  if (proposalId || workflowRefId) {
    const orClauses = [];
    if (proposalId) orClauses.push({ proposalId: new mongoose.Types.ObjectId(proposalId) });
    if (workflowRefId) {
      try {
        orClauses.push({ workflowRef: new mongoose.Types.ObjectId(workflowRefId) });
      } catch (_) {}
    }
    const byProposal = { 
      $or: orClauses,
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

  // ADJUSTED: Calculate PersonnelServices subsidy from actual personnel components.
  // Include all personnel items in subsidy projection to align with Personnel Services totals.
  let psSubsidyTotal = 0;
  let psSubsidyMatch = { ...orgMatch };
  
  if (proposalId || workflowRefId) {
    const orClauses = [];
    if (proposalId) orClauses.push({ proposalId: new mongoose.Types.ObjectId(proposalId) });
    if (workflowRefId) {
      try {
        orClauses.push({ workflowRef: new mongoose.Types.ObjectId(workflowRefId) });
      } catch (_) {}
    }
    psSubsidyMatch = { $or: orClauses };
  }

  const psSubsidyExpr = {
    $sum: personnelLineTotalExpr
  };

  psSubsidyTotal = await aggregateSum(PersonnelServices, psSubsidyMatch, psSubsidyExpr);

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
  } = await computeModuleTotals(filterKeys, proposal._id, proposal.workflowRef);

  // FUNDING SPLIT FOR PERSONNEL CHARGED TO INCOME:
  // Personnel cost remains an expense in full. The configured amount is funded
  // by Income, while the remainder is funded by Subsidy.
  //
  // Example: Personnel with Total=₱100,000, chargedToIncomeAmount=₱40,000
  //   - Expense: ₱100,000
  //   - Income funding: ₱40,000
  //   - Subsidy funding: ₱60,000
  
  const personnelFunding = splitPersonnelFunding(psSubsidyTotal, chargedToIncomeTotal);
  const effectiveChargedToIncomeTotal = personnelFunding.incomeAmount;
  const corporateIncomeTotal = incomeTotal || 0;
  const expenseIncomeTotal =
    effectiveChargedToIncomeTotal + (mooeIncomeTotal || 0) + (coIncomeTotal || 0);
  // NEP Corporate Income is a collection source, not an expense allocation.
  // Keep it in the Income module, but only count Income applied to PS/MOOE/CO
  // when validating the NEP expense ceiling.
  const adjustedIncomeTotal =
    String(proposal.budgetType || '').toUpperCase() === 'NEP'
      ? expenseIncomeTotal
      : corporateIncomeTotal + expenseIncomeTotal;
  
  const adjustedPsTotal = (psTotal || 0);
  // Personnel costs are funded by two sources: the configured Income allocation
  // and Subsidy for the balance. Do not count the Income-funded part twice.
  const adjustedPersonnelSubsidy = personnelFunding.subsidyAmount;
  const adjustedSubsidyTotal = adjustedPersonnelSubsidy + (mooeSubsidyTotal || 0) + (coSubsidyTotal || 0);

  const expenseSum = (adjustedPsTotal || 0) + (mooeAmountTotal || 0) + (coAmountTotal || 0);
  const projectedSubsidy = Math.max(0, adjustedSubsidyTotal); // Ensure it doesn't go negative
  // CRITICAL: Proposed Budget formula = Projected Subsidy + Projected Corporate Income (no expenses added)
  const proposedBudget = projectedSubsidy + (adjustedIncomeTotal || 0);

  console.log('[recalculate] FINAL CALCULATION:', {
    proposalId: String(proposal._id),
    corporateIncomeTotal: parseFloat(corporateIncomeTotal).toFixed(2) +
      (String(proposal.budgetType || '').toUpperCase() === 'NEP'
        ? ' (collection only; excluded from expense allocation)'
        : ' (included in projected income)'),
    chargedToIncomeTotal: parseFloat(effectiveChargedToIncomeTotal).toFixed(2),
    psSubsidyTotal: parseFloat(psSubsidyTotal).toFixed(2),
    adjustedPersonnelSubsidy: parseFloat(adjustedPersonnelSubsidy).toFixed(2),
    mooeSubsidyTotal: parseFloat(mooeSubsidyTotal).toFixed(2),
    coSubsidyTotal: parseFloat(coSubsidyTotal).toFixed(2),
    mooeIncomeTotal: parseFloat(mooeIncomeTotal).toFixed(2),
    coIncomeTotal: parseFloat(coIncomeTotal).toFixed(2),
    adjustedSubsidyTotal: parseFloat(adjustedSubsidyTotal).toFixed(2),
    projectedSubsidy: parseFloat(projectedSubsidy).toFixed(2),
    adjustedIncomeTotal: parseFloat(adjustedIncomeTotal).toFixed(2) + ' (PS Charged + MOOE Income + CO Income)',
    'OLD VALUE': proposal.projectedSubsidy,
    'NEW VALUE': projectedSubsidy
  });
  
  // DETAILED BREAKDOWN
  console.log('[recalculate] Subsidy breakdown - Individual personnel records:');
  const allRecords = await PersonnelServices.find({ proposalId: proposal._id })
    .select('_id employeeFullName subsidyAmount chargedToIncomeEligible chargedToIncomeSubsidyAmount')
    .lean();
  console.log('[recalculate] Total records:', allRecords.length);
  for (const rec of allRecords) {
    const recordLabel = rec.employeeFullName || String(rec._id);
    console.log(`  - ${recordLabel}: subsidyAmount=${rec.subsidyAmount}, chargedToIncomeEligible=${rec.chargedToIncomeEligible}, chargedToIncomeSubsidyAmount=${rec.chargedToIncomeSubsidyAmount}`);
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
      chargedToIncome: effectiveChargedToIncomeTotal,
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
