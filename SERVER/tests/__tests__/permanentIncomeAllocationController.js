const mongoose = require('mongoose');
jest.mock('../../models/NewProposalWorkflow', () => ({ findById: jest.fn() }));
jest.mock('../../models/Proposal', () => ({ find: jest.fn() }));
jest.mock('../../models/PersonnelServices', () => ({ find: jest.fn(), bulkWrite: jest.fn() }));
jest.mock('../../utils/recalculateProposalTotals', () => ({ recalculateAndSaveProposalTotals: jest.fn() }));
jest.mock('../../services/permanentSalaryReferenceService', () => ({
  listSalaryReferences: jest.fn().mockResolvedValue({ cpcs1: [], cpcs2: [] }),
  loadSalaryReferences: jest.fn(),
}));
const { loadSalaryReferences } = require('../../services/permanentSalaryReferenceService');

const Workflow = require('../../models/NewProposalWorkflow');
const Proposal = require('../../models/Proposal');
const Personnel = require('../../models/PersonnelServices');
const { recalculateAndSaveProposalTotals } = require('../../utils/recalculateProposalTotals');
const { getPermanentIncomeAllocation, savePermanentIncomeAllocation } = require('../../controllers/permanentIncomeAllocationController');
const { previewPermanentIncomeAllocation } = require('../../controllers/permanentIncomeAllocationController');

const proposalId = new mongoose.Types.ObjectId();
const legacyId = new mongoose.Types.ObjectId();
const request = () => ({
  params: { proposalId: String(proposalId) },
  user: { id: 'owner', Roles: ['BUDGET PREPARER'] },
  headers: { 'x-workflow-ref': String(proposalId) },
  body: { monthlyAmount: 20000 },
});
const response = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
let workflow;

beforeEach(() => {
  jest.clearAllMocks();
  workflow = { _id: proposalId, createdBy: 'owner', status: 'DRAFT', modelType: 'Initial', save: jest.fn() };
  Workflow.findById.mockResolvedValue(workflow);
  Proposal.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: legacyId }] }) });
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'person-1', statusOfAppointment: 'PERMANENT', monthlySalary: 50000, annualSalary: 600000, Total: 750000 },
    { _id: 'person-2', statusOfAppointment: 'Permanent', monthlySalary: 15000, annualSalary: 180000, Total: 230000 },
  ] });
  Personnel.bulkWrite.mockResolvedValue({ modifiedCount: 2 });
  recalculateAndSaveProposalTotals.mockResolvedValue({});
});

test('saving without selected IDs applies to every scoped permanent row and recalculates the same proposal', async () => {
  const res = response();
  await savePermanentIncomeAllocation(request(), res);
  expect(workflow.save).toHaveBeenCalledTimes(1);
  expect(workflow.permanentIncomeAllocation.monthlyAmount).toBe(20000);
  expect(Personnel.find).toHaveBeenCalledWith({
    statusOfAppointment: /^PERMANENT$/i,
    $or: [
      { workflowRef: proposalId },
      { proposalId: { $in: [proposalId, legacyId] }, workflowRef: null },
    ],
  });
  const operations = Personnel.bulkWrite.mock.calls[0][0];
  expect(operations).toHaveLength(2);
  expect(operations[0].updateOne.update.$set).toMatchObject({ chargedToIncomeAmount: 240000, chargedToSubsidyAmount: 510000 });
  expect(operations[1].updateOne.update.$set).toMatchObject({ chargedToIncomeAmount: 180000, chargedToSubsidyAmount: 50000 });
  expect(recalculateAndSaveProposalTotals).toHaveBeenCalledWith({ workflowRef: proposalId });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ monthlyAmount: 20000, updatedCount: 2 }));
});

test('persists a rule even before personnel are added and reloads it', async () => {
  Personnel.find.mockReturnValue({ lean: async () => [] });
  await savePermanentIncomeAllocation(request(), response());
  expect(workflow.save).toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
  const res = response();
  await getPermanentIncomeAllocation(request(), res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ monthlyAmount: 20000 }));
});

