import { describe, expect, it } from "vitest";
import { getNepReportReadiness } from "./nepReportStatus";

const compliance = (remaining, violations = [], hasDetailedCeiling = true) => ({
  compliant: violations.length === 0,
  violations,
  hasDetailedCeiling,
  remaining: {
    totalExpenses: remaining,
    targetCeiling: remaining,
    personnelServices: remaining,
    mooe: remaining,
    capitalOutlay: remaining,
  },
});

describe("getNepReportReadiness", () => {
  it("marks a total violation as a ceiling mismatch", () => {
    expect(
      getNepReportReadiness({
        compliance: compliance(-100, [{ field: "totalExpenses" }]),
      }).key
    ).toBe("CEILING_MISMATCH");
  });

  it("marks a category-only violation as a ceiling mismatch", () => {
    const value = compliance(0, [{ field: "mooe" }]);
    value.remaining.totalExpenses = 200;
    expect(getNepReportReadiness({ compliance: value }).key).toBe("CEILING_MISMATCH");
  });

  it("prioritizes unsaved state when live values are within ceiling", () => {
    expect(
      getNepReportReadiness({ compliance: compliance(100), hasUnsavedChanges: true }).key
    ).toBe("UNSAVED");
  });

  it("treats a saved below-ceiling value as a mismatch", () => {
    const value = compliance(100, [{ field: "targetCeilingMismatch" }]);
    expect(getNepReportReadiness({ compliance: value }).key).toBe("CEILING_MISMATCH");
  });

  it("reports ready only when every enforced ceiling is exactly aligned", () => {
    expect(getNepReportReadiness({ compliance: compliance(0) }).key).toBe("READY");
  });
});
