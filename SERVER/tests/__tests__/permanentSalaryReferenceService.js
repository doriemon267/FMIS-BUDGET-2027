const mongoose = require('mongoose');
jest.mock('../../models/CPSCTemplate', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/SalarySelection', () => ({ find: jest.fn() }));
jest.mock('../../models/CPCSSalaryTable', () => ({ find: jest.fn() }));
const Template = require('../../models/CPSCTemplate');
const SalaryGrade = require('../../models/SalarySelection');
const Current = require('../../models/CPCSSalaryTable');
const { loadSalaryReferences, listSalaryReferences } = require('../../services/permanentSalaryReferenceService');
const baseId = String(new mongoose.Types.ObjectId());
const currentId = String(new mongoose.Types.ObjectId());
beforeEach(() => {
  jest.clearAllMocks();
  Template.findOne.mockImplementation(query => ({ lean: async () => ({ _id: query._id, templateName: query.templateName, fiscalYear: 2027, budgetType: 'Initial' }) }));
  SalaryGrade.find.mockImplementation(query => ({ lean: async () => [{
    salary_grade: '10', job_grade: '5', rates: new Map([['1', query.cpscTemplate === baseId ? 30000 : 33000]]),
  }] }));
  Current.find.mockReturnValue({ lean: async () => [{ salaryGrade: 10, cpcs1JobGrade: 5, step1: 33000 }] });
});
test('loads only rates from the selected active templates, normalizing Map rates and grade strings', async () => {
  const tables = await loadSalaryReferences({ cpcs1Reference: baseId, cpcs2Reference: currentId });
  expect(Template.findOne).toHaveBeenCalledWith({ _id: baseId, isActive: true, templateName: 'CPSC 1' });
  expect(Template.findOne).toHaveBeenCalledWith({ _id: currentId, isActive: true, templateName: 'CPSC 2' });
  expect(SalaryGrade.find).toHaveBeenCalledWith({ cpscTemplate: baseId, isActive: { $ne: false } });
  expect(tables.cpcs1).toMatchObject({ id: baseId, matchBy: 'JG', rows: [{ sg: 10, jg: 5, rates: { 1: 30000 } }] });
  expect(tables.cpcs2.rows[0].rates['1']).toBe(33000);
});
test('supports the current employee salary table as the CPCS 2 reference', async () => {
  const tables = await loadSalaryReferences({ cpcs1Reference: baseId, cpcs2Reference: 'CURRENT_CPCS2' });
  expect(tables.cpcs2).toMatchObject({ matchBy: 'SG', rows: [{ sg: 10, jg: 5, rates: { 1: 33000 } }] });
});
test('rejects missing, inactive, empty tables and invalid grade mapping', async () => {
  const body = { cpcs1Reference: baseId, cpcs2Reference: currentId };
  await expect(loadSalaryReferences({ ...body, cpcs1Reference: '' })).rejects.toThrow('Select a valid CPCS 1');
  await expect(loadSalaryReferences({ ...body, cpcs1MatchBy: 'PG' })).rejects.toThrow('choose SG or JG');
  Template.findOne.mockReturnValue({ lean: async () => null });
  await expect(loadSalaryReferences(body)).rejects.toThrow('missing or inactive');
  Template.findOne.mockReturnValue({ lean: async () => ({ _id: baseId, templateName: 'CPSC 1' }) });
  SalaryGrade.find.mockReturnValue({ lean: async () => [] });
  await expect(loadSalaryReferences(body)).rejects.toThrow('no salary rates');
});
test('lists CPCS 1 and CPCS 2 separately with fiscal year and budget type', async () => {
  Template.find.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [
    { _id: baseId, templateName: 'CPSC 1', fiscalYear: 2027, budgetType: 'Initial' },
    { _id: currentId, templateName: 'CPSC 2', fiscalYear: 2027, budgetType: 'Initial' },
  ] }) }) });
  const options = await listSalaryReferences();
  expect(options.cpcs1).toEqual([{ id: baseId, label: 'CPCS 1 — FY 2027 / Initial' }]);
  expect(options.cpcs2.map(row => row.id)).toEqual([currentId, 'CURRENT_CPCS2']);
});