test('increment-only saves without a fixed amount and clears charges for personnel without increments', async () => {
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'increased', statusOfAppointment: 'PERMANENT', monthlySalary: 35000, monthlySalaryIncrement: 5000, annualSalary: 420000, Total: 500000 },
    { _id: 'unchanged', statusOfAppointment: 'PERMANENT', monthlySalary: 30000, annualSalary: 360000, Total: 400000, chargedToIncomeAmount: 120000 },
  ] });
  const res = response();
  await savePermanentIncomeAllocation({ ...request(), body: { mode: 'INCREMENT_ONLY' } }, res);
  expect(workflow.permanentIncomeAllocation).toMatchObject({ mode: 'INCREMENT_ONLY', monthlyAmount: null });
  const operations = Personnel.bulkWrite.mock.calls[0][0];
  expect(operations[0].updateOne.update.$set).toMatchObject({ chargedToIncomeAmount: 60000, chargedToSubsidyAmount: 440000 });
  expect(operations[1].updateOne.update.$set).toMatchObject({ chargedToIncomeEligible: false, chargedToIncomeAmount: 0, chargedToSubsidyAmount: 400000 });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'INCREMENT_ONLY', chargedCount: 1, updatedCount: 2 }));
  const reload = response();
  await getPermanentIncomeAllocation(request(), reload);
  expect(reload.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'INCREMENT_ONLY' }));
});

test('all-permanent mode charges rows even without increments', async () => {
  const res = response();
  await savePermanentIncomeAllocation({ ...request(), body: { mode: 'ALL_PERMANENT', monthlyAmount: 10000 } }, res);
  expect(Personnel.bulkWrite.mock.calls[0][0].every(op => op.updateOne.update.$set.chargedToIncomeAmount === 120000)).toBe(true);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'ALL_PERMANENT', chargedCount: 2 }));
});

test('legacy fixed allocations reload as all permanent, and unconfigured proposals default to increment-only', async () => {
  const res = response();
  await getPermanentIncomeAllocation(request(), res);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'INCREMENT_ONLY' }));
  workflow.permanentIncomeAllocation = { monthlyAmount: 10000 };
  await getPermanentIncomeAllocation(request(), res);
  expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'ALL_PERMANENT' }));
});

