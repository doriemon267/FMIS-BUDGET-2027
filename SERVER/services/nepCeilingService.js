const BudgetCeiling = require('../models/BudgetCeiling');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const Proposal = require('../models/Proposal');
const Tier = require('../models/Tier');
const Region = require('../models/Region');
const PersonnelServices = require('../models/PersonnelServices');
const MooeProposal = require('../models/MooeProposal');
const CapitalOutlay = require('../models/CapitalOutlay');
const { recalculateAndSaveProposalTotals } = require('../utils/recalculateProposalTotals');
const mongoose = require('mongoose');

const MONEY_EPSILON = 0.009;

const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = value => Math.round((finiteNumber(value) + Number.EPSILON) * 100) / 100;

const buildTierTotalsFromItems = ({ items = [], corporateIncome = 0, categoryIncome = {} }) => {
  const subsidyByCategory = {
    personnelServices: 0,
    mooe: 0,
    CapitalOutlay: 0
  };
  let tier1 = 0;
  let tier2 = 0;

  items.forEach(item => {
    const itemTier1 = finiteNumber(item?.tier1);
    const itemTier2 = finiteNumber(item?.tier2);
    const category = String(item?.category || '').trim().toUpperCase();
    tier1 += itemTier1;
    tier2 += itemTier2;
    if (category === 'PERSONNEL') subsidyByCategory.personnelServices += itemTier1 + itemTier2;
    if (category === 'MOOE') subsidyByCategory.mooe += itemTier1 + itemTier2;
    if (category === 'CAPITAL OUTLAY') subsidyByCategory.CapitalOutlay += itemTier1 + itemTier2;
  });

  const subsidies = tier1 + tier2;
  const proposedBudget = finiteNumber(corporateIncome) + subsidies;
  return {
    income: roundMoney(corporateIncome),
    subsidies: roundMoney(subsidies),
    proposedBudget: roundMoney(proposedBudget),
    expenses: roundMoney(proposedBudget),
    personnel: roundMoney(
      subsidyByCategory.personnelServices + finiteNumber(categoryIncome.personnelServices)
    ),
    mooe: roundMoney(subsidyByCategory.mooe + finiteNumber(categoryIncome.mooe)),
    CapitalOutlay: roundMoney(
      subsidyByCategory.CapitalOutlay + finiteNumber(categoryIncome.CapitalOutlay)
    ),
    tier1: roundMoney(tier1),
    tier2: roundMoney(tier2),
    source: 'TIER'
  };
};

const uniqueStrings = values => Array.from(
  new Set(values.map(value => String(value || '').trim()).filter(Boolean))
);

const findLinkedTier = async ({ proposal, ceiling, allocation }) => {
  const direct = await Tier.findOne({ proposalId: proposal._id }).lean();
  if (direct) return direct;

  const regionValues = uniqueStrings([ceiling.region, proposal.region]);
  for (const value of [...regionValues]) {
    if (!mongoose.Types.ObjectId.isValid(value)) continue;
    const region = await Region.findById(value).select('Region regionName RegionName name').lean();
    if (region) {
      regionValues.push(...uniqueStrings([
        region._id,
        region.Region,
        region.regionName,
        region.RegionName,
        region.name
      ]));
    }
  }

  const clauses = [
    { fiscalYear: { $in: uniqueStrings([proposal.fiscalYear, ceiling.fiscalYear]) } },
    { region: { $in: uniqueStrings(regionValues) } }
  ];
  const department = String(allocation.department || proposal.department || '').trim();
  const division = String(allocation.division || proposal.division || '').trim();
  clauses.push(department
    ? { department }
    : { $or: [{ department: '' }, { department: null }, { department: { $exists: false } }] });
  clauses.push(division
    ? { division }
    : { $or: [{ division: '' }, { division: null }, { division: { $exists: false } }] });

  return Tier.findOne({ $and: clauses }).sort({ updatedAt: -1 }).lean();
};

const getTierCategoryIncome = async proposal => {
  const legacy = await Proposal.findOne({ workflowRef: proposal._id }).select('_id').lean();
  const proposalIds = [proposal._id, legacy?._id].filter(Boolean);
  const query = {
    $or: [
      { workflowRef: proposal._id },
      { proposalId: { $in: proposalIds } }
    ]
  };
  const [personnel, mooe, CapitalOutlay] = await Promise.all([
    PersonnelServices.find(query).select('chargedToIncomeAmount').lean(),
    MooeProposal.find(query).select('income').lean(),
    CapitalOutlay.find(query).select('income').lean()
  ]);

  return {
    personnelServices: personnel.reduce(
      (sum, item) => sum + finiteNumber(item.chargedToIncomeAmount),
      0
    ),
    mooe: mooe.reduce((sum, item) => sum + finiteNumber(item.income), 0),
    CapitalOutlay: CapitalOutlay.reduce((sum, item) => sum + finiteNumber(item.income), 0)
  };
};

