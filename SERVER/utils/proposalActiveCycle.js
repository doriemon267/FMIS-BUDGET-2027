const Settings = require('../models/Settings');

const WORKFLOW_PROGRESSION_ACTIONS = new Set([
  'submit-to-reviewer',
  'submit-to-approver',
  'submit-to-analyst',
  'forward-to-officer',
  'forward-to-manager',
  'finalize',
]);

const normalizeBudgetType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized.includes('NEP')) return 'NEP';
  if (normalized.includes('INITIAL')) return 'INITIAL';
  return normalized;
};

const normalizeFiscalYear = (value) => String(value ?? '').trim();

const isWorkflowProgressionAction = (action) =>
  WORKFLOW_PROGRESSION_ACTIONS.has(String(action || '').trim().toLowerCase());

const isProposalInActiveCycle = (proposal, activeSettings) => {
  const proposalBudgetType = normalizeBudgetType(
    proposal?.modelType || proposal?.budgetType
  );
  const activeBudgetType = normalizeBudgetType(
    activeSettings?.budgetType || activeSettings?.modelType
  );
  const proposalFiscalYear = normalizeFiscalYear(
    proposal?.fiscalYear ?? proposal?.FiscalYear ?? proposal?.fy
  );
  const activeFiscalYear = normalizeFiscalYear(
    activeSettings?.fiscalYear ?? activeSettings?.FiscalYear ?? activeSettings?.fy
  );

  return Boolean(
    proposalBudgetType &&
      activeBudgetType &&
      proposalFiscalYear &&
      activeFiscalYear &&
      proposalBudgetType === activeBudgetType &&
      proposalFiscalYear === activeFiscalYear
  );
};

const createCycleError = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = 'INACTIVE_BUDGET_CYCLE';
  return error;
};

const assertProposalInActiveCycleForProgression = async (
  proposal,
  action,
  SettingsModel = Settings
) => {
  // Return actions remain available so an outdated proposal can be routed back
  // for correction; only forward workflow progression is cycle-gated.
  if (!isWorkflowProgressionAction(action)) return;

  const activeSettings = await SettingsModel.findOne({ isActive: true })
    .select('fiscalYear budgetType')
    .lean();

  if (!activeSettings) {
    throw createCycleError(
      'Workflow submission is unavailable because no active budget cycle is configured.'
    );
  }

  if (!isProposalInActiveCycle(proposal, activeSettings)) {
    const proposalType = normalizeBudgetType(proposal?.modelType || proposal?.budgetType) || 'Unknown';
    const proposalYear = normalizeFiscalYear(proposal?.fiscalYear) || 'Unknown';
    const activeType = normalizeBudgetType(activeSettings?.budgetType) || 'Unknown';
    const activeYear = normalizeFiscalYear(activeSettings?.fiscalYear) || 'Unknown';

    throw createCycleError(
      `This ${proposalType} FY ${proposalYear} proposal cannot progress while the active budget cycle is ${activeType} FY ${activeYear}.`
    );
  }
};

module.exports = {
  WORKFLOW_PROGRESSION_ACTIONS,
  isWorkflowProgressionAction,
  isProposalInActiveCycle,
  assertProposalInActiveCycleForProgression,
};
