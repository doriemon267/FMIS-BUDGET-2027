const Personnel = require('../../models/PersonnelServices');
const { personnelItemFunding, summarizePersonnelFunding } = require('../../utils/personnelReportFunding');
const { _private: { processPersonnelServicesData } } = require('../../controllers/comprehensiveReportsController');
const { getConsolidatedPersonnelServicesData } = require('../../controllers/consolidatedPersonnelServicesController');
const rows = () => [
  { region: 'Region I', statusOfAppointment: 'PERMANENT', budgetType: 'INITIAL',
    cpcs1MonthlySalary: 30000, cpcs2MonthlySalary: 33000, annualSalary: 396000,
    PERA: 24000, subsistenceAllowanceMDS: 6000, subsistenceAllowanceST: 7000, courtAppearance: 8000, providentFund: 9000,
    Total: 450000, chargedToIncomeEligible: true, chargedToIncomeAmount: 36000 },
  { region: 'Region II', statusOfAppointment: 'Permanent', budgetType: 'INITIAL',
    cpcs1MonthlySalary: 30000, cpcs2MonthlySalary: 30000, annualSalary: 360000,
    Total: 360000, chargedToIncomeEligible: false, chargedToIncomeAmount: 0 },
];
afterEach(() => jest.restoreAllMocks());

test('report funding assigns the CPCS increase to salary, with benefits funded by subsidy', () => {
  expect(personnelItemFunding(rows()[0], 'annualSalary', 396000)).toMatchObject({ incomeAmount: 36000, subsidyAmount: 360000 });
  expect(personnelItemFunding(rows()[0], 'PERA', 24000)).toMatchObject({ incomeAmount: 0, subsidyAmount: 24000 });
  expect(summarizePersonnelFunding(rows())).toEqual({ total: 810000, income: 36000, subsidy: 774000, salaryTotal: 756000, salaryIncome: 36000, salarySubsidy: 720000 });
});

test('NEP component funding takes precedence over the original CPCS salary snapshot', () => {
  const row = { ...rows()[0], budgetType: 'NEP', nepAllocations: { PERA: { income: 10000, subsidy: 14000 } } };
  expect(personnelItemFunding(row, 'PERA', 24000)).toMatchObject({ incomeAmount: 10000, subsidyAmount: 14000 });
});

test('legacy records retain proportional funding and explicit zero income stays zero', () => {
  expect(personnelItemFunding({ Total: 100000, chargedToIncomeAmount: 20000 }, 'PERA', 10000))
    .toMatchObject({ incomeAmount: 2000, subsidyAmount: 8000 });
  expect(personnelItemFunding({ Total: 100000, chargedToIncomeEligible: false, chargedToIncomeAmount: 20000 }, 'annualSalary', 100000))
    .toMatchObject({ incomeAmount: 0, subsidyAmount: 100000 });
});

test.each([{}, { regions: ['Region I', 'Region II'] }])('comprehensive report and PDF data reconcile every component and both funding sources: %p', async query => {
  const result = await processPersonnelServicesData(rows(), query);
  const categories = result.categories || result.regions[0].categories;
  expect(categories['1'].items.a.income).toBe(36000);
  expect(categories['2'].items.a.income).toBe(0);
  expect(categories['2'].items.k.amount).toBe(13000);
  expect(categories['2'].items.v.amount).toBe(8000);
  expect(result.totalEmployees).toBe(2);
  expect(result.sectionTotal).toBe(810000);
  expect(result.sectionTotalIncome).toBe(36000);
  expect(result.sectionTotalSubsidy).toBe(774000);
});

test.each([undefined, ['Region I', 'Region II']])('consolidated PS totals and funding summary agree for region selection %p', async regions => {
  jest.spyOn(Personnel, 'find').mockReturnValue({ lean: async () => rows() });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await getConsolidatedPersonnelServicesData({ query: { fiscalYear: '2027', budgetType: 'INITIAL', regions }, user: { Roles: ['SUPER_ADMIN'] } }, res);
  const result = res.json.mock.calls[0][0];
  expect(result.success).toBe(true);
  expect(result.summary.funding).toMatchObject({ income: 36000, subsidy: 774000, total: 810000 });
  expect(result.summary.totalEmployees).toBe(2);
  expect(result.matrix.regionalTotal.amount).toBe(810000);
  expect(result.matrix.columns).toEqual(['income', 'subsidy', 'amount']);
  expect(result.matrix.regionalTotal).toEqual({ income: 36000, subsidy: 774000, amount: 810000 });
  const salary = result.data[0].categories.find(category => category.key === '1');
  expect(salary.income).toBe(36000);
  expect(salary.subsidy).toBe(regions ? 360000 : 720000);
  expect(salary.items[0].income).toBe(36000);
  expect(result.data[0].categories.find(category => category.key === '2').income).toBe(0);
  expect(result.data.reduce((sum, region) => sum + region.categories.reduce((s, category) => s + category.total, 0), 0)).toBe(810000);
});