const persistTierTotals = async ({ proposal, totals }) => {
  await Promise.all([
    NewProposalWorkflow.findByIdAndUpdate(proposal._id, {
      amount: totals.proposedBudget,
      projectedCorporateIncome: totals.income,
      projectedSubsidy: totals.subsidies,
      updatedAt: new Date()
    }),
    Proposal.findOneAndUpdate(
      { workflowRef: proposal._id },
      {
        totalIncome: totals.income,
        totalExpenses: totals.expenses,
        proposedBudget: totals.proposedBudget,
        projectedCorporateIncome: totals.income,
        projectedSubsidy: totals.subsidies,
        updatedAt: new Date()
      }
    )
  ]);
};

const buildNepCeilingComplianceReport = ({ totals = {}, allocation = {} }) => {
  const actual = {
    totalExpenses: roundMoney(totals.expenses),
    proposedBudget: roundMoney(totals.proposedBudget),
    projectedSubsidy: roundMoney(totals.subsidies),
    personnelServices: roundMoney(totals.personnel),
    mooe: roundMoney(totals.mooe),
    CapitalOutlay: roundMoney(totals.CapitalOutlay)
  };
  const caps = {
    totalExpenses: roundMoney(allocation.ceilingAmount),
    projectedSubsidy: roundMoney(allocation.ceilingSubsidy),
    personnelServices: roundMoney(allocation.ceilingBreakdown?.personnelServices),
    mooe: roundMoney(allocation.ceilingBreakdown?.mooe),
    CapitalOutlay: roundMoney(allocation.ceilingBreakdown?.CapitalOutlay)
  };

  const violations = [];
  Object.entries(actual).forEach(([field, value]) => {
    if (!Number.isFinite(value) || value < 0) {
      violations.push({
        field,
        actual: value,
        cap: null,
        excess: 0,
        message: `${field} must be a finite, non-negative amount`
      });
    }
  });

  const targetDifference = roundMoney(caps.totalExpenses - actual.proposedBudget);
  if (Math.abs(targetDifference) > MONEY_EPSILON) {
    violations.push({
      field: 'targetCeilingMismatch',
      actual: actual.proposedBudget,
      cap: caps.totalExpenses,
      excess: targetDifference < 0 ? Math.abs(targetDifference) : 0,
      difference: targetDifference,
      status: targetDifference > 0 ? 'BELOW_CEILING' : 'ABOVE_CEILING',
      message: targetDifference > 0
        ? 'Total NEP Income and Subsidy must be increased to match the BRD ceiling'
        : 'Total NEP Income and Subsidy must be reduced to match the BRD ceiling'
    });
  }

  if (actual.totalExpenses - caps.totalExpenses > MONEY_EPSILON) {
    violations.push({
      field: 'totalExpenses',
      actual: actual.totalExpenses,
      cap: caps.totalExpenses,
      excess: roundMoney(actual.totalExpenses - caps.totalExpenses),
      message: 'Total NEP expenses exceed the BRD ceiling'
    });
  }

  const hasDetailedCeiling =
    caps.personnelServices + caps.mooe + caps.CapitalOutlay > MONEY_EPSILON;
  if (hasDetailedCeiling) {
    ['personnelServices', 'mooe', 'CapitalOutlay'].forEach(field => {
      if (actual[field] - caps[field] > MONEY_EPSILON) {
        violations.push({
          field,
          actual: actual[field],
          cap: caps[field],
          excess: roundMoney(actual[field] - caps[field]),
          message: `${field} exceeds its BRD ceiling component`
        });
      }
    });
  }

  return {
    compliant: violations.length === 0,
    actual,
    caps,
    remaining: {
      totalExpenses: targetDifference,
      targetCeiling: targetDifference,
      personnelServices: roundMoney(caps.personnelServices - actual.personnelServices),
      mooe: roundMoney(caps.mooe - actual.mooe),
      CapitalOutlay: roundMoney(caps.CapitalOutlay - actual.CapitalOutlay)
    },
    hasDetailedCeiling,
    violations
  };
};

const findCeilingAndAllocation = async proposal => {
  let ceiling = null;
  if (proposal.budgetCeilingId) {
    ceiling = await BudgetCeiling.findById(proposal.budgetCeilingId);
  }
  if (!ceiling) {
    ceiling = await BudgetCeiling.findOne({ 'allocations.nepProposalId': proposal._id });
  }
  if (!ceiling) return { ceiling: null, allocation: null };

  const allocationId = proposal.budgetCeilingAllocationId
    ? String(proposal.budgetCeilingAllocationId)
    : null;
  const allocation = ceiling.allocations.find(candidate =>
    (allocationId && String(candidate._id) === allocationId) ||
    String(candidate.nepProposalId || '') === String(proposal._id)
  );

  return { ceiling, allocation: allocation || null };
};

