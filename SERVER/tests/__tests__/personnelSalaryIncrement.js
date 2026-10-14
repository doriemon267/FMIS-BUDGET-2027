const mongoose = require('mongoose');
jest.mock('../../models/NewProposalWorkflow', () => ({ findById: jest.fn(), exists: jest.fn() }));
jest.mock('../../utils/recalculateProposalTotals', () => ({ recalculateAndSaveProposalTotals: jest.fn().mockResolvedValue({}) }));
const Workflow = require('../../models/NewProposalWorkflow');
const Personnel = require('../../models/PersonnelServices');
const { updatePersonnelService, bulkSetPersonnelChargedToIncome, resetChargedToIncome } = require('../../controllers/personnel_service_controller');
const { recalculateAndSaveProposalTotals } = require('../../utils/recalculateProposalTotals');

const workflowRef = new mongoose.Types.ObjectId();
const response = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const request = increment => ({
  params: { id: 'person-1' }, body: { monthlySalaryIncrement: increment },
  user: { id: 'preparer' }, hierarchicalFilters: {},
});
const record = () => ({
  _id: 'person-1', workflowRef, status: 'Draft', statusOfAppointment: 'PERMANENT',
  monthlySalary: 35000, annualSalary: 420000, monthlySalaryIncrement: 0,
  save: jest.fn().mockResolvedValue(undefined),
});
beforeEach(() => {
  jest.clearAllMocks();
  Workflow.findById.mockResolvedValue({ modelType: 'Initial', status: 'DRAFT' });
});
afterEach(() => jest.restoreAllMocks());

test('records a salary increment without changing monthly salary and refreshes the exact workflow', async () => {
  const row = record();
  jest.spyOn(Personnel, 'findById').mockResolvedValue(row);
  const update = jest.spyOn(Personnel, 'findByIdAndUpdate').mockResolvedValue({ ...row, monthlySalaryIncrement: 5000 });
  const res = response();
  await updatePersonnelService(request(5000), res);
  expect(update).toHaveBeenCalledWith('person-1', { $set: { monthlySalaryIncrement: 5000 } }, { new: true });
  expect(row.save).toHaveBeenCalled();
  expect(recalculateAndSaveProposalTotals).toHaveBeenCalledWith({ workflowRef });
  expect(res.status).toHaveBeenCalledWith(200);
});

