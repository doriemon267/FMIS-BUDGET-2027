# Projected Subsidy Fix - Personnel Services Logic

## Issue
The "Projected Subsidy" calculation for Personnel Services was incorrect. It was only summing `subsidyAmount` (which is often 0) and excluding all "charged to income" items, but failing to include the `Total` amount for regular items.

## User Clarification
"yung sa personnelservices ang hindi naisasama kasi yung total kasi sa personnelservices ay automatic sa subsidy yun maliban lang kung naka charged to income"
(The Personnel Services are not being included because the total in Personnel Services is automatically subsidy, unless it is charged to income).

## Fix Applied
Updated `calculateProjectedSubsidy` in `CLIENT/src/pages/NewProposalWorkflowPage.jsx`:

1.  **Removed the filter** that excluded `chargedToIncomeEligible` items upfront.
2.  **Updated Summation Logic**:
    *   If `item.chargedToIncomeEligible` is **TRUE**: Only add `item.subsidyAmount` (explicit subsidy portion).
    *   If `item.chargedToIncomeEligible` is **FALSE**: Add `item.Total` (the entire amount is subsidy).

## Verification
1.  Open the "Proposal Details" dialog.
2.  The "Projected Subsidy" should now include the full `Total` of all Personnel Services items that are NOT charged to income.
