# Projected Subsidy Calculation Fix

## Issue
The "Projected Subsidy" in the Proposal Details dialog was displaying as ₱0.00 or incorrect values. This was due to:
1. Backend API returning `subsidy` values as strings (e.g., "1000").
2. Frontend calculation logic performing string concatenation instead of numerical addition.
3. Missing explicit type casting for `projectedCorporateIncome`.

## Fix Applied
Modified `calculateProjectedSubsidy` and `calculateTotalBudget` in `CLIENT/src/pages/NewProposalWorkflowPage.jsx` to:
1. Explicitly cast `item.subsidy`, `item.totalSubsidy`, and `item.subsidyAmount` to `Number()` before summing.
2. Handle `NaN` values gracefully.
3. Cast `selectedProposal.projectedCorporateIncome` to `Number()` in total budget calculation.

## Verification
- Open the "Proposal Details" dialog.
- The "Projected Subsidy" field should now display the correct sum of MOOE, Personnel, and Capital Outlay subsidies.
- The "Total Proposed Budget" should correctly sum the Income and Subsidy components.
