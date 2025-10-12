# Workflow & Proposal Dialog Updates (Oct 2025)

This note summarizes the UI/UX and functional changes applied to the Proposal Details dialog and Workflow Progress, plus server-side consistency for Capital Outlay particulars. It also includes quick verification and how-to-run/backfill steps.

## What changed

- Single comparison view in view-only
  - In read-only statuses (e.g., Office Approved, Finalized), the dialog renders one clean comparison table (analyst-style) for all roles.
  - The dialog prefetches comparison data even when editing isn’t allowed to avoid blanks.

- Budget Manager tables: pagination + totals
  - Sticky headers, client-side pagination, and totals rows for Budget Manager submission tables.

- Compact Summary header
  - Reduced vertical padding/typography for a smaller header footprint.

- Banners cleaned up
  - Removed debug banners and the green informational banner in the comparison view.

- Workflow Progress stepper: adaptive and clearer
  - Colored icons and tooltips show per-step timestamp and actor.
  - Status synonym mapping fixed (e.g., Office Submitted → Submitted to Officer).
  - Office Approved now treated as the final step when there is no manager phase. Indicators correctly light the last step in those flows.

- Capital Outlay particulars consistency
  - When saving/deleting CO details, a particulars summary is propagated to the parent CapitalOutlay.
  - A backfill script updates existing records missing particulars using their details[].

## How to verify quickly

1) View-only dialog
- Open a proposal with status Office Approved. The dialog should show one comparison table (no extra banners), and the Summary header is compact.

2) Workflow indicators
- Open Track progress for a proposal that ends at Office Approved (no manager phase): the last step should be active (label shows Office Approved).
- Open one that goes to Manager: steps include Manager and Finalized; Office Approved sits in the middle.

3) Budget Manager tables
- For Office Submitted, Budget Manager can edit and approve. Tables have sticky headers, pagination, and totals.

4) Capital Outlay particulars
- Editing CO details updates the parent CapitalOutlay.particulars automatically.
- For older data, run the backfill script once (see below).

## How to run/backfill (optional)

- Start backend/server per your usual process.
- To backfill CO particulars once, run:

```powershell
npm run backfill:co-particulars
```

This scans CapitalOutlay for empty/missing particulars and builds them from details[].

## Notes & follow-ups

- Status chip/icon palette can be aligned further to the global theme if desired.
- Summary header can be made collapsible-by-default in read-only mode if requested.

## Related files

- Client
  - `CLIENT/src/components/myproposal/ProposalDetailsDialog.jsx`
  - `CLIENT/src/components/myproposal/BudgetManagerSubmissionView.jsx`
  - `CLIENT/src/components/myproposal/BudgetAnalystComparisonView.jsx`
  - `CLIENT/src/components/myproposal/tables/ComparisonCapitalOutlayTable.jsx`
  - `CLIENT/src/components/workflow/WorkflowActions.jsx`
- Server
  - `SERVER/controllers/capitalOutlayDetailsController.js`
  - `SERVER/scripts/backfill-capitaloutlay-particulars.js`
- Scripts
  - `package.json` → `backfill:co-particulars`
