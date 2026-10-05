import { describe, expect, it } from 'vitest';
import {
  buildFinancialComparisonSections,
  getModuleComparisonTotals,
  NEP_WORKSPACE_MODULES,
} from './nepFinancialComparison';

describe('NEP financial comparison adapter', () => {
  it('defines exactly the four approved workspace selectors in order', () => {
    expect(NEP_WORKSPACE_MODULES).toEqual([
      { key: 'income', label: 'Corporate Income' },
      { key: 'personnel', label: 'Personnel Services' },
      { key: 'mooe', label: 'MOOE' },
      { key: 'capital', label: 'Capital Outlay' },
    ]);
  });

  it('keeps Corporate Income amount-only without inventing subsidy allocation', () => {
    const totals = getModuleComparisonTotals({
      moduleKey: 'income',
      initialItems: [{ particulars: 'Service Fees', amount: 100 }],
      currentItems: [{ particulars: 'Service Fees', amount: 125 }],
    });

    expect(totals.initial).toBe(100);
    expect(totals.proposed).toBe(125);
    expect(totals.nepSubsidy).toBe(0);
  });

  it('merges consolidated MOOE rows and preserves every source index', () => {
    const initialItems = [
      { sublineItem: 'Operations', accountingTitle: 'Fuel', uacsCode: '50203010', income: 10, subsidy: 20 },
      { sublineItem: 'Operations', accountingTitle: 'Fuel', uacsCode: '50203010', income: 30, subsidy: 40 },
    ];
    const currentItems = initialItems.map((item, index) => ({
      ...item,
      income: item.income + index + 1,
    }));
    const row = buildFinancialComparisonSections({
      moduleKey: 'mooe',
      initialItems,
      currentItems,
    })[0].rows[0];

    expect(row.sourceIndices).toEqual([0, 1]);
    expect(row.initialIncome).toBe(40);
    expect(row.nepIncome).toBe(43);
    expect(row.nepSubsidy).toBe(60);
  });

  it('uses explicit original values when available and identifies a durable baseline', () => {
    const totals = getModuleComparisonTotals({
      moduleKey: 'capital',
      initialItems: [
        {
          particulars: 'Pump',
          originalIncome: 80,
          originalSubsidy: 120,
          income: 100,
          subsidy: 150,
        },
      ],
      currentItems: [{ particulars: 'Pump', income: 110, subsidy: 140 }],
    });

    expect(totals.initial).toBe(200);
    expect(totals.proposed).toBe(250);
    expect(totals.hasDurableBaseline).toBe(true);
  });

  it('normalizes an object-valued Capital Outlay category to its display name', () => {
    const category = { _id: 'category-1', categoryName: 'Machinery and Equipment' };
    const sections = buildFinancialComparisonSections({
      moduleKey: 'capital',
      initialItems: [
        { category, accountingTitle: 'Irrigation Pump', income: 20, subsidy: 80 },
      ],
      currentItems: [
        { category, accountingTitle: 'Irrigation Pump', income: 25, subsidy: 75 },
      ],
    });

    expect(sections[0].title).toBe('Machinery and Equipment');
    expect(sections[0].rows[0].label).toBe('Irrigation Pump');
    expect(sections[0].rows[0].mergeKey).not.toContain('[OBJECT OBJECT]');
  });

  it('falls back safely for unexpected object and array metadata', () => {
    const sections = buildFinancialComparisonSections({
      moduleKey: 'mooe',
      initialItems: [{ sublineItem: [{ label: 'Operations' }], accountingTitle: {}, income: 1 }],
      currentItems: [{ sublineItem: [{ label: 'Operations' }], accountingTitle: {}, income: 1 }],
    });

    expect(sections[0].title).toBe('Operations');
    expect(sections[0].rows[0].label).toBe('MOOE item');
  });
});
