// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockUseUser, MockIcon } = vi.hoisted(() => ({
  mockUseUser: vi.fn(),
  MockIcon: () => null,
}));

vi.mock("@mui/icons-material", () => ({
  Visibility: MockIcon,
  History: MockIcon,
  ListAlt: MockIcon,
  TableChart: MockIcon,
  Send: MockIcon,
  ThumbUp: MockIcon,
  CheckCircle: MockIcon,
  Cancel: MockIcon,
  ForwardToInbox: MockIcon,
  KeyboardReturn: MockIcon,
  CallSplit: MockIcon,
}));

vi.mock("../../../context/UserContext", () => ({
  useUser: mockUseUser,
}));

import {
  canAccessNepTierAdjustment,
  requiresActiveProposalCycle,
  useProposalPermissions,
} from "./useProposalPermissions";

const activeCycle = (budgetType, fiscalYear = "2027") => ({
  budgetType,
  fiscalYear,
});

const proposal = (modelType, status, fiscalYear = "2027") => ({
  _id: `${modelType}-${status}-${fiscalYear}`,
  modelType,
  fiscalYear,
  status,
});

const actionValues = (result, row, settings) =>
  result.current
    .getAvailableActions(row, [], "#2d5016", settings)
    .map((action) => action.value);

const actionLabels = (result, row, settings) =>
  result.current
    .getAvailableActions(row, [], "#2d5016", settings)
    .map((action) => action.label);

describe("shared NEP Tier Adjustment eligibility", () => {
  const preparerRoles = ["BUDGET_PREPARER"];

  it("allows an eligible draft NEP proposal in the active NEP fiscal year", () => {
    expect(
      canAccessNepTierAdjustment(
        proposal("NEP", "DRAFT", "2027"),
        activeCycle("NEP", "2027"),
        preparerRoles
      )
    ).toBe(true);
  });

  it("blocks an NEP proposal while Initial is the active model", () => {
    expect(
      canAccessNepTierAdjustment(
        proposal("NEP", "DRAFT", "2027"),
        activeCycle("Initial", "2027"),
        preparerRoles
      )
    ).toBe(false);
  });

  it("never allows Tier adjustment for an Initial proposal", () => {
    expect(
      canAccessNepTierAdjustment(
        proposal("Initial", "DRAFT", "2027"),
        activeCycle("Initial", "2027"),
        preparerRoles
      )
    ).toBe(false);
  });

  it("blocks an NEP proposal whose fiscal year differs from the active NEP cycle", () => {
    expect(
      canAccessNepTierAdjustment(
        proposal("NEP", "DRAFT", "2027"),
        activeCycle("NEP", "2028"),
        preparerRoles
      )
    ).toBe(false);
  });
});

