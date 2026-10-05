// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const testState = vi.hoisted(() => ({
  activeSettings: { budgetType: "Initial", fiscalYear: "2027" },
  proposal: null,
  currentUser: null,
}));

const queryClient = vi.hoisted(() => ({
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
  getQueryCache: () => ({ subscribe: () => () => {} }),
}));

const mockApiGet = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const MockIcon = vi.hoisted(() => () => null);

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@mui/icons-material", () => ({
  Add: MockIcon,
  CheckCircle: MockIcon,
  Cancel: MockIcon,
  Send: MockIcon,
  CallSplit: MockIcon,
  ThumbUp: MockIcon,
  ThumbDown: MockIcon,
  ExpandMore: MockIcon,
  ExpandLess: MockIcon,
  Visibility: MockIcon,
  TableChart: MockIcon,
  History: MockIcon,
  ListAlt: MockIcon,
  ForwardToInbox: MockIcon,
  KeyboardReturn: MockIcon,
}));
vi.mock("@mui/icons-material/Search", () => ({ default: MockIcon }));
vi.mock("@mui/icons-material/Refresh", () => ({ default: MockIcon }));
vi.mock("@mui/icons-material/History", () => ({ default: MockIcon }));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ currentUser: testState.currentUser }),
}));

vi.mock("../../context/RegionContext", () => ({
  useRegion: () => ({ activeRegion: "CAR" }),
}));

vi.mock("../../hooks/useWorkflowRef", () => ({
  useWorkflowRef: () => ({ setWorkflowRef: vi.fn() }),
}));

vi.mock("../../hooks/useProposalLock", () => ({
  useProposalLock: () => ({
    lockStatus: null,
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    hasLock: false,
  }),
}));

vi.mock("../../hooks/useKeyboardShortcuts", () => ({ default: vi.fn() }));
vi.mock("../../hooks/useDebounce", () => ({
  useDebouncedCallback: (callback) => callback,
}));

vi.mock("../../config/api", () => ({
  default: {
    get: mockApiGet,
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQueryClient: () => queryClient,
    useQuery: ({ queryKey }) => {
      if (queryKey[0] === "activeSettings") {
        return { data: testState.activeSettings, isLoading: false, refetch: vi.fn() };
      }
      if (queryKey[0] === "workflowProposals") {
        return {
          data: { proposals: testState.proposal ? [testState.proposal] : [] },
          isLoading: false,
          refetch: vi.fn(),
        };
      }
      return { data: null, isLoading: false, refetch: vi.fn() };
    },
    useMutation: () => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock("./components/dialogs/ActionConfirmDialog", () => ({ default: () => null }));
vi.mock("./components/dialogs/AuditTrailDialog", () => ({ default: () => null }));
vi.mock("./components/dialogs/ConsolidateDialog", () => ({ default: () => null }));
vi.mock("./components/dialogs/ProposalDetailsDialog", () => ({ default: () => null }));
vi.mock("../../components/myproposal/ProposalVersionHistoryDialog", () => ({
  default: () => null,
}));

import ProposalOperationsHub from "./ProposalOperationsHub";

const createProposal = (modelType, status = "DRAFT") => ({
  _id: `proposal-${modelType}-${status}`,
  responsibilityCenter: "CAR",
  region: "CAR",
  fiscalYear: "2027",
  modelType,
  budgetType: modelType,
  status,
  createdAt: "2026-08-24T00:00:00.000Z",
  projectedCorporateIncome: 0,
  projectedSubsidy: 0,
  proposedBudget: 0,
});

const renderHub = () =>
  render(
    <MemoryRouter>
      <ProposalOperationsHub />
    </MemoryRouter>
  );

describe("ProposalOperationsHub action-menu lifecycle", () => {
  beforeEach(() => {
    testState.currentUser = {
      id: "preparer-1",
      name: "Budget Preparer",
      Roles: ["BUDGET_PREPARER"],
    };
    testState.activeSettings = { budgetType: "Initial", fiscalYear: "2027" };
    testState.proposal = createProposal("Initial");
    mockApiGet.mockResolvedValue({ data: { data: [] } });
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("keeps the active Initial submit action after menu effects settle", async () => {
    renderHub();

    fireEvent.click(await screen.findByRole("button", { name: /actions/i }));

    await waitFor(() => {
      expect(screen.queryByText("Submit Initial Proposal to Budget Reviewer")).toBeTruthy();
    });
    expect(screen.queryByText("Open NEP Proposal")).toBeNull();
  });

  it("keeps active NEP Tier and submission actions after menu effects settle", async () => {
    testState.activeSettings = { budgetType: "NEP", fiscalYear: "2027" };
    testState.proposal = createProposal("NEP");
    renderHub();

    fireEvent.click(await screen.findByRole("button", { name: /actions/i }));

    await waitFor(() => {
      expect(screen.queryByText("Open NEP Proposal")).toBeTruthy();
      expect(screen.queryByText("Submit NEP Proposal to Budget Reviewer")).toBeTruthy();
    });
  });

  it("opens the dedicated NEP proposal page from the NEP adjustment action", async () => {
    testState.activeSettings = { budgetType: "NEP", fiscalYear: "2027" };
    testState.proposal = createProposal("NEP");
    mockApiGet.mockImplementation(url =>
      Promise.resolve({
        data: url === "/settings/active" ? testState.activeSettings : { data: [] },
      })
    );
    renderHub();

    fireEvent.click(await screen.findByRole("button", { name: /actions/i }));
    fireEvent.click(await screen.findByText("Open NEP Proposal"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        `/nep-proposal/${testState.proposal._id}`
      );
    });
  });

  it("updates an open NEP menu when the cached active model changes", async () => {
    testState.activeSettings = { budgetType: "NEP", fiscalYear: "2027" };
    testState.proposal = createProposal("NEP");
    const view = renderHub();

    fireEvent.click(await screen.findByRole("button", { name: /actions/i }));
    expect(await screen.findByText("Open NEP Proposal")).toBeTruthy();

    testState.activeSettings = { budgetType: "Initial", fiscalYear: "2027" };
    view.rerender(
      <MemoryRouter>
        <ProposalOperationsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText("Open NEP Proposal")).toBeNull();
      expect(screen.queryByText("Submit NEP Proposal to Budget Reviewer")).toBeNull();
    });
  });

  it("keeps an authorized return available without running the active-cycle click guard", async () => {
    testState.currentUser = {
      id: "reviewer-1",
      name: "Budget Reviewer",
      Roles: ["BUDGET_REVIEWER"],
    };
    testState.activeSettings = { budgetType: "Initial", fiscalYear: "2027" };
    testState.proposal = createProposal("NEP", "FORWARDED_TO_REVIEWER");
    renderHub();

    fireEvent.click(await screen.findByRole("button", { name: /actions/i }));
    const returnAction = await screen.findByText("Return to Budget Preparer");
    expect(screen.queryByText("Approve & Forward to Budget Approver")).toBeNull();

    mockApiGet.mockClear();
    fireEvent.click(returnAction);

    await waitFor(() => {
      const requestedActiveSettings = mockApiGet.mock.calls.some(
        ([url]) => url === "/settings/active"
      );
      expect(requestedActiveSettings).toBe(false);
    });
  });
});
