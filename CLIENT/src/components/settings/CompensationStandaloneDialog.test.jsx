// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CompensationStandaloneDialog from "./CompensationStandaloneDialog";
import api from "../../config/api";

vi.mock("../../config/api", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const existing = [{ _id: "existing", name: "Existing", earnedLeaves: 0.0481927, earnedLeaveDays: 0 }];
const mount = (props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dialog = (nextProps) => (
    <QueryClientProvider client={client}>
      <CompensationStandaloneDialog open onClose={vi.fn()} existingCompensations={existing} {...nextProps} />
    </QueryClientProvider>
  );
  const view = render(dialog(props));
  return { ...view, rerenderDialog: (nextProps) => view.rerender(dialog(nextProps)) };
};

describe("earned leave compensation form", () => {
  it("starts at 30 days and saves reduced days with the precise factor", async () => {
    api.post.mockResolvedValue({ data: {} });
    mount();
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("30.00");
    expect(screen.getByLabelText("Earned Leave Conversion Factor")).toHaveValue("0.0481927");
    fireEvent.change(screen.getByLabelText("Compensation Name"), { target: { value: "Reduced budget" } });
    fireEvent.change(screen.getByLabelText("Earned Leave Days"), { target: { value: "15" } });
    fireEvent.submit(screen.getByLabelText("Compensation Name").closest("form"));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/compensation", expect.objectContaining({ earnedLeaveDays: 15, earnedLeaves: 0.0481927 })));
  });

  it("loads an existing zero allocation and saves it without reverting to 30", async () => {
    api.put.mockResolvedValue({ data: {} });
    mount({ editData: { ...existing[0], philhealthPremium: 0.05 } });
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("0.00");
    fireEvent.submit(screen.getByLabelText("Compensation Name").closest("form"));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/compensation/existing", expect.objectContaining({ earnedLeaveDays: 0 })));
  });

  it("supplies days for legacy records while preserving their saved factor", () => {
    mount({ editData: { _id: "legacy", name: "Legacy", earnedLeaves: 0 } });
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("30.00");
    expect(screen.getByLabelText("Earned Leave Conversion Factor")).toHaveValue("0");
  });

  it("blocks saving negative days", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Compensation Name"), { target: { value: "Budget" } });
    fireEvent.change(screen.getByLabelText("Earned Leave Days"), { target: { value: "-1" } });
    fireEvent.submit(screen.getByLabelText("Compensation Name").closest("form"));
    await screen.findByText("Days must be 0 or greater");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("restores 30 days when creating after editing another compensation", () => {
    const view = mount({ editData: existing[0] });
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("0.00");
    view.rerenderDialog({ editData: null });
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("30.00");
  });

  it("copies zero days and restores defaults when Start Fresh is selected", async () => {
    mount();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Select Compensation to Copy/ }));
    fireEvent.click(screen.getByRole("option", { name: "Existing" }));
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("0.00");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Select Compensation to Copy/ }));
    fireEvent.click(screen.getByRole("option", { name: /Start Fresh/ }));
    expect(screen.getByLabelText("Earned Leave Days")).toHaveValue("30.00");
  });
});