describe("ProposalOperationsHub Budget Preparer actions", () => {
  beforeEach(() => {
    mockUseUser.mockReturnValue({
      currentUser: {
        id: "preparer-1",
        name: "Budget Preparer",
        Roles: ["BUDGET_PREPARER"],
      },
    });
  });

  it("keeps an active-cycle Initial finalized row read-only and hides Tier", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("Initial", "FINALIZED"),
      activeCycle("Initial")
    );

    expect(values).toEqual(["view-details", "view-history", "view-audit-trail"]);
    expect(values).not.toContain("open-tier");
    expect(values).not.toContain("submit-to-reviewer");
  });

  it("shows the Initial-specific submit command for an eligible active draft", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const row = proposal("Initial", "DRAFT");
    const settings = activeCycle("Initial");

    expect(actionValues(result, row, settings)).toContain("submit-to-reviewer");
    expect(actionValues(result, row, settings)).not.toContain("open-tier");
    expect(actionLabels(result, row, settings)).toContain(
      "Submit Initial Proposal to Budget Reviewer"
    );
  });

  it("shows NEP Tier Adjustment and NEP-specific submission for an active NEP draft", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const row = proposal("NEP", "DRAFT");
    const settings = activeCycle("NEP");

    expect(actionValues(result, row, settings)).toContain("open-tier");
    expect(actionValues(result, row, settings)).toContain("submit-to-reviewer");
    expect(actionLabels(result, row, settings)).toContain("NEP Tier Adjustment");
    expect(actionLabels(result, row, settings)).toContain(
      "Submit NEP Proposal to Budget Reviewer"
    );
  });

  it("does not expose submission or Tier adjustment for a finalized NEP row", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("NEP", "FINALIZED"),
      activeCycle("NEP")
    );

    expect(values).toEqual(["view-details", "view-history", "view-audit-trail"]);
  });

  it("keeps a NEP draft read-only while Initial is the active budget type", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("NEP", "DRAFT"),
      activeCycle("Initial")
    );

    expect(values).toEqual(["view-details", "view-history", "view-audit-trail"]);
  });

  it("keeps a proposal read-only when its fiscal year is not active", () => {
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("NEP", "DRAFT", "2027"),
      activeCycle("NEP", "2028")
    );

    expect(values).toEqual(["view-details", "view-history", "view-audit-trail"]);
  });

  it("classifies return actions as cycle-exempt while progression remains gated", () => {
    expect(requiresActiveProposalCycle("reviewer-return")).toBe(false);
    expect(requiresActiveProposalCycle("manager-return")).toBe(false);
    expect(requiresActiveProposalCycle("officer-return-to-analyst")).toBe(false);
    expect(requiresActiveProposalCycle("manager-return-to-officer")).toBe(false);
    expect(requiresActiveProposalCycle("submit-to-reviewer")).toBe(true);
    expect(requiresActiveProposalCycle("open-tier")).toBe(true);
    expect(requiresActiveProposalCycle("unconsolidate")).toBe(true);
  });

  it("keeps an authorized return visible but hides progression on an inactive cycle", () => {
    mockUseUser.mockReturnValue({
      currentUser: { id: "reviewer-1", Roles: ["BUDGET_REVIEWER"] },
    });
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("NEP", "FORWARDED_TO_REVIEWER", "2027"),
      activeCycle("Initial", "2027")
    );

    expect(values).toContain("reviewer-return");
    expect(values).not.toContain("reviewer-approve-forward-approver");
    expect(values).not.toContain("reviewer-approve-forward-analyst");
  });

  it.each([
    ["BUDGET_PLANNING_ANALYST", "FORWARDED_TO_BRD_ANALYST"],
    ["BUDGET_OFFICER", "FORWARDED_TO_BRD_OFFICER"],
    ["BUDGET_MANAGER", "FORWARDED_TO_BRD_MANAGER"],
    ["SUPER_ADMIN", "FINALIZED"],
  ])(
    "allows %s to open Tier only for active-cycle NEP rows",
    (role, status) => {
      mockUseUser.mockReturnValue({
        currentUser: { id: `${role}-1`, Roles: [role] },
      });
      const { result } = renderHook(() => useProposalPermissions());

      expect(
        actionValues(result, proposal("NEP", status), activeCycle("NEP"))
      ).toContain("open-tier");
      expect(
        actionValues(result, proposal("Initial", status), activeCycle("Initial"))
      ).not.toContain("open-tier");
      expect(
        actionValues(result, proposal("NEP", status), activeCycle("Initial"))
      ).not.toContain("open-tier");
      expect(
        actionValues(
          result,
          proposal("NEP", status, "2027"),
          activeCycle("NEP", "2028")
        )
      ).not.toContain("open-tier");
    }
  );

  it("keeps the manager return but hides finalization for an inactive cycle", () => {
    mockUseUser.mockReturnValue({
      currentUser: { id: "manager-1", Roles: ["BUDGET_MANAGER"] },
    });
    const { result } = renderHook(() => useProposalPermissions());
    const values = actionValues(
      result,
      proposal("NEP", "FORWARDED_TO_BRD_MANAGER"),
      activeCycle("Initial")
    );

    expect(values).toContain("manager-return");
    expect(values).not.toContain("manager-approve");
  });

  it("uses the BRD-only return path for a direct-adjustment NEP", () => {
    mockUseUser.mockReturnValue({
      currentUser: { id: "analyst-1", Roles: ["BUDGET_PLANNING_ANALYST"] },
    });
    const { result: analystResult } = renderHook(() => useProposalPermissions());
    const directAnalystProposal = {
      ...proposal("NEP", "FORWARDED_TO_BRD_ANALYST"),
      nepAdjustmentMode: "BRD",
    };

    expect(
      actionValues(analystResult, directAnalystProposal, activeCycle("NEP"))
    ).not.toContain("analyst-return");

    mockUseUser.mockReturnValue({
      currentUser: { id: "officer-1", Roles: ["BUDGET_OFFICER"] },
    });
    const { result: officerResult } = renderHook(() => useProposalPermissions());
    const directOfficerProposal = {
      ...proposal("NEP", "FORWARDED_TO_BRD_OFFICER"),
      nepAdjustmentMode: "BRD",
    };
    const officerValues = actionValues(
      officerResult,
      directOfficerProposal,
      activeCycle("NEP")
    );

    expect(officerValues).toContain("officer-return-to-analyst");
    expect(officerValues).not.toContain("officer-return");

    mockUseUser.mockReturnValue({
      currentUser: { id: "manager-1", Roles: ["BUDGET_MANAGER"] },
    });
    const { result: managerResult } = renderHook(() => useProposalPermissions());
    const directManagerProposal = {
      ...proposal("NEP", "FORWARDED_TO_BRD_MANAGER"),
      nepAdjustmentMode: "BRD",
    };
    const managerValues = actionValues(
      managerResult,
      directManagerProposal,
      activeCycle("NEP")
    );

    expect(managerValues).toContain("manager-return-to-officer");
    expect(managerValues).not.toContain("manager-return");
  });
});