test.each([-1, 35001, Infinity, null, '5000'])('rejects invalid increment %p before writing', async increment => {
  jest.spyOn(Personnel, 'findById').mockResolvedValue(record());
  const update = jest.spyOn(Personnel, 'findByIdAndUpdate');
  const res = response();
  await updatePersonnelService(request(increment), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(update).not.toHaveBeenCalled();
});

test('blocks increment edits on forwarded workflows even if the row still has Draft status', async () => {
  jest.spyOn(Personnel, 'findById').mockResolvedValue(record());
  const update = jest.spyOn(Personnel, 'findByIdAndUpdate');
  Workflow.findById.mockResolvedValue({ modelType: 'Initial', status: 'FORWARDED_TO_REVIEWER' });
  const res = response();
  await updatePersonnelService(request(5000), res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(update).not.toHaveBeenCalled();
});

test('saving an increment automatically reapplies the active rule and preserves all PS costs', async () => {
  Workflow.findById.mockReturnValue({ select: () => ({ lean: async () => ({
    modelType: 'Initial', permanentIncomeAllocation: { mode: 'INCREMENT_ONLY' },
  }) }) });
  const insert = jest.spyOn(Personnel.collection, 'insertOne').mockResolvedValue({ acknowledged: true });
  const doc = new Personnel({
    workflowRef, statusOfAppointment: 'PERMANENT', monthlySalary: 35000,
    annualSalary: 420000, monthlySalaryIncrement: 5000,
    additionalMedical: 3000, providentFund: 42000,
  });
  await doc.save({ validateBeforeSave: false });
  expect(insert).toHaveBeenCalled();
  expect(doc.Total).toBe(465000);
  expect(doc.chargedToIncomeAmount).toBe(60000);
  expect(doc.chargedToSubsidyAmount).toBe(405000);
  expect(doc.monthlySalary).toBe(35000);
});

test('saving an NEP personnel record does not reapply the Initial increment allocation', async () => {
  Workflow.findById.mockReturnValue({ select: () => ({ lean: async () => ({
    modelType: 'NEP', permanentIncomeAllocation: { mode: 'INCREMENT_ONLY' },
  }) }) });
  jest.spyOn(Personnel.collection, 'insertOne').mockResolvedValue({ acknowledged: true });
  const doc = new Personnel({
    workflowRef, statusOfAppointment: 'PERMANENT', monthlySalary: 35000,
    annualSalary: 420000, monthlySalaryIncrement: 5000,
    chargedToIncomeAmount: 20000, chargedToSubsidyAmount: 400000,
  });
  await doc.save({ validateBeforeSave: false });
  expect(doc.chargedToIncomeAmount).toBe(20000);
  expect(doc.chargedToSubsidyAmount).toBe(400000);
});

test('new personnel automatically use saved reference tables and preserve benefits through the real model hook', async () => {
  Workflow.findById.mockReturnValue({ select: () => ({ lean: async () => ({
    modelType: 'Initial', permanentIncomeAllocation: { mode: 'CPCS_DIFFERENCE', referenceTables: {
      cpcs1: { matchBy: 'JG', rows: [{ jg: 5, rates: { 1: 30000 } }] },
      cpcs2: { matchBy: 'SG', rows: [{ sg: 10, rates: { 1: 33000 } }] },
    } },
  }) }) });
  jest.spyOn(Personnel.collection, 'insertOne').mockResolvedValue({ acknowledged: true });
  const doc = new Personnel({
    workflowRef, statusOfAppointment: 'PERMANENT', monthlySalary: 30000, annualSalary: 360000,
    gradelevel_SG: '10', gradelevel_JG: '5', step: '1', additionalMedical: 3000, providentFund: 42000,
  });
  await doc.save({ validateBeforeSave: false });
  expect(doc.monthlySalary).toBe(33000);
  expect(doc.cpcs1MonthlySalary).toBe(30000);
  expect(doc.monthlySalaryIncrement).toBe(3000);
  expect(doc.Total).toBe(441000);
  expect(doc.chargedToIncomeAmount).toBe(36000);
  expect(doc.chargedToSubsidyAmount).toBe(405000);
});

test('the model hook automatically allocates a saved employee step increase and preserves salary', async () => {
  Workflow.findById.mockReturnValue({ select: () => ({ lean: async () => ({
    modelType: 'Initial', permanentIncomeAllocation: { mode: 'STEP_INCREMENT', referenceTables: {
      stepBase: { matchBy: 'SG', rows: [{ sg: 10, rates: { 1: 30000, 2: 31000 } }] },
    } },
  }) }) });
  jest.spyOn(Personnel.collection, 'insertOne').mockResolvedValue({ acknowledged: true });
  const doc = new Personnel({ workflowRef, statusOfAppointment: 'PERMANENT',
    monthlySalary: 31500, annualSalary: 378000, gradelevel_SG: '10', step: '2', PERA: 24000,
  });
  await doc.save({ validateBeforeSave: false });
  expect(doc.monthlySalary).toBe(31500);
  expect(doc.salarySubsidyMonthlyAmount).toBe(30000);
  expect(doc.monthlySalaryIncrement).toBe(1500);
  expect(doc.chargedToIncomeAmount).toBe(18000);
  expect(doc.Total).toBe(402000);
});

test.each(['CPCS_DIFFERENCE', 'STEP_INCREMENT', 'FULL_SALARY'])('manual increment edits cannot override automatic %s', async mode => {
  jest.spyOn(Personnel, 'findById').mockResolvedValue(record());
  const update = jest.spyOn(Personnel, 'findByIdAndUpdate');
  Workflow.findById.mockResolvedValue({ modelType: 'Initial', status: 'DRAFT', permanentIncomeAllocation: { mode } });
  const res = response();
  await updatePersonnelService(request(5000), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(update).not.toHaveBeenCalled();
});

test.each(['CPCS_DIFFERENCE', 'STEP_INCREMENT', 'FULL_SALARY'])('manual income tagging cannot overwrite %s', async mode => {
  jest.spyOn(Personnel, 'findById').mockResolvedValue({ ...record(),
    ...(mode === 'FULL_SALARY' ? { salarySubsidyMonthlyAmount: 0 } : mode === 'STEP_INCREMENT' ? { salarySubsidyMonthlyAmount: 30000 } : { cpcs1MonthlySalary: 30000 }),
  });
  const update = jest.spyOn(Personnel, 'findByIdAndUpdate');
  Workflow.findById.mockResolvedValue({ modelType: 'Initial', permanentIncomeAllocation: { mode } });
  const res = response();
  await bulkSetPersonnelChargedToIncome({ ...request(), body: { items: [{ _id: 'person-1' }], defaultAmount: 10000 } }, res);
  expect(update).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ updatedCount: 0, skipped: [expect.objectContaining({ reason: expect.stringContaining('configured automatically') })] }));
});

