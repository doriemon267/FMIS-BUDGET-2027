jest.mock('../../models/BRDConsolidation', () => ({ find: jest.fn() }));

const BRDConsolidation = require('../../models/BRDConsolidation');
const consoProposalExportService = require('../../utils/consoProposalExportService');

const {
  CONSO_PDF_REGIONS_PER_PAGE,
  CONSO_PDF_SUMMARY_LABELS,
  CONSO_PDF_CONTINUATION_LABEL,
  normalizeSelectedRegions,
  getConsoPdfRegionGroups,
  getConsoPdfFinancialValues,
  getConsoPdfSummaryValues,
  sumConsoPdfValues,
  getConsolidatedData,
} = consoProposalExportService._private;

describe('BRD selected-region PDF contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes repeated and comma-separated region selections without duplicates', () => {
    expect(normalizeSelectedRegions([
      ' Region I ',
      'Region II, Region III',
      'Region I',
      'all',
      '',
    ])).toEqual(['Region I', 'Region II', 'Region III']);
  });

  test('uses four regions per PDF group without omission or duplication', () => {
    const regions = Array.from({ length: 9 }, (_, index) => `Region ${index + 1}`);
    const groups = getConsoPdfRegionGroups(regions);

    expect(CONSO_PDF_REGIONS_PER_PAGE).toBe(4);
    expect(groups.map((group) => group.length)).toEqual([4, 4, 1]);
    expect(groups.flat()).toEqual(regions);
    expect(new Set(groups.flat()).size).toBe(regions.length);
  });

  test('uses Sub Total, Total, and compact continuation labels', () => {
    expect(CONSO_PDF_SUMMARY_LABELS).toEqual({
      subTotal: 'SUB TOTAL',
      total: 'TOTAL',
    });
    expect(CONSO_PDF_CONTINUATION_LABEL).toBe('CONTINUATION OF:');
  });

  test('calculates row, page-group, and all-selected summary values independently', () => {
    const firstRegion = {
      income: { irrigationServiceFees: 10, total: 40 },
      budgetarySupport: 60,
      totalUses: 125,
    };
    const secondRegion = {
      income: { irrigationServiceFees: 5, total: 20 },
      budgetarySupport: 30,
      totalUses: 75,
    };

    expect(getConsoPdfFinancialValues(firstRegion, 'income', 'irrigationServiceFees'))
      .toEqual({ income: 10, subsidy: 0, budget: 10 });
    expect(getConsoPdfSummaryValues(firstRegion))
      .toEqual({ income: 40, subsidy: 60, budget: 125 });
    expect(sumConsoPdfValues([
      getConsoPdfSummaryValues(firstRegion),
      getConsoPdfSummaryValues(secondRegion),
    ])).toEqual({ income: 60, subsidy: 90, budget: 200 });
  });

  test('filters the BRD consolidation query to selected non-Central Office regions', async () => {
    BRDConsolidation.find.mockReturnValue({ lean: async () => [] });

    await getConsolidatedData('2027', {
      selectedRegions: ['Region I', 'Region II'],
      regionalOnly: true,
    });

    expect(BRDConsolidation.find).toHaveBeenCalledWith({
      status: 'ACTIVE',
      fiscalYear: '2027',
      isCentralOffice: { $ne: true },
      region: { $in: ['Region I', 'Region II'] },
    });
  });
});
