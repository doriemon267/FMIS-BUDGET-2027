# Budgetary Support Table Enhancements — October 2025

## Overview
Recent frontend updates ensure the **Budgetary Support** dashboard reflects accurate funding balances and loads noticeably faster. These changes focus on two areas:

1. Correct surplus/deficit calculations across corporate income, subsidy, and proposed budget columns.
2. Smoother table interactions via improved client-side data fetching and caching.

## Surplus/Deficit Computation
The `SURPLUS/DEFICIT` row now displays the real difference between total sources and total uses for each column. The formulas implemented in `Client/src/components/budgetarysupport/BudgetarySupportTable.jsx` are:

- **Projected Corporate Income**
  $$\text{Surplus}_{\text{Corporate}} = \text{Total Corporate Income Sources} - \text{Total Corporate Income Uses}$$
  where:
  - Sources = sum of all corporate income line items (A.1 section).
  - Uses = corporate-income portions allocated in MOOE and Capital Outlay.

- **Projected Subsidy**
  $$\text{Surplus}_{\text{Subsidy}} = \text{Total Subsidy Sources} - \text{Total Subsidy Uses}$$
  where:
  - Sources = Operating Requirements (auto-calculated from budgetary support breakdown).
  - Uses = Personal Services + MOOE Subsidy + Capital Outlay Subsidy.

- **Proposed Budget**
  $$\text{Surplus}_{\text{Proposed}} = \text{Total Proposed Budget Sources} - \text{Total Proposed Budget Uses}$$
  with Proposed totals representing the sum of corporate income and subsidy columns on each side.

When sources and uses match, the surplus displays ₱0.00; otherwise the delta surfaces instantly, highlighting any imbalance.

## Assignment-Aware Filtering
Budgetary calculations now respect hierarchical access beyond simple region selection:

- Records are filtered according to the user’s assignment scope (Full, Region, Division, Department/Office, Responsibility Center).
- Helper utilities normalize region, division, department, and responsibility center names before comparison to avoid casing/format discrepancies.
- Numeric fields are coerced through a common `toNumber` utility to prevent string math issues.

This guarantees totals reflect exactly what the current user is allowed to view or manage.

## Table Performance Improvements
Shared table infrastructure (`Client/src/global/components/CustomTable.jsx`) received several optimizations:

- Debounced search and filter input prevents multiple requests per keystroke.
- React Query now memoizes and reuses query parameters, enabling `keepPreviousData` and a 30-second cache window.
- Loading indicators leverage the combined `isLoading || isFetching` state so the UI remains responsive while new data streams in.

End result: tables feel snappier while preserving up-to-date results when parameters change.

## Verification Checklist
1. **Data Integrity** — Confirm corporate income, subsidy, and proposed totals align between the sources and uses sections.
2. **Surplus/Deficit** — Introduce a deliberate mismatch (e.g., temporary data edit) and verify the delta surfaces in the surplus row.
3. **Performance** — Interact with heavy tables (filter, paginate) to ensure cached data keeps the UI fluid.

## Next Steps
- Extend test coverage to assert surplus/deficit math for multiple sample datasets.
- Evaluate row virtualization for tables with >1,000 records if performance expectations rise further.
- Track any additional hierarchy levels introduced server-side to keep the filters aligned.
