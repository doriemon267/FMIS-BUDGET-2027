jest.mock('muhammara', () => ({ Recipe: jest.fn() }));
jest.mock('../../utils/pdfSignatureHelper', () => ({
  extractSignatoriesFromWorkflow: jest.fn().mockReturnValue({}),
  drawWorkflowSignatureBlock: jest.fn((doc, info, y) => y),
  cleanupTempImages: jest.fn(),
  enrichSignatoriesWithPositionTitle: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../utils/proposalPdfWatermark', () => ({
  resolveDraftWatermarkForRecords: jest.fn().mockResolvedValue(false),
  drawMuhammaraDraftWatermark: jest.fn(),
}));
const { Recipe } = require('muhammara');
const Personnel = require('../../models/PersonnelServices');
const { getConsolidatedPersonnelServicesPdf } = require('../../controllers/consolidatedPersonnelServicesController');
let doc;
beforeEach(() => {
  doc = Object.fromEntries(['text', 'rectangle', 'image', 'createPage', 'endPage', 'endPDF'].map(key => [key, jest.fn().mockReturnThis()]));
  doc.calculateTextDimensions = (value, options) => ({ width: value.length * options.fontSize * 0.55 });
  Recipe.mockImplementation(() => doc);
});
afterEach(() => jest.restoreAllMocks());

test.each([false, true])('PDF draws the split in actual financial columns, all regions=%p', async allRegions => {
  const rows = Array.from({ length: allRegions ? 3 : 1 }, (_, index) => ({
    region: `Region ${index + 1}`, statusOfAppointment: 'PERMANENT', budgetType: 'INITIAL',
    cpcs1MonthlySalary: 30000, cpcs2MonthlySalary: 33000, annualSalary: 396000,
    PERA: 24000, Total: 420000, chargedToIncomeAmount: 36000, chargedToIncomeEligible: true,
  }));
  jest.spyOn(Personnel, 'find').mockReturnValue({ lean: async () => rows });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await getConsolidatedPersonnelServicesPdf({
    query: { fiscalYear: '2027', budgetType: 'INITIAL', ...(allRegions ? { consolidationType: 'all' } : { regions: ['Region 1'] }) },
    user: { id: 'admin', Roles: ['SUPER_ADMIN'] },
  }, res);
  expect(res.status).not.toHaveBeenCalled();
  expect(doc.endPDF).toHaveBeenCalled();
  const calls = doc.text.mock.calls;
  for (const label of ['INCOME', 'SUBSIDY', 'AMOUNT']) expect(calls.some(([text]) => text === label)).toBe(true);
  const income = calls.find(([text]) => text === '₱36,000.00');
  const subsidy = calls.find(([text, , y]) => text === '₱360,000.00' && y === income[2]);
  const amount = calls.find(([text, , y]) => text === '₱396,000.00' && y === income[2]);
  expect(subsidy[1]).toBeGreaterThan(income[1]);
  expect(amount[1]).toBeGreaterThan(subsidy[1]);
  expect(calls.some(([text]) => /subtotal/i.test(text))).toBe(true);
  if (allRegions) {
    expect(doc.createPage.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.some(([text]) => text === 'ALL-REGION TOTAL')).toBe(true);
    expect(calls.some(([text]) => text === '₱108,000.00')).toBe(true);
    expect(calls.some(([text]) => text === '₱1,152,000.00')).toBe(true);
  }
});