test('reset does not erase automatic CPCS funding', async () => {
  jest.spyOn(Personnel, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ workflowRef }] }) });
  Workflow.exists.mockResolvedValue({ _id: workflowRef });
  const update = jest.spyOn(Personnel, 'updateMany');
  const res = response();
  await resetChargedToIncome({ body: { fiscalYear: '2027' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(update).not.toHaveBeenCalled();
});

test('reset guard checks step allocations as well as CPCS differences', async () => {
  const find = jest.spyOn(Personnel, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ workflowRef }] }) });
  Workflow.exists.mockResolvedValue({ _id: workflowRef });
  jest.spyOn(Personnel, 'updateMany');
  await resetChargedToIncome({ body: { fiscalYear: '2027' } }, response());
  expect(find.mock.calls[0][0].$and[1].$or).toContainEqual({ salarySubsidyMonthlyAmount: { $gte: 0 } });
  expect(Workflow.exists).toHaveBeenCalledWith(expect.objectContaining({
    'permanentIncomeAllocation.mode': { $in: ['CPCS_DIFFERENCE', 'STEP_INCREMENT', 'FULL_SALARY'] },
  }));
  expect(Personnel.updateMany).not.toHaveBeenCalled();
});

test('new personnel inherit full salary funding and benefit edits stay in Subsidy', async () => {
  Workflow.findById.mockReturnValue({ select: () => ({ lean: async () => ({
    modelType: 'Initial', permanentIncomeAllocation: { mode: 'FULL_SALARY' },
  }) }) });
  jest.spyOn(Personnel.collection, 'insertOne').mockResolvedValue({ acknowledged: true });
  const update = jest.spyOn(Personnel.collection, 'updateOne').mockResolvedValue({ acknowledged: true, modifiedCount: 1 });
  const doc = new Personnel({ workflowRef, statusOfAppointment: 'PERMANENT',
    monthlySalary: 33000, annualSalary: 396000, PERA: 24000, earnedLeaves: 12000 });
  await doc.save({ validateBeforeSave: false });
  expect(doc.salarySubsidyMonthlyAmount).toBe(0);
  expect(doc.chargedToIncomeAmount).toBe(396000);
  expect(doc.chargedToSubsidyAmount).toBe(36000);
  doc.PERA = 30000;
  await doc.save({ validateBeforeSave: false });
  expect(update).toHaveBeenCalled();
  expect(doc.chargedToIncomeAmount).toBe(396000);
  expect(doc.chargedToSubsidyAmount).toBe(42000);
  expect(doc.Total).toBe(438000);
});
