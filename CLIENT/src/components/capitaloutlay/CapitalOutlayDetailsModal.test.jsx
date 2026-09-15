// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mui/material", async () => {
  const ReactModule = await import("react");
  const container = (element) =>
    ReactModule.forwardRef(function MockContainer(
      { children, open = true, ...props },
      ref
    ) {
      const safeProps = Object.fromEntries(
        Object.entries(props).filter(([key]) =>
          ["disabled", "onClick", "role", "title", "type"].includes(key)
        )
      );
      return open
        ? ReactModule.createElement(element, { ...safeProps, ref }, children)
        : null;
    });

  const TextField = ReactModule.forwardRef(function MockTextField(
    {
      InputProps,
      disabled,
      error,
      helperText,
      inputProps,
      inputRef,
      multiline,
      onChange,
      placeholder,
      value,
    },
    ref
  ) {
    const field = ReactModule.createElement(multiline ? "textarea" : "input", {
      ...inputProps,
      "aria-invalid": error ? "true" : "false",
      disabled,
      onChange,
      placeholder,
      ref: inputRef || ref,
      value,
    });
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      field,
      helperText && ReactModule.createElement("span", null, helperText),
      InputProps?.inputComponent && null
    );
  });

  return {
    Alert: container("div"),
    Box: container("div"),
    Button: container("button"),
    CircularProgress: container("span"),
    Dialog: container("div"),
    DialogActions: container("div"),
    DialogContent: container("div"),
    DialogTitle: container("div"),
    Divider: container("hr"),
    IconButton: container("button"),
    Paper: container("div"),
    Table: container("table"),
    TableBody: container("tbody"),
    TableCell: container("td"),
    TableContainer: container("div"),
    TableHead: container("thead"),
    TableRow: container("tr"),
    TextField,
    Tooltip: container("span"),
    Typography: container("span"),
  };
});

vi.mock("@mui/icons-material", () => ({
  Add: () => null,
  Close: () => null,
  Delete: () => null,
  Save: () => null,
}));

vi.mock("../../config/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../context/UserContext", () => ({
  useUser: () => ({ currentUser: { FirstName: "Budget", LastName: "Encoder" } }),
}));

vi.mock("../../context/RegionContext", () => ({
  useRegion: () => ({ activeRegion: { name: "CAR" } }),
}));

vi.mock("../../hooks/useWorkflowRef", () => ({
  useWorkflowRef: () => ({
    workflowRef: "proposal-1",
    headerConfig: () => ({}),
  }),
}));

import CapitalOutlayDetailsModal from "./CapitalOutlayDetailsModal";

const particularsPlaceholder =
  "Enter description (e.g., Construction of Operation Room)";

const renderModal = () =>
  render(
    <CapitalOutlayDetailsModal
      open
      onClose={vi.fn()}
      temporaryItem={{
        isTemporary: true,
        accountingTitle: "Buildings",
      }}
    />
  );

afterEach(() => {
  cleanup();
});

describe("CapitalOutlayDetailsModal row insertion", () => {
  it("prepends a blank row and focuses its Particulars field", async () => {
    renderModal();

    const originalInput = await screen.findByPlaceholderText(particularsPlaceholder);
    fireEvent.change(originalInput, { target: { value: "Existing particular" } });
    fireEvent.click(screen.getByRole("button", { name: /add row/i }));

    const inputs = screen.getAllByPlaceholderText(particularsPlaceholder);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("Existing particular");
    await waitFor(() => expect(inputs[0]).toHaveFocus());
  });

  it("keeps an existing validation error with its row after prepending", async () => {
    renderModal();

    await screen.findByPlaceholderText(particularsPlaceholder);
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(screen.getByPlaceholderText(particularsPlaceholder)).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: /add row/i }));

    const inputs = screen.getAllByPlaceholderText(particularsPlaceholder);
    expect(inputs[0]).toHaveAttribute("aria-invalid", "false");
    expect(inputs[1]).toHaveAttribute("aria-invalid", "true");
  });
});
