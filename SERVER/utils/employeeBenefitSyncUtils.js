const Proposal = require('../models/Proposal');
const NewProposalWorkflow = require('../models/NewProposalWorkflow');
const PersonnelServices = require('../models/PersonnelServices');

const LOCKED_WORKFLOW_STATUSES = new Set([
  'Forwarded to Reviewer',
  'Forwarded to Approver',
  'Forwarded to Budget Planning Analyst',
  'Forwarded to Budget Officer',
  'Forwarded to Overall Budget Approver',
  'Finalized',
]);

const LOCKED_PERSONNEL_STATUSES = new Set([
  'Submitted',
  'Division Submitted',
  'Department Verified',
  'Department Submitted',
  'Region Approved',
  'Finalized',
]);

async function getWorkflowStatusFromPersonnel(personnelDoc) {
  if (!personnelDoc) return null;

  if (personnelDoc.workflowRef) {
    const wf = await NewProposalWorkflow.findById(personnelDoc.workflowRef).select('status').lean();
    if (wf?.status) return wf.status;
  }

  if (personnelDoc.proposalId) {
    const proposal = await Proposal.findById(personnelDoc.proposalId).select('workflowRef status').lean();
    if (proposal?.workflowRef) {
      const wf = await NewProposalWorkflow.findById(proposal.workflowRef).select('status').lean();
      if (wf?.status) return wf.status;
    }
    if (proposal?.status) return proposal.status;
  }

  return null;
}

async function isPersonnelRecordLocked(personnelDoc) {
  if (!personnelDoc) return false;

  if (LOCKED_PERSONNEL_STATUSES.has(personnelDoc.status)) {
    return true;
  }

  try {
    const workflowStatus = await getWorkflowStatusFromPersonnel(personnelDoc);
    return LOCKED_WORKFLOW_STATUSES.has(workflowStatus);
  } catch (_err) {
    return false;
  }
}

async function findScopedPersonnelService({
  employeeNumber,
  fiscalYear,
  employeeFullName,
  proposalId,
  workflowRef,
}) {
  if (!employeeNumber || !fiscalYear) return null;

  const attempts = [];
  const base = { employeeNumber, fiscalYear };

  if (proposalId && workflowRef) {
    attempts.push({ ...base, proposalId, workflowRef });
  }
  if (proposalId) {
    attempts.push({ ...base, proposalId });
  }
  if (workflowRef) {
    attempts.push({ ...base, workflowRef });
  }
  if (employeeFullName) {
    attempts.push({ ...base, employeeFullName });
  }
  attempts.push(base);

  for (const query of attempts) {
    const personnel = await PersonnelServices.findOne(query);
    if (personnel) return personnel;
  }

  return null;
}

async function ensurePersonnelRecordEditable(params, sourceLabel = 'benefit update') {
  const personnel = await findScopedPersonnelService(params);
  if (!personnel) return null;

  const locked = await isPersonnelRecordLocked(personnel);
  if (locked) {
    const err = new Error(`Cannot modify ${sourceLabel} because proposal is already in a locked workflow status.`);
    err.statusCode = 403;
    throw err;
  }

  return personnel;
}

module.exports = {
  findScopedPersonnelService,
  ensurePersonnelRecordEditable,
  isPersonnelRecordLocked,
};