const getNepCeilingContext = async ({ proposalId, recalculate = true }) => {
  const proposal = await NewProposalWorkflow.findById(proposalId);
  if (!proposal) {
    const error = new Error('Proposal not found');
    error.statusCode = 404;
    throw error;
  }
  if (proposal.modelType !== 'NEP') return null;

  const { ceiling, allocation } = await findCeilingAndAllocation(proposal);
  if (!ceiling || !allocation) {
    const error = new Error('No linked BRD ceiling allocation found for this NEP proposal');
    error.statusCode = 409;
    error.code = 'NEP_CEILING_LINK_MISSING';
    throw error;
  }

  let totals = {
    expenses: 0,
    proposedBudget: finiteNumber(proposal.amount),
    subsidies: finiteNumber(proposal.projectedSubsidy),
    personnel: 0,
    mooe: 0,
    CapitalOutlay: 0
  };
  if (recalculate) {
    const recalculated = await recalculateAndSaveProposalTotals({ workflowRef: proposal._id });
    totals = recalculated.totals;

    const tier = await findLinkedTier({ proposal, ceiling, allocation });
    if (tier) {
      const categoryIncome = await getTierCategoryIncome(proposal);
      totals = buildTierTotalsFromItems({
        items: tier.items,
        corporateIncome: recalculated.totals.income,
        categoryIncome
      });
      await persistTierTotals({ proposal, totals });
    }
  }

  return {
    proposal,
    ceiling,
    allocation,
    compliance: buildNepCeilingComplianceReport({ totals, allocation })
  };
};

const assertNepCeilingCompliance = async proposalId => {
  const context = await getNepCeilingContext({ proposalId, recalculate: true });
  if (!context || context.compliance.compliant) return context;

  const error = new Error(
    context.compliance.violations.map(violation => violation.message).join('; ')
  );
  error.statusCode = 422;
  error.code = 'NEP_CEILING_EXCEEDED';
  error.compliance = context.compliance;
  throw error;
};

const syncNepCeilingWorkflowStatus = async ({ proposalId, status }) => {
  const proposal = await NewProposalWorkflow.findById(proposalId);
  if (!proposal || proposal.modelType !== 'NEP') return null;

  const { ceiling, allocation } = await findCeilingAndAllocation(proposal);
  if (!ceiling || !allocation) return null;

  allocation.nepProposalStatus = status;
  if (['DRAFT', 'RETURNED_TO_PREPARER'].includes(status)) {
    allocation.allocationStatus = 'NEP_Created';
  } else if (status !== 'FINALIZED') {
    allocation.allocationStatus = 'NEP_Submitted';
  } else if (status === 'FINALIZED') {
    allocation.allocationStatus = 'NEP_Finalized';
  }

  const hasAllocations = ceiling.allocations.length > 0;
  if (
    hasAllocations &&
    ceiling.status !== 'Archived' &&
    ceiling.allocations.every(candidate => candidate.allocationStatus === 'NEP_Finalized')
  ) {
    ceiling.status = 'Archived';
    ceiling.addChangeHistory('ARCHIVED', {
      remarks: 'All generated NEP proposals have been finalized'
    });
  }

  await ceiling.save();
  return { ceiling, allocation };
};

const serializeNepCeilingContext = context => ({
  ceilingId: context.ceiling._id,
  allocationId: context.allocation._id,
  fiscalYear: context.ceiling.fiscalYear,
  budgetPhase: context.ceiling.budgetPhase,
  ceilingStatus: context.ceiling.status,
  allocationStatus: context.allocation.allocationStatus,
  division: context.allocation.division,
  department: context.allocation.department,
  assignedPreparerNames: context.allocation.assignedPreparerNames || [],
  adjustment: {
    mode: context.allocation.nepAdjustmentMode || context.proposal.nepAdjustmentMode,
    assignedBy: context.allocation.adjustmentAssignedBy,
    assignedByName: context.allocation.adjustmentAssignedByName,
    assignedAt: context.allocation.adjustmentAssignedAt
  },
  initial: {
    amount: finiteNumber(context.allocation.initialRequestAmount),
    subsidy: finiteNumber(context.allocation.initialSubsidy),
    income: finiteNumber(context.allocation.initialIncome),
    breakdown: context.allocation.initialBreakdown
  },
  ceiling: {
    amount: finiteNumber(context.allocation.ceilingAmount),
    subsidy: finiteNumber(context.allocation.ceilingSubsidy),
    income: finiteNumber(context.allocation.ceilingIncome),
    breakdown: context.allocation.ceilingBreakdown,
    remarks: context.allocation.remarks,
    priority: context.allocation.priority
  },
  compliance: context.compliance
});

module.exports = {
  MONEY_EPSILON,
  buildNepCeilingComplianceReport,
  buildTierTotalsFromItems,
  getTierCategoryIncome,
  getNepCeilingContext,
  assertNepCeilingCompliance,
  syncNepCeilingWorkflowStatus,
  serializeNepCeilingContext
};