test('rejects an unknown mode without changing the proposal', async () => {
  const res = response();
  await savePermanentIncomeAllocation({ ...request(), body: { mode: 'UNKNOWN', monthlyAmount: 1000 } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(workflow.save).not.toHaveBeenCalled();
});

test.each([-1, NaN, Infinity, null, '', '20000'])('rejects invalid monthly allocation %p without changes', async monthlyAmount => {
  const res = response();
  await savePermanentIncomeAllocation({ ...request(), body: { monthlyAmount } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test.each(['FORWARDED_TO_REVIEWER', 'FINALIZED', 'MERGED'])('protects proposal status %s', async status => {
  workflow.status = status;
  const res = response();
  await savePermanentIncomeAllocation(request(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(workflow.save).not.toHaveBeenCalled();
});

test('protects another preparer proposal and mismatched active workflow', async () => {
  for (const req of [
    { ...request(), user: { id: 'other', Roles: ['BUDGET PREPARER'] } },
    { ...request(), headers: { 'x-workflow-ref': String(legacyId) } },
  ]) {
    const res = response();
    await savePermanentIncomeAllocation(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  }
  expect(workflow.save).not.toHaveBeenCalled();
});

test('does not overwrite NEP splits or a proposal locked by another user', async () => {
  workflow.modelType = 'NEP';
  let res = response();
  await savePermanentIncomeAllocation(request(), res);
  expect(res.status).toHaveBeenCalledWith(403);
  workflow.modelType = 'Initial';
  workflow.isLocked = true;
  workflow.lockedBy = { userId: 'other' };
  res = response();
  await savePermanentIncomeAllocation(request(), res);
  expect(res.status).toHaveBeenCalledWith(423);
  expect(workflow.save).not.toHaveBeenCalled();
});

function referenceRequest() {
  loadSalaryReferences.mockResolvedValue({
    cpcs1: { id: 'base', matchBy: 'JG', rows: [{ jg: 5, sg: 10, rates: { 1: 30000 } }] },
    cpcs2: { id: 'current', matchBy: 'SG', rows: [
      { sg: 10, rates: { 1: 33000 } }, { sg: 11, rates: { 1: 30000 } },
    ] },
  });
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'increased', employeeFullName: 'Increased', statusOfAppointment: 'PERMANENT', gradelevel_JG: '5', gradelevel_SG: '10', step: '1', monthlySalary: 30000, annualSalary: 360000, PERA: 24000 },
    { _id: 'unchanged', employeeFullName: 'Unchanged', statusOfAppointment: 'PERMANENT', gradelevel_JG: '5', gradelevel_SG: '11', step: '1', monthlySalary: 30000, annualSalary: 360000 },
  ] });
  return { ...request(), body: { mode: 'CPCS_DIFFERENCE', cpcs1Reference: 'base', cpcs2Reference: 'current' } };
}

function stepRequest() {
  loadSalaryReferences.mockResolvedValue({ stepBase: {
    id: 'base', matchBy: 'JG', rows: [{ jg: 5, sg: 10, rates: { 1: 30000, 2: 31000 } }],
  } });
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'step2', employeeFullName: 'Step Two', statusOfAppointment: 'PERMANENT', gradelevel_JG: '5', step: '2', monthlySalary: 31500, annualSalary: 378000, PERA: 24000 },
    { _id: 'step1', employeeFullName: 'Step One', statusOfAppointment: 'PERMANENT', gradelevel_JG: '5', step: '1', monthlySalary: 30000, annualSalary: 360000 },
  ] });
  return { ...request(), body: { mode: 'STEP_INCREMENT', stepReference: 'base', stepMatchBy: 'JG' } };
}

test('previews step increases using saved salaries with a single reference and no writes', async () => {
  const req = stepRequest();
  const res = response();
  await previewPermanentIncomeAllocation(req, res);
  expect(loadSalaryReferences).toHaveBeenCalledWith(req.body);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    updatedCount: 2, chargedCount: 1, monthlyIncome: 1500, monthlySalarySubsidy: 60000,
    personnel: expect.arrayContaining([expect.objectContaining({ id: 'step2', monthlySalary: 31500, salarySubsidy: 30000, income: 1500 })]),
  }));
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test('saves and reloads the step reference while preserving salaries and recalculating proposal funding', async () => {
  const req = stepRequest();
  const res = response();
  await savePermanentIncomeAllocation(req, res);
  expect(workflow.permanentIncomeAllocation).toMatchObject({ mode: 'STEP_INCREMENT', referenceTables: { stepBase: { id: 'base' } } });
  const updates = Personnel.bulkWrite.mock.calls[0][0].map(operation => operation.updateOne.update.$set);
  expect(updates[0]).toMatchObject({ salarySubsidyMonthlyAmount: 30000, chargedToIncomeAmount: 18000, chargedToSubsidyAmount: 384000, Total: 402000 });
  expect(updates[0]).not.toHaveProperty('monthlySalary');
  expect(updates[1]).toMatchObject({ chargedToIncomeEligible: false, chargedToIncomeAmount: 0 });
  expect(recalculateAndSaveProposalTotals).toHaveBeenCalledWith({ workflowRef: proposalId });
  const reload = response();
  await getPermanentIncomeAllocation(req, reload);
  expect(reload.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'STEP_INCREMENT', stepReference: 'base', stepMatchBy: 'JG' }));
});

