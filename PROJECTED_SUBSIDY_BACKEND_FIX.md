# Projected Subsidy Fix - Backend Calculation

## Issue
The "Projected Subsidy" in the main proposal list (table view) was incorrect because the backend calculation logic did not match the frontend logic for Personnel Services.
Specifically, the backend was only summing `subsidyAmount` for all Personnel Services items, whereas regular items (not charged to income) should have their entire `Total` counted as subsidy.

## Fix Applied
Updated `SERVER/utils/recalculateProposalTotals.js`:

1.  **Updated `psSubsidyTotal` Calculation**:
    *   Used MongoDB `$cond` operator to apply the correct logic:
        *   If `chargedToIncomeEligible` is **TRUE**: Use `subsidyAmount`.
        *   If `chargedToIncomeEligible` is **FALSE**: Use `Total`.
2.  **Updated `adjustedSubsidyTotal`**:
    *   Removed the deduction of `chargedToIncomeSubsidyTotal` because `psSubsidyTotal` now correctly accounts for the subsidy portion of charged-to-income items directly.

## Verification
1.  Trigger a recalculation of the proposal (e.g., by saving a line item or updating the proposal details).
2.  The "Projected Subsidy" in the main table should now reflect the correct value (approx ₱26M based on user data).
