const {
  applyCOSPremium,
  calculateCOSPremium,
  getCOSVacantKey,
  resolveCOSEmployeeNumber,
  validatePremiumPercentage,
} = require('../../utils/cosPremium');

describe('COS/JO annual premium calculation', () => {
  test.each([2023, 2024, 2025])('keeps premium at zero before FY 2026 (%s)', (fiscalYear) => {
    expect(calculateCOSPremium({
      annualSalary: 120000,
      fiscalYear,
      enabled: true,
      percentage: 10,
    })).toMatchObject({ premiumAmount: 0, Total: 120000 });
  });

  test.each([2026, 2027, 2035])('uses the full annual base for eligible FY %s', (fiscalYear) => {
    expect(calculateCOSPremium({
      annualSalary: 120000,
      fiscalYear,
      enabled: true,
      percentage: 10,
    })).toMatchObject({
      baseAnnualAmount: 120000,
      premiumRate: 10,
      premiumAmount: 12000,
      Total: 132000,
    });
  });

  test('does not apply a premium when the proposal setting is disabled', () => {
    expect(calculateCOSPremium({
      annualSalary: 120000,
      fiscalYear: 2026,
      enabled: false,
      percentage: 10,
    })).toMatchObject({ premiumAmount: 0, Total: 120000 });
  });

  test('supports zero and two-decimal rates with currency rounding', () => {
    expect(calculateCOSPremium({
      annualSalary: 100001,
      fiscalYear: 2026,
      enabled: true,
      percentage: 10.25,
    })).toMatchObject({ premiumAmount: 10250.1, Total: 110251.1 });
    expect(calculateCOSPremium({
      annualSalary: 100001,
      fiscalYear: 2026,
      enabled: true,
      percentage: 0,
    })).toMatchObject({ premiumAmount: 0, Total: 100001 });
  });

  test('monthly salary edits derive the canonical annual salary before premium', () => {
    expect(applyCOSPremium(
      { monthlySalary: 10000, annualSalary: 999999, fiscalYear: 2026 },
      { enabled: true, percentage: 10 },
      { monthlySalaryChanged: true }
    )).toMatchObject({
      annualSalary: 120000,
      baseAnnualAmount: 120000,
      premiumAmount: 12000,
      Total: 132000,
    });
  });

  test.each([-1, 100.01, 10.123, 'not-a-rate'])(
    'rejects invalid percentage %s',
    (percentage) => {
      expect(() => validatePremiumPercentage(percentage)).toThrow();
    }
  );

  test('uses the same canonical VACANT identifier for duplicate checks and persistence', () => {
    const vacant = {
      EmployeeFullName: 'TO-BE-FILLED',
      ItemNumber: ' COS-007 ',
      PositionTitle: 'Engineer',
      Department: 'Office A',
      Division: 'Division A',
      SG: 10,
    };
    expect(resolveCOSEmployeeNumber(vacant)).toBe('VACANT-COS-007');
    expect(getCOSVacantKey(vacant)).toBe('ENGINEER|OFFICE A|DIVISION A|10');
  });

  test('keeps no-item VACANT identifiers stable instead of depending on batch order', () => {
    const vacant = {
      EmployeeFullName: 'VACANT',
      PositionTitle: 'Engineer',
      Department: 'Office A',
      Division: 'Division A',
      SG: 10,
    };
    expect(resolveCOSEmployeeNumber(vacant)).toBe(
      'VACANT-ENGINEER|OFFICE A|DIVISION A|10'
    );
    expect(resolveCOSEmployeeNumber({ ...vacant })).toBe(resolveCOSEmployeeNumber(vacant));
  });
});
