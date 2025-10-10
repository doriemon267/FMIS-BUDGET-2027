# Budget Analyst Comparison Parity Updates

**Date:** 2025-10-08  
**Owner:** Budget Analyst UI/Backend Alignment Taskforce

## Summary
- Restored missing capital outlay titles in the Budget Analyst comparison view by enriching the comparison payload with canonical `categoryName` values.
- Added table pagination, totals chips, and null-safe cell handling to the Personnel Services comparison tab to match the UX provided in other expenditure sections.
- Ensured comparison cells gracefully display em dashes when amounts are absent and highlight numerical deltas without breaking currency formatting.

## Backend Changes
- `SERVER/controllers/budgetOfficerEditController.js`
  - Expanded the capital outlay query population to include `categoryName` data.
  - Normalized the comparison payload so both `categoryName` and legacy `name` fields are considered, preventing "Untitled Title" fallbacks in the UI.

## Frontend Changes
- `CLIENT/src/components/myproposal/tables/ComparisonCapitalOutlayTable.jsx`
  - Hardened currency rendering so placeholders are not passed into `formatCurrency`.
- `CLIENT/src/components/myproposal/tables/ComparisonPersonnelTable.jsx`
  - Introduced pagination (5/10/25/all) with automatic page bounds correction.
  - Added change-summary chips and consistent fallback display for blank values.
  - Wrapped detail accordions per row in `React.Fragment` keyed by the original item id.

## Verification
- `npm test` *(server)* → **Fails** due to pre-existing issues in role visibility and allowance loyalty test suites (unchanged by this work).
- `npm run lint` *(client)* → **Fails** with historical PropTypes/unused-variable errors unrelated to these modifications.

## Follow-ups
- Address global lint and Jest failures so regression checks surface only new issues.
- Schedule UI regression testing on the Budget Analyst comparison dialog to confirm pagination states persist across tab switches.
