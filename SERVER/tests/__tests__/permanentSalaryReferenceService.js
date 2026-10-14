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
let templates;
beforeEach(() => {
  jest.clearAllMocks();
  templates = [
    { _id: baseId, templateName: 'CPSC 1', fiscalYear: 2026, budgetType: 'Initial', isActive: false },
    { _id: currentId, templateName: 'CPSC 2', fiscalYear: 2027, budgetType: 'Initial', isActive: true },
  ];
  Template.findOne.mockImplementation(query => ({ lean: async () => templates.find(template =>
    Object.entries(query).every(([key, value]) => value?.$in ? value.$in.includes(template[key]) : template[key] === value)) || null,
  }));
  Template.find.mockImplementation(query => ({ select: () => ({ sort: () => ({ lean: async () => templates.filter(template =>
    query.templateName.$in.includes(template.templateName) &&
    (query.isActive === undefined || template.isActive === query.isActive)),
  }) }) }));
  SalaryGrade.find.mockImplementation(query => ({ lean: async () => [{
    salary_grade: '10', job_grade: '5', rates: new Map([['1', query.cpscTemplate === baseId ? 30000 : 33000]]),
  }] }));
  Current.find.mockReturnValue({ lean: async () => [{ salaryGrade: 10, cpcs1JobGrade: 5, step1: 33000 }] });
});
test('loads inactive CPCS 1 with active CPCS 2, normalizing Map rates and grade strings', async () => {
  const tables = await loadSalaryReferences({ cpcs1Reference: baseId, cpcs2Reference: currentId });
  expect(Template.findOne).toHaveBeenCalledWith({ _id: baseId, templateName: 'CPSC 1' });
  expect(Template.findOne).toHaveBeenCalledWith({ _id: currentId, templateName: 'CPSC 2' });
  expect(SalaryGrade.find).toHaveBeenCalledWith({ cpscTemplate: baseId, isActive: { $ne: false } });
  expect(tables.cpcs1).toMatchObject({ id: baseId, matchBy: 'JG', rows: [{ sg: 10, jg: 5, rates: { 1: 30000 } }] });
  expect(tables.cpcs2.rows[0].rates['1']).toBe(33000);
});
test('retains historical CPCS 2 as a valid reference after deactivation', async () => {
  templates[1].isActive = false;
  const tables = await loadSalaryReferences({ cpcs1Reference: baseId, cpcs2Reference: currentId });
  expect(tables.cpcs2.label).toContain('(Inactive reference)');
  expect(tables.cpcs2.rows[0].rates['1']).toBe(33000);
});
test.each([[baseId, 'JG', 30000], [currentId, 'SG', 33000], ['CURRENT_CPCS2', 'SG', 33000]])(
  'step allocation loads just the selected reference %s', async (id, matchBy, rate) => {
    const tables = await loadSalaryReferences({ mode: 'STEP_INCREMENT', stepReference: id, stepMatchBy: matchBy });
    expect(Object.keys(tables)).toEqual(['stepBase']);
    expect(tables.stepBase).toMatchObject({ id, matchBy, rows: [{ rates: { 1: rate } }] });
  },
);
test('step allocation rejects unrelated CPCS types and missing references', async () => {
  templates[0].templateName = 'CPSC 3';
  await expect(loadSalaryReferences({ mode: 'STEP_INCREMENT', stepReference: baseId })).rejects.toThrow('wrong CPCS type');
  await expect(loadSalaryReferences({ mode: 'STEP_INCREMENT', stepReference: '' })).rejects.toThrow('Select a valid');
});
test('supports the current employee salary table as the CPCS 2 reference', async () => {
  const tables = await loadSalaryReferences({ cpcs1Reference: baseId, cpcs2Reference: 'CURRENT_CPCS2' });
  expect(tables.cpcs2).toMatchObject({ matchBy: 'SG', rows: [{ sg: 10, jg: 5, rates: { 1: 33000 } }] });
});
test('rejects missing, wrong-type, empty tables and invalid grade mapping', async () => {
  const body = { cpcs1Reference: baseId, cpcs2Reference: currentId };
  await expect(loadSalaryReferences({ ...body, cpcs1Reference: '' })).rejects.toThrow('Select a valid CPCS 1');
  await expect(loadSalaryReferences({ ...body, cpcs1MatchBy: 'PG' })).rejects.toThrow('choose SG or JG');
  await expect(loadSalaryReferences({ ...body, cpcs1Reference: currentId })).rejects.toThrow('wrong CPCS type');
  await expect(loadSalaryReferences({ ...body, cpcs2Reference: baseId })).rejects.toThrow('wrong CPCS type');
  Template.findOne.mockReturnValue({ lean: async () => null });
  await expect(loadSalaryReferences(body)).rejects.toThrow('missing');
  Template.findOne.mockReturnValue({ lean: async () => ({ _id: baseId, templateName: 'CPSC 1' }) });
  SalaryGrade.find.mockReturnValue({ lean: async () => [] });
  await expect(loadSalaryReferences(body)).rejects.toThrow('no salary rates');
});
test('lists historical and active references separately with fiscal year, budget type and inactive label', async () => {
  templates.push({ _id: 'other', templateName: 'CPSC 3', isActive: true });
  const options = await listSalaryReferences();
  expect(options.cpcs1).toEqual([{ id: baseId, label: 'CPCS 1 — FY 2026 / Initial (Inactive reference)' }]);
  expect(options.cpcs2).toEqual([
    { id: currentId, label: 'CPCS 2 — FY 2027 / Initial' },
    { id: 'CURRENT_CPCS2', label: 'CPCS 2 — Employee Salary Table' },
  ]);
});
