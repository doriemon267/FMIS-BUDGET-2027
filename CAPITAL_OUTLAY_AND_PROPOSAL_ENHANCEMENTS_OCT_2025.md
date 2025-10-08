# Capital Outlay & Proposal Enhancements — October 8, 2025

## 📌 Overview
This update focuses on two major areas:

1. **Capital Outlay workspace** — introducing reusable data hooks, unified filters, and table polish to keep large datasets performant and easy to explore.
2. **Proposal Details dialog** — refreshing the summary snapshot with a more informative layout and contextual origin labels tailored to the workflow level (division, office, etc.).

These improvements were delivered in commit `e64d530` on branch `reorg/preserve-history`.

---

## 🧩 Frontend Enhancements

### 1. Capital Outlay Table Suite
- **New shared hook**: `CLIENT/src/components/capitaloutlay/useCapitalOutlayData.js`
  - Centralises fetching, caching, and synchronising capital outlay records.
  - Exposes helpers for pagination, grouping, and automatic detail refresh after edits.
- **Reusable filters panel**: `CLIENT/src/components/capitaloutlay/CapitalOutlayFilters.jsx`
  - Consolidates search, category filtering, and fiscal toggles.
  - Designed for both the classic table and enhanced grid views.
- **Table integrations**: Updated data sources and filter wiring across:
  - `CapitalOutlayDataGrid.jsx`
  - `CapitalOutlayTable.jsx`
  - `CapitalOutlayTableEnhanced.jsx`
- **Editing flows**: Personnel and MOOE editable tables now share the same pagination + data access patterns, reducing duplicated logic.

### 2. Proposal Snapshot Refresh
- **Summary header redesign** (`ProposalDetailsDialog.jsx`):
  - Gradient "Budget Snapshot" card with prominent total amount and last activity timestamp.
  - Metric tiles now display the true origin unit (Responsibility Center → Division → Office → Department → Region) based on available data.
  - Added prop-type coverage for new fields and consolidated proposal fallbacks.
- **Budget officer view tweaks** (`BudgetOfficerEditView.jsx` and comparison tables):
  - Align comparison tables with shared formatting utilities.
  - Ensured new origin data flows through when editing or reviewing proposals.

### 3. Shared Table Utilities
- Personnel, MOOE, and Income tables under `CLIENT/src/components/myproposal/tables/` now leverage the common pagination utilities added during the previous sprint, with minor adjustments to support the new filters.

---

## ⚙️ Backend Touchpoints
- `SERVER/controllers/BudgetManagerOrgController.js`
- `SERVER/controllers/HierarchicalUserAssignmentController.js`
- `SERVER/controllers/budgetOfficerEditController.js`
- `SERVER/controllers/mooeController.js`

Updates ensure the frontend’s new origin resolution logic receives the necessary organisational metadata and that bulk refresh endpoints remain performant after the refactor.

---

## ✅ Testing & Validation
- Targeted ESLint run for the updated proposal dialog: `npx eslint src/components/myproposal/ProposalDetailsDialog.jsx`.
- Manual verification checklist:
  - Apply filters in the capital outlay views and confirm datasets update without page reloads.
  - Open Proposal Details for submissions at different workflow levels (Division, Office, Region) and confirm the summary shows the correct origin label.
  - Edit capital outlay entries and ensure totals refresh automatically through the shared hook.

---

## 📅 Next Steps
- Roll the new filters into additional expenditure modules (Income, Subsidy) for a consistent experience.
- Expand automated tests to cover the origin-selection helper and new hook behaviours.
- Consider migrating remaining documentation for older capital outlay work into this consolidated format.
