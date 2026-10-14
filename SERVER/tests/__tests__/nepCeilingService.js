const {
  MONEY_EPSILON,
  buildNepCeilingComplianceReport,
  buildTierTotalsFromItems
} = require('../../services/nepCeilingService');

describe('NEP BRD ceiling compliance', () => {
  test('rejects a proposal below the target ceiling even when categories are within their caps', () => {
    const report = buildNepCeilingComplianceReport({
      totals: {
        expenses: 900000,
        proposedBudget: 900000,
        subsidies: 700000,
        personnel: 500000,
        mooe: 250000,
        CapitalOutlay: 150000
      },
      allocation: {
        ceilingAmount: 1000000,
        ceilingSubsidy: 650000,
        ceilingBreakdown: {
          personnelServices: 550000,
          mooe: 275000,
          CapitalOutlay: 175000
        }
      }
    });

    expect(report.compliant).toBe(false);
    expect(report.remaining.totalExpenses).toBe(100000);
    expect(report.violations).toEqual([
      expect.objectContaining({
        field: 'targetCeilingMismatch',
        difference: 100000,
        status: 'BELOW_CEILING'
      })
    ]);
  });

  test('accepts Income plus Subsidy only when it matches the target ceiling', () => {
    const report = buildNepCeilingComplianceReport({
      totals: {
        expenses: 1000000,
        proposedBudget: 1000000,
        subsidies: 700000,
        income: 300000,
        personnel: 550000,
        mooe: 275000,
        CapitalOutlay: 175000
      },
      allocation: {
        ceilingAmount: 1000000,
        ceilingSubsidy: 700000,
        ceilingIncome: 300000,
        ceilingBreakdown: {
          personnelServices: 550000,
          mooe: 275000,
          CapitalOutlay: 175000
        }
      }
    });

    expect(report.compliant).toBe(true);
    expect(report.remaining.targetCeiling).toBe(0);
    expect(report.violations).toEqual([]);
  });

  test('reports both total and category excesses using authoritative totals', () => {
    const report = buildNepCeilingComplianceReport({
      totals: {
        expenses: 1050000,
        proposedBudget: 1050000,
        subsidies: 900000,
        personnel: 600000,
        mooe: 300000,
        CapitalOutlay: 150000
      },
      allocation: {
        ceilingAmount: 1000000,
        ceilingSubsidy: 800000,
        ceilingBreakdown: {
          personnelServices: 550000,
          mooe: 275000,
          CapitalOutlay: 175000
        }
      }
    });

    expect(report.compliant).toBe(false);
    expect(report.remaining.totalExpenses).toBe(-50000);
    expect(report.violations.map(violation => violation.field)).toEqual([
      'targetCeilingMismatch',
      'totalExpenses',
      'personnelServices',
      'mooe'
    ]);
    // Subsidy is displayed as context, but the hard allocation constraint is
    // total expenses plus the BRD PS/MOOE/CO breakdown.
    expect(report.violations.some(violation => violation.field === 'projectedSubsidy')).toBe(false);
  });

  test('allows sub-cent target noise but rejects a real mismatch in either direction', () => {
    const allocation = { ceilingAmount: 100, ceilingBreakdown: {} };

    expect(buildNepCeilingComplianceReport({
      totals: {
        expenses: 100 + MONEY_EPSILON / 2,
        proposedBudget: 100 + MONEY_EPSILON / 2
      },
      allocation
    }).compliant).toBe(true);

    expect(buildNepCeilingComplianceReport({
      totals: { expenses: 100.02, proposedBudget: 100.02 },
      allocation
    }).compliant).toBe(false);

    const below = buildNepCeilingComplianceReport({
      totals: { expenses: 99.98, proposedBudget: 99.98 },
      allocation
    });
    expect(below.compliant).toBe(false);
    expect(below.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'targetCeilingMismatch', status: 'BELOW_CEILING' })
    ]));
  });

  test('uses saved Tier 1 and Tier 2 as the authoritative NEP subsidy totals', () => {
    const totals = buildTierTotalsFromItems({
      corporateIncome: 100000,
      categoryIncome: {
        personnelServices: 20000,
        mooe: 30000,
        CapitalOutlay: 50000
      },
      items: [
        { category: 'Personnel', tier1: 300000, tier2: 50000 },
        { category: 'MOOE', tier1: 200000, tier2: 25000 },
        { category: 'Capital Outlay', tier1: 100000, tier2: 75000 }
      ]
    });

    expect(totals).toMatchObject({
      tier1: 600000,
      tier2: 150000,
      subsidies: 750000,
      income: 100000,
      proposedBudget: 850000,
      expenses: 850000,
      personnel: 370000,
      mooe: 255000,
      CapitalOutlay: 225000,
      source: 'TIER'
    });
  });
});
