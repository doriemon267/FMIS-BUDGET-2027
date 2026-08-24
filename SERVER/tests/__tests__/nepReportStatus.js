const { getNepReportStatus, sanitizeReportFilenamePart } = require('../../utils/nepReportStatus');

const context = (remaining, violations = [], hasDetailedCeiling = true) => ({
  compliant: violations.length === 0,
  violations,
  hasDetailedCeiling,
  remaining: {
    totalExpenses: remaining,
    personnelServices: remaining,
    mooe: remaining,
    capitalOutlay: remaining
  }
});

describe('NEP report status', () => {
  test('uses over-ceiling status for a category-only violation', () => {
    const compliance = context(100, [{ field: 'mooe' }]);
    expect(getNepReportStatus({ compliance })).toBe('WORKING COPY – OVER CEILING');
  });

  test('uses unsaved draft status for compliant live edits', () => {
    expect(getNepReportStatus({ compliance: context(100), hasUnsavedChanges: true }))
      .toBe('DRAFT – UNSAVED CHANGES');
  });

  test('distinguishes balance remaining from exact alignment', () => {
    expect(getNepReportStatus({ compliance: context(1) }))
      .toBe('WITHIN CEILING – BALANCE REMAINING');
    expect(getNepReportStatus({ compliance: context(0) })).toBe('READY FOR SUBMISSION');
  });

  test('sanitizes human-readable filename segments', () => {
    expect(sanitizeReportFilenamePart('CAR / Region 1')).toBe('CAR_Region_1');
  });
});
