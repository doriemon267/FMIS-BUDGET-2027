import { describe, expect, it } from "vitest";
import { getNepReportReadiness } from "./nepReportStatus";

const compliance = (remaining, violations = [], hasDetailedCeiling = true) => ({
  compliant: violations.length === 0,
  violations,
  hasDetailedCeiling,
  remaining: {
    totalExpenses: remaining,
    personnelServices: remaining,
    mooe: remaining,
    capitalOutlay: remaining,
  },
});

describe("getNepReportReadiness", () => {
  it("marks a total violation as over ceiling", () => {
    expect(
      getNepReportReadiness({
        compliance: compliance(-100, [{ field: "totalExpenses" }]),
      }).key
    ).toBe("OVER_CEILING");
  });

  it("marks a category-only violation as over ceiling", () => {
    const value = compliance(0, [{ field: "mooe" }]);
    value.remaining.totalExpenses = 200;
    expect(getNepReportReadiness({ compliance: value }).key).toBe("OVER_CEILING");
  });

  it("prioritizes unsaved state when live values are within ceiling", () => {
    expect(
      getNepReportReadiness({ compliance: compliance(100), hasUnsavedChanges: true }).key
    ).toBe("UNSAVED");
  });

  it("reports a remaining balance for saved compliant values", () => {
    expect(getNepReportReadiness({ compliance: compliance(100) }).key).toBe(
      "BALANCE_REMAINING"
    );
  });

  it("reports ready only when every enforced ceiling is exactly aligned", () => {
    expect(getNepReportReadiness({ compliance: compliance(0) }).key).toBe("READY");
  });
});
