export const CURRENCY_TOLERANCE = 0.009;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const buildLiveCompliance = (liveTotals, serverCompliance) => {
  if (!liveTotals) return serverCompliance || null;

  const caps = serverCompliance?.caps || {};
  const actual = {
    totalExpenses: roundMoney(liveTotals.totalExpenses),
    proposedBudget: roundMoney(liveTotals.proposedBudget),
    projectedSubsidy: roundMoney(liveTotals.projectedSubsidy),
    personnelServices: roundMoney(liveTotals.personnelServices),
    mooe: roundMoney(liveTotals.mooe),
    capitalOutlay: roundMoney(liveTotals.capitalOutlay),
  };
  const hasDetailedCeiling = Boolean(serverCompliance?.hasDetailedCeiling);
  const enforcedFields = [
    "totalExpenses",
    ...(hasDetailedCeiling ? ["personnelServices", "mooe", "capitalOutlay"] : []),
  ];
  const violations = enforcedFields
    .filter((field) => actual[field] - Number(caps[field] || 0) > CURRENCY_TOLERANCE)
    .map((field) => ({
      field,
      actual: actual[field],
      cap: Number(caps[field] || 0),
      excess: roundMoney(actual[field] - Number(caps[field] || 0)),
    }));

  return {
    compliant: violations.length === 0,
    actual,
    caps,
    hasDetailedCeiling,
    violations,
    remaining: {
      totalExpenses: roundMoney(Number(caps.totalExpenses || 0) - actual.totalExpenses),
      personnelServices: roundMoney(
        Number(caps.personnelServices || 0) - actual.personnelServices
      ),
      mooe: roundMoney(Number(caps.mooe || 0) - actual.mooe),
      capitalOutlay: roundMoney(Number(caps.capitalOutlay || 0) - actual.capitalOutlay),
    },
  };
};

export const getNepReportReadiness = ({ compliance, hasUnsavedChanges = false } = {}) => {
  if (!compliance) {
    return {
      key: "UNAVAILABLE",
      label: "Report context unavailable",
      reportStatus: "REPORT CONTEXT UNAVAILABLE",
      color: "default",
      helper: "Load the approved BRD ceiling before generating an NEP report.",
    };
  }

  const hasViolation =
    compliance.compliant === false || Number(compliance.violations?.length || 0) > 0;
  if (hasViolation) {
    return {
      key: "OVER_CEILING",
      label: "Working copy · over ceiling",
      reportStatus: "WORKING COPY – OVER CEILING",
      color: "error",
      helper: "Preview is available, but total or category ceilings still require adjustment.",
    };
  }

  if (hasUnsavedChanges) {
    return {
      key: "UNSAVED",
      label: "Draft · unsaved changes",
      reportStatus: "DRAFT – UNSAVED CHANGES",
      color: "warning",
      helper: "The report uses the current live values; save them before submission.",
    };
  }

  const enforcedFields = [
    "totalExpenses",
    ...(compliance.hasDetailedCeiling
      ? ["personnelServices", "mooe", "capitalOutlay"]
      : []),
  ];
  const isExactlyAligned = enforcedFields.every(
    (field) => Math.abs(Number(compliance.remaining?.[field] || 0)) <= CURRENCY_TOLERANCE
  );

  if (isExactlyAligned) {
    return {
      key: "READY",
      label: "Ready for submission",
      reportStatus: "READY FOR SUBMISSION",
      color: "success",
      helper: "Saved Tier values match every enforced BRD ceiling.",
    };
  }

  return {
    key: "BALANCE_REMAINING",
    label: "Within ceiling · balance remaining",
    reportStatus: "WITHIN CEILING – BALANCE REMAINING",
    color: "info",
    helper: "Saved values are compliant, with capacity remaining in at least one ceiling.",
  };
};
