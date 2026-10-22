const { buildTierScopeRows, buildRegionalTierSummaries, compareRegions, formatAmount } = require('../../utils/tierScopePdf');

const summary = {
  sourcesOfFunds: {
    corporateIncome: 1000,
    corporateIncomeTier1: 600,
    corporateIncomeTier2: 400,
    budgetarySupport: { tier1: 5000, tier2: 250 },
    proposedBudget: 6250,
  },
  usesOfFunds: {
    'Personnel Services': { tier1: 3000, tier2: 0, tier1Income: 0, tier2Income: 0 },
    'Maintenance and Other Operating Expenses': { tier1: 2000, tier2: 250, tier1Income: 600, tier2Income: 400 },
    'Capital Outlay': { tier1: 0, tier2: 0, tier1Income: 0, tier2Income: 0 },
    totalTier1: 5000, totalTier2: 250, totalTier1Income: 600, totalTier2Income: 400,
  },
  surplusDeficit: 0,
  lineItems: [
    { category: 'Personnel Services', subCategory: 'Personnel Services', description: 'PERA', tier1: 3000, tier2: 0 },
    { category: 'Maintenance and Other Operating Expenses', subCategory: 'Travelling Expenses', description: 'Traveling Expenses-Local', tier1: 2000, tier2: 250, tier1Income: 600, tier2Income: 400 },
  ],
  incomeBreakdown: [
    { category: 'Irrigation Service Fees', isIsf: true, subtotal: 700, items: [{ name: 'Current Account', amount: 700 }] },
    { category: 'Net Irrigation Service Fees', isNetIsf: true, subtotal: 630, items: [] },
    { category: 'Rent Income', subtotal: 370, items: [{ name: 'Dorm / RTC / NIA Housing', amount: 370 }] },
  ],
};

describe('Tier scope PDF rows', () => {
  const rows = buildTierScopeRows(summary);
  const labels = rows.map((r) => r.label);

  test('follows the Sources of Funds report structure', () => {
    const order = [
      'A. SOURCES OF FUNDS', '1. CORPORATE INCOME', 'Irrigation Service Fees', 'Current Account', 'Total ISF',
      'Less: Discount on ISF', 'Net Irrigation Service Fees', 'Rent Income', 'Dorm / RTC / NIA Housing',
      'Subtotal (Rent Income)', 'TOTAL-CORPORATE INCOME', '2. BUDGETARY SUPPORT',
      'Subsidy to the National Irrigation Administration:', 'a. Operating Requirements',
      'TOTAL BUDGETARY SUPPORT', 'TOTAL SOURCES OF FUNDS', 'B. USES OF FUNDS',
    ];
    expect(labels.slice(0, order.length)).toEqual(order);
  });

  test('uses Tier 1/Tier 2 Income and Subsidy columns', () => {
    const byLabel = (l) => rows.find((r) => r.label === l).values;
    expect(byLabel('TOTAL-CORPORATE INCOME')).toEqual([600, 0, 400, 0, 1000, 0, 1000]);
    expect(byLabel('a. Operating Requirements')).toEqual([0, 5000, 0, 250, 0, 5250, 5250]);
    expect(byLabel('TOTAL SOURCES OF FUNDS')).toEqual([600, 5000, 400, 250, 1000, 5250, 6250]);
    expect(byLabel('Traveling Expenses-Local')).toEqual([600, 2000, 400, 250, 1000, 2250, 3250]);
    expect(byLabel('Less: Discount on ISF')).toEqual([null, null, null, null, 70, 0, 70]);
    expect(byLabel('TOTAL USES OF FUNDS')).toEqual([600, 5000, 400, 250, 1000, 5250, 6250]);
  });

  test('does not repeat a sub-heading that equals its category', () => {
    expect(labels.filter((l) => l === 'Personnel Services')).toHaveLength(1);
    expect(labels).toContain('Travelling Expenses');
  });

  test('formats amounts accounting-style', () => {
    expect(formatAmount(0)).toBe('-');
    expect(formatAmount(null)).toBe('');
    expect(formatAmount(1234.5)).toBe('1,234.50');
    expect(formatAmount(-50)).toBe('(50.00)');
  });
});

describe('All Regions Tier PDF sections', () => {
  const allSummary = {
    ...summary,
    lineItems: summary.lineItems.map((item, i) => ({ ...item, lineItemId: `item-${i}` })),
  };
  const regionalBreakdown = {
    regions: ['REGION X', 'REGION II', 'CENTRAL OFFICE', 'REGION IV-A', 'TOTAL REGIONS'],
    data: {
      'REGION II': { PERA: { total: 800 }, 'Traveling Expenses-Local': { total: 200 }, 'Current Account': { total: 150 } },
    },
    summaryTotals: {
      'REGION II': { CorpIncome: { inc: 150 }, PS: { tot: 900 }, MOOE: { tot: 200 }, CO: { tot: 0 } },
    },
  };

  test('orders Central Office first and regions by number', () => {
    const order = ['REGION X', 'CAR', 'REGION II', 'CENTRAL OFFICE', 'REGION IV-A', 'REGION I'].sort(compareRegions);
    expect(order).toEqual(['CENTRAL OFFICE', 'REGION I', 'REGION II', 'REGION IV-A', 'REGION X', 'CAR']);
  });

  test('builds one summary per region, skipping TOTAL REGIONS', () => {
    const sections = buildRegionalTierSummaries({ reportSummary: allSummary, regionalBreakdown });
    expect(sections.map((s) => s.scopeLabel)).toEqual(['CENTRAL OFFICE', 'REGION II', 'REGION IV-A', 'REGION X']);
  });

  test('uses regional amounts as Tier 1 subsidy and keeps unmatched amounts visible', () => {
    const region = buildRegionalTierSummaries({ reportSummary: allSummary, regionalBreakdown })
      .find((s) => s.scopeLabel === 'REGION II').reportSummary;
    const rows = buildTierScopeRows(region);
    const values = (label) => rows.find((r) => r.label === label).values;
    expect(values('PERA')).toEqual([0, 800, 0, 0, 0, 800, 800]);
    expect(values('Other items (not itemized)')).toEqual([0, 100, 0, 0, 0, 100, 100]);
    expect(values('Current Account')).toEqual([null, null, null, null, 150, 0, 150]);
    expect(values('TOTAL USES OF FUNDS')).toEqual([0, 1100, 0, 0, 0, 1100, 1100]);
    expect(values('TOTAL SOURCES OF FUNDS')).toEqual([150, 1100, 0, 0, 150, 1100, 1250]);
  });

  test('applies the Tier split saved for the region', () => {
    const region = buildRegionalTierSummaries({
      reportSummary: allSummary,
      regionalBreakdown,
      savedTierByRegion: { 'REGION II': { 'item-0': { tier1: 500, tier2: 250, tier1Income: 50, tier2Income: 0 } } },
    }).find((s) => s.scopeLabel === 'REGION II').reportSummary;
    const row = buildTierScopeRows(region).find((r) => r.label === 'PERA');
    expect(row.values).toEqual([50, 500, 0, 250, 50, 750, 800]);
  });
});