test('a salary below Step 1 blocks the whole allocation before any writes', async () => {
  const req = stepRequest();
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'bad', employeeFullName: 'Wrong Reference', statusOfAppointment: 'PERMANENT', gradelevel_JG: '5', step: '2', monthlySalary: 29000 },
  ] });
  const res = response();
  await savePermanentIncomeAllocation(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test('previews both salaries for all permanent personnel without writes', async () => {
  const req = referenceRequest();
  const res = response();
  await previewPermanentIncomeAllocation(req, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    updatedCount: 2, chargedCount: 1, monthlyIncome: 3000, monthlySalarySubsidy: 60000,
    personnel: expect.arrayContaining([expect.objectContaining({ id: 'increased', cpcs1: 30000, cpcs2: 33000, income: 3000 })]),
  }));
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test('saves reference snapshots and recalculates salary with one record and two funding sources', async () => {
  const req = referenceRequest();
  const res = response();
  await savePermanentIncomeAllocation(req, res);
  expect(workflow.permanentIncomeAllocation.referenceTables.cpcs1.id).toBe('base');
  const operations = Personnel.bulkWrite.mock.calls[0][0];
  expect(operations[0].updateOne.update.$set).toMatchObject({
    monthlySalary: 33000, annualSalary: 396000, Total: 420000,
    monthlySalaryIncrement: 3000, chargedToIncomeAmount: 36000, chargedToSubsidyAmount: 384000,
    workflowRef: proposalId,
  });
  expect(operations[1].updateOne.update.$set).toMatchObject({ chargedToIncomeAmount: 0, chargedToSubsidyAmount: 360000 });
  expect(recalculateAndSaveProposalTotals).toHaveBeenCalledWith({ workflowRef: proposalId });
});

test('missing rates block the entire save before any personnel or workflow changes', async () => {
  const req = referenceRequest();
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'bad', employeeFullName: 'Missing Grade', statusOfAppointment: 'PERMANENT', step: '1' },
  ] });
  const res = response();
  await savePermanentIncomeAllocation(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Missing Grade') }));
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

function fullSalaryRequest() {
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'full-one', employeeFullName: 'Full One', statusOfAppointment: 'PERMANENT',
      monthlySalary: 50000, annualSalary: 600000, PERA: 24000, earnedLeaves: 5000, gsisPremium: 6000, Total: 635000 },
    { _id: 'full-two', employeeFullName: 'Full Two', statusOfAppointment: 'PERMANENT',
      monthlySalary: 15000, annualSalary: 180000, uniformALLOWANCE: 6000, Total: 186000 },
  ] });
  return { ...request(), body: { mode: 'FULL_SALARY', notes: 'Salary only' } };
}

test('previews all saved salaries without reference tables or writes', async () => {
  const req = fullSalaryRequest();
  const res = response();
  await previewPermanentIncomeAllocation(req, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    updatedCount: 2, chargedCount: 2, monthlyIncome: 65000, monthlySalarySubsidy: 0,
    personnel: expect.arrayContaining([expect.objectContaining({ id: 'full-one', monthlySalary: 50000, salarySubsidy: 0, income: 50000 })]),
  }));
  expect(loadSalaryReferences).not.toHaveBeenCalled();
  expect(workflow.save).not.toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test('saves and reloads full salary funding, with benefits left in Subsidy', async () => {
  const req = fullSalaryRequest();
  await savePermanentIncomeAllocation(req, response());
  expect(workflow.permanentIncomeAllocation).toMatchObject({ mode: 'FULL_SALARY', monthlyAmount: null });
  expect(workflow.permanentIncomeAllocation.referenceTables).toBeUndefined();
  const updates = Personnel.bulkWrite.mock.calls[0][0].map(operation => operation.updateOne.update.$set);
  expect(updates[0]).toMatchObject({ Total: 635000, chargedToIncomeAmount: 600000, chargedToSubsidyAmount: 35000, salarySubsidyMonthlyAmount: 0 });
  expect(updates[1]).toMatchObject({ Total: 186000, chargedToIncomeAmount: 180000, chargedToSubsidyAmount: 6000 });
  expect(updates[0]).not.toHaveProperty('PERA');
  expect(recalculateAndSaveProposalTotals).toHaveBeenCalledWith({ workflowRef: proposalId });
  const res = response();
  await getPermanentIncomeAllocation(req, res);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'FULL_SALARY' }));
});

test('full salary can be configured before any personnel are added', async () => {
  Personnel.find.mockReturnValue({ lean: async () => [] });
  await savePermanentIncomeAllocation({ ...request(), body: { mode: 'FULL_SALARY' } }, response());
  expect(workflow.permanentIncomeAllocation.mode).toBe('FULL_SALARY');
  expect(workflow.save).toHaveBeenCalled();
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
});

test('invalid salary blocks the entire full-salary save before any writes', async () => {
  const req = fullSalaryRequest();
  Personnel.find.mockReturnValue({ lean: async () => [
    { _id: 'valid', statusOfAppointment: 'PERMANENT', monthlySalary: 30000 },
    { _id: 'invalid', statusOfAppointment: 'PERMANENT', monthlySalary: -1 },
  ] });
  const res = response();
  await savePermanentIncomeAllocation(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(Personnel.bulkWrite).not.toHaveBeenCalled();
  expect(workflow.save).not.toHaveBeenCalled();
});
