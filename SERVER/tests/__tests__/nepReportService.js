const {
  assertNepReportAccess,
  buildAuthoritativeNepReport,
  getTierReportLineItemLabel,
  nepReportScopesMatch,
} = require('../../services/nepReportService');

const lineItems = ({ mooe = 30, CapitalOutlay = 30 } = {}) => [
  {
    lineItemId: 'Personnel Services-ps-1',
    category: 'Personnel Services',
    description: 'Personnel row',
    tier1: 40,
    tier2: 0,
  },
  {
    lineItemId: 'Maintenance and Other Operating Expenses-parent-Travelling Expenses',
    category: 'Maintenance and Other Operating Expenses',
    subCategory: 'CLIENT TAMPERED LABEL',
    description: '4 accounting titles consolidated',
    tier1: mooe,
    tier2: 0,
  },
  {
    lineItemId: 'Capital Outlay-co-1',
    category: 'Capital Outlay',
    description: 'Capital row',
    tier1: CapitalOutlay,
    tier2: 0,
  },
];

const savedTier = (items) => ({
  items: items.map(item => ({
    lineItemId: item.lineItemId,
    category: item.category === 'Personnel Services'
      ? 'Personnel'
      : item.category === 'Capital Outlay'
        ? 'Capital Outlay'
        : 'MOOE',
    tier1: item.tier1,
    tier2: item.tier2,
  })),
});

const allocation = (withDetailedCaps = true) => ({
  initialRequestAmount: 125,
  ceilingAmount: 100,
  ceilingSubsidy: 100,
  ceilingBreakdown: withDetailedCaps
    ? { personnelServices: 40, mooe: 30, CapitalOutlay: 30 }
    : { personnelServices: 0, mooe: 0, CapitalOutlay: 0 },
});

const serializedContext = {
  initial: { amount: 125 },
  ceiling: { amount: 100 },
};

describe('authoritative NEP reporting', () => {
  test('ignores tampered client ceiling/readiness context and recomputes over-ceiling status', () => {
    const rows = lineItems({ mooe: 40 });
    const report = buildAuthoritativeNepReport({
      reportSummary: { lineItems: rows },
      allocation: allocation(true),
      serializedContext,
      categoryIncome: {},
      savedTier: savedTier(lineItems()),
      clientClaimsDirty: false,
      clientReportContext: {
        ceiling: { amount: 999999 },
        compliance: { compliant: true, violations: [] },
        readiness: { reportStatus: 'READY FOR SUBMISSION' },
      },
    });

    expect(report.reportContext.compliance.caps.totalExpenses).toBe(100);
    expect(report.reportContext.compliance.violations.map(item => item.field))
      .toEqual(expect.arrayContaining(['totalExpenses', 'mooe']));
    expect(report.status).toBe('WORKING COPY – OVER CEILING');
  });

  test('never manufactures READY for unsaved live rows even when totals are within caps', () => {
    const rows = lineItems({ CapitalOutlay: 20 });
    const report = buildAuthoritativeNepReport({
      reportSummary: { lineItems: rows },
      allocation: allocation(true),
      serializedContext,
      categoryIncome: {},
      savedTier: savedTier(lineItems()),
      clientClaimsDirty: false,
    });

    expect(report.hasUnsavedChanges).toBe(true);
    expect(report.status).toBe('DRAFT – UNSAVED CHANGES');
  });

  test('marks matching saved rows ready only after every enforced cap is aligned', () => {
    const rows = lineItems();
    const report = buildAuthoritativeNepReport({
      reportSummary: { lineItems: rows },
      allocation: allocation(true),
      serializedContext,
      categoryIncome: {},
      savedTier: savedTier(rows),
    });

    expect(report.hasUnsavedChanges).toBe(false);
    expect(report.status).toBe('READY FOR SUBMISSION');
  });

  test('treats missing detailed caps as not enforced', () => {
    const rows = lineItems({ CapitalOutlay: 20 });
    const report = buildAuthoritativeNepReport({
      reportSummary: { lineItems: rows },
      allocation: allocation(false),
      serializedContext,
      categoryIncome: {},
      savedTier: savedTier(rows),
    });

    expect(report.reportContext.compliance.hasDetailedCeiling).toBe(false);
    expect(report.reportContext.compliance.violations).toEqual([]);
    expect(report.status).toBe('WITHIN CEILING – BALANCE REMAINING');
  });

  test('derives the parent MOOE label from the saved line identity', () => {
    expect(getTierReportLineItemLabel(lineItems()[1], true)).toBe('Travelling Expenses');
  });

  test('detects proposal scope mismatches', () => {
    const expected = { fiscalYear: '2027', region: 'CAR', department: 'Operations', division: 'Finance' };
    expect(nepReportScopesMatch(expected, { ...expected, region: 'CAR' })).toBe(true);
    expect(nepReportScopesMatch(expected, { ...expected, division: 'Engineering' })).toBe(false);
  });

  test('preserves the existing NEP access boundary', () => {
    const context = { proposal: { assignedPreparerUserIds: ['user-1'], createdBy: 'creator-1' } };
    expect(() => assertNepReportAccess(context, { _id: 'outsider', Roles: ['EMPLOYEE'] }))
      .toThrow('Access denied');
    expect(() => assertNepReportAccess(context, { _id: 'user-1', Roles: ['EMPLOYEE'] }))
      .not.toThrow();
  });
});
