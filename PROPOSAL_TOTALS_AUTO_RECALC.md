# Proposal Totals Auto-Recalculation (October 2025)

This document explains how Proposal totals are now kept in sync automatically after edits across MOOE, Personnel Services (PS), Capital Outlay (CO), and Income, plus the related admin endpoint and maintenance script.

## What changed

- After successful saves/updates in any budget module, the server recalculates totals and persists them on the corresponding `db.proposals` document.
- MOOE entries can be edited while status is Returned, fixing the previous “cannot save” issue.
- Totals now match the UI’s Budget Summary logic:
  - Projected Corporate Income = sum of Income amounts
  - Projected Subsidy = sum of subsidy fields from MOOE and CO (not their costs)
  - Total Expenses = PS total + MOOE amount total + CO amount/cost total
  - Proposed Budget = Total Expenses + Projected Corporate Income

## Where it lives

- Recalc utility: `SERVER/utils/recalculateProposalTotals.js`
- Controllers that trigger auto-recalc:
  - `SERVER/controllers/mooeController.js` (bulkSaveMOOE)
  - `SERVER/controllers/personnel_service_controller.js` (bulkAddPersonnelServices, updatePersonnelService)
  - `SERVER/controllers/capitalOutlayController.js` (addCapitalOutlay, editCapitalOutlay)
  - `SERVER/controllers/IncomeController.js` (createIncome, updateIncome)
- Admin/API endpoints:
  - `POST /api/proposals/:id/recalculate` (registered in `SERVER/routers/proposalRoutes.js` and `proposalRoutesRBAC.js`)
    - In RBAC routes this requires Admin role; in the standard routes it is behind auth + submission workflow controls.
- Maintenance script:
  - `SERVER/scripts/recalculate-all-proposals.js`
  - NPM script: `recalc:proposals`

## How the recalc works

The recalculation function:

- Attempts to aggregate by `proposalId` first for each module; if no records are linked, it falls back to keys: `fiscalYear`, `budgetType`, `region`, and optionally `processBy`.
- Intentionally does not require `department`/`division` in the aggregate match to include legacy rows missing those fields.
- Writes the following fields back to the Proposal:
  - `totalIncome`
  - `totalExpenses`
  - `projectedCorporateIncome` (same as totalIncome)
  - `projectedSubsidy` (MOOE subsidy + CO subsidy)
  - `proposedBudget`

Utility entry point: `recalculateAndSaveProposalTotals({ proposalId })`.

## API: Recalculate a specific Proposal

- Method: POST
- Path: `/api/proposals/:id/recalculate`
- Auth:
  - RBAC router: Admin only
  - Standard router: Authenticated; also protected by submission workflow middleware

Response example:

```
{
  "success": true,
  "message": "Proposal totals recalculated",
  "result": {
    "proposalId": "...",
    "totals": {
      "income": 12345,
      "personnel": 6789,
      "mooe": 1000,
      "capitalOutlay": 2000,
      "expenses": 9789,
      "subsidies": 500,
      "proposedBudget": 22134
    }
  }
}
```

## Script: Recalculate all Proposals

Prerequisites:

- Ensure the SERVER `.env` is configured for MongoDB connection (the script loads `.env` via `dotenv`).

Run from repository root on Windows PowerShell:

```powershell
npm run recalc:proposals
```

What it does:

- Iterates all `db.proposals` and recalculates totals.
- Logs progress and counts of succeeded/failed recalc operations.

## MOOE: Save while Returned

Fixes applied in `bulkSaveMOOE`:

- Update filter now allows editing when status is in editable states: Draft or Returned (including common variants like `Division Draft`, `Responsibility Center Draft`, `DRAFT`, `RETURNED`).
- Avoids duplicate-key upserts by updating existing rows within these statuses instead of forcing inserts.
- After successful bulk write, triggers proposals totals recalculation based on fiscal year/budget type/region/processBy.

Client resiliency (`CLIENT/src/components/mooe/MooeTable.jsx`):

- Treats certain server 500 responses with `success: true` as partial success and still invalidates/refreshes caches, preventing data loss when a batch has partial writes.

## Budgetary Support alignment

Client fix in `BudgetarySupportTable.jsx`:

- Capital Outlay list is flattened before applying assignment filters, ensuring totals are computed over actual items rather than nested region wrappers.

## Troubleshooting

- “Totals don’t update after save”
  - Check server logs for the recalculation log lines (e.g., `🔄 [MOOE]/[PS]/[CO]/[Income] Recalculated totals ...`).
  - If records aren’t linked by `proposalId`, ensure they match at least by `fiscalYear`, `budgetType`, `region`, and ideally `processBy`.

- “Script cannot connect to DB”
  - Verify SERVER `.env` and that `SERVER/config/mongo_db` resolves your connection string.

- “Editing MOOE still blocked on Returned”
  - Confirm the row `status` is exactly one of the allowed variants; legacy custom statuses may need mapping.

## Audit trail

- Changes landed in branch: `reorg/preserve-history`
- Commit message (summary):
  - feat(proposals): auto-recalc totals after saves across MOOE/PS/CO/Income; fix MOOE Returned save path; add admin recalc endpoint and bulk recalc script; align subsidy logic with UI; minor UI robustness in BudgetarySupportTable/MooeTable
