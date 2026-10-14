const MONEY_TOLERANCE = 0.009;

const getNepReportStatus = ({ compliance, hasUnsavedChanges = false } = {}) => {
  const hasViolation =
    compliance?.compliant === false || Number(compliance?.violations?.length || 0) > 0;
  if (hasViolation) return 'WORKING COPY – OVER CEILING';
  if (hasUnsavedChanges) return 'DRAFT – UNSAVED CHANGES';
  if (!compliance) return 'REPORT CONTEXT UNAVAILABLE';

  const enforcedFields = [
    'totalExpenses',
    ...(compliance.hasDetailedCeiling
      ? ['personnelServices', 'mooe', 'CapitalOutlay']
      : [])
  ];
  const exact = enforcedFields.every(
    field => Math.abs(Number(compliance.remaining?.[field] || 0)) <= MONEY_TOLERANCE
  );
  return exact ? 'READY FOR SUBMISSION' : 'WITHIN CEILING – BALANCE REMAINING';
};

const sanitizeReportFilenamePart = value => String(value ?? '—')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9_-]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 64) || 'NA';

module.exports = {
  MONEY_TOLERANCE,
  getNepReportStatus,
  sanitizeReportFilenamePart
};
