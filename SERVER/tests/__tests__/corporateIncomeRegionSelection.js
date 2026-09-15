const {
  buildExactRegionMongoFilter,
  getFolioPageSize,
  getRegionalCoverageLabel,
  isAllRegionsSelection,
  normalizeRegionSelection,
} = require('../../utils/reportPageLayout');
const {
  calculateCorporateIncomeDiscounts,
} = require('../../utils/corporateIncomeDiscount');

describe('Corporate Income region selection helpers', () => {
  test('normalizes and case-insensitively deduplicates repeated custom regions', () => {
    expect(normalizeRegionSelection({
      consolidationType: 'custom',
      regions: [' Region I ', 'region i', 'REGION IV-A'],
    })).toEqual({
      isAll: false,
      regions: ['Region I', 'REGION IV-A'],
    });
  });

  test('retains singular-region and all-region compatibility', () => {
    expect(normalizeRegionSelection({ region: ' Region III ' })).toEqual({
      isAll: false,
      regions: ['Region III'],
    });
    expect(normalizeRegionSelection({ region: 'ALL' })).toEqual({
      isAll: true,
      regions: [],
    });
  });

  test('builds escaped, exact, case-insensitive filters for custom selections', () => {
    const filter = buildExactRegionMongoFilter(['Region IV-A', 'Region (Special)']);

    expect(filter.$in).toHaveLength(2);
    expect(filter.$in[0].test('region iv-a')).toBe(true);
    expect(filter.$in[0].test('Region IV-A Annex')).toBe(false);
    expect(filter.$in[1].test('REGION (SPECIAL)')).toBe(true);
    expect(filter.$in[1].test('Region Special')).toBe(false);
  });

  test('uses portrait for one custom region and landscape for multiple custom regions', () => {
    expect(isAllRegionsSelection({ selectedRegions: ['Region I'] })).toBe(false);
    expect(getFolioPageSize(false)).toEqual({ width: 612, height: 936 });

    expect(
      isAllRegionsSelection({ selectedRegions: ['Region I', 'Region IV-A'] })
    ).toBe(true);
    expect(getFolioPageSize(true)).toEqual({ width: 936, height: 612 });
  });

  test('keeps all-region selections in landscape mode', () => {
    expect(isAllRegionsSelection({ consolidationType: 'all' })).toBe(true);
    expect(isAllRegionsSelection({ selectedRegions: 'all' })).toBe(true);
  });

  test('uses a concise regional coverage label in PDF headers', () => {
    expect(getRegionalCoverageLabel({
      regions: ['REGION I'],
    })).toBe('REGION I');
    expect(getRegionalCoverageLabel({
      regions: ['REGION I', 'CAR', 'MARIIS'],
    })).toBe('3 Selected Regions');
    expect(getRegionalCoverageLabel({
      isAll: true,
      regions: ['REGION I', 'CAR', 'MARIIS'],
    })).toBe('All Regions');
  });

  test('uses Net Irrigation Service Fees in every regional and overall total', () => {
    const regionNames = ['REGION I', 'CAR', 'MARIIS'];
    const result = calculateCorporateIncomeDiscounts({
      regionNames,
      currentAccountByRegion: {
        'REGION I': 248966,
        CAR: 86250,
        MARIIS: 5731329.7,
      },
      isfByRegion: {
        'REGION I': 448966,
        CAR: 976250,
        MARIIS: 6726603.27,
      },
      grossTotalByRegion: {
        'REGION I': 5061705,
        CAR: 3291250,
        MARIIS: 427363203.27,
      },
      settings: regionNames.map((region) => ({
        region,
        applyDiscount: true,
        discountType: 'percentage',
        discountValue: 10,
      })),
    });

    expect(result.discountGrandTotal).toBeCloseTo(606654.57, 2);
    expect(result.netIsfGrandTotal).toBeCloseTo(7545164.7, 2);
    expect(result.netTotalByRegion['REGION I']).toBeCloseTo(5036808.4, 2);
    expect(result.netTotalByRegion.CAR).toBeCloseTo(3282625, 2);
    expect(result.netTotalByRegion.MARIIS).toBeCloseTo(426790070.3, 2);

    const regionalNetTotal = Object.values(result.netTotalByRegion)
      .reduce((sum, amount) => sum + amount, 0);
    expect(regionalNetTotal).toBeCloseTo(435109503.7, 2);
  });

  test('applies each region\'s own discount configuration', () => {
    const result = calculateCorporateIncomeDiscounts({
      regionNames: ['Region A', 'Region B', 'Region C'],
      currentAccountByRegion: {
        'Region A': 1000,
        'Region B': 500,
        'Region C': 200,
      },
      isfByRegion: {
        'Region A': 1500,
        'Region B': 800,
        'Region C': 400,
      },
      grossTotalByRegion: {
        'Region A': 2000,
        'Region B': 1200,
        'Region C': 600,
      },
      settings: [
        { region: 'region a', applyDiscount: true, discountType: 'percentage', discountValue: 5 },
        { region: 'REGION B', applyDiscount: false, discountType: 'percentage', discountValue: 10 },
        { region: 'Region C', applyDiscount: true, discountType: 'fixed', discountValue: 50 },
      ],
    });

    expect(result.discountRegionAmounts).toEqual({
      'Region A': 50,
      'Region B': 0,
      'Region C': 50,
    });
    expect(result.netTotalByRegion).toEqual({
      'Region A': 1950,
      'Region B': 1200,
      'Region C': 550,
    });
    expect(result.discountLabel).toBe('Less: ISF Discount on Current Account');
  });
});
