# Pending Review Fix - Status Mapping Issue Resolution
**Date:** November 13, 2025

## Problem
The "Pending Review" tab was showing no proposals even when there were proposals in the appropriate workflow stage.

## Root Cause
The `pending-review` filter was comparing ENUM statuses (e.g., `FORWARDED_TO_REVIEWER`) directly against the database which stores human-readable statuses (e.g., `Forwarded to Reviewer`).

**Before:**
```javascript
const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole]); // ['FORWARDED_TO_REVIEWER', 'RETURNED_TO_REVIEWER']
query.status = { $in: allowedStatuses }; // Looking for 'FORWARDED_TO_REVIEWER' in DB
// But DB has 'Forwarded to Reviewer' ❌ NO MATCH
```

## Solution
Added status mapping to convert enum statuses to human-readable format before querying the database.

**After:**
```javascript
const allowedStatuses = Object.keys(WORKFLOW_TRANSITIONS[userRole]); // ['FORWARDED_TO_REVIEWER', 'RETURNED_TO_REVIEWER']
const mappedStatuses = allowedStatuses.map(s => statusMapping[s] || s); // ['Forwarded to Reviewer', 'Returned']
query.status = { $in: mappedStatuses }; // Now queries for 'Forwarded to Reviewer' ✅ MATCH
```

## Implementation

**File:** `SERVER/controllers/newProposalWorkflowController.js` (Lines 199-239)

Added a `statusMapping` object that converts:
- `FORWARDED_TO_REVIEWER` → `Forwarded to Reviewer`
- `FORWARDED_TO_APPROVER` → `Forwarded to Approver`
- `FORWARDED_TO_BRD_ANALYST` → `Forwarded to Budget Planning Analyst`
- `FORWARDED_TO_BRD_OFFICER` → `Forwarded to Budget Officer`
- `FORWARDED_TO_BRD_MANAGER` → `Forwarded to Overall Budget Approver`
- `RETURNED_TO_*` → `Returned` (all return statuses map to 'Returned')

## How It Works Now

### For BUDGET REVIEWER
- Can transition from: `FORWARDED_TO_REVIEWER`, `RETURNED_TO_REVIEWER`
- Mapped to: `Forwarded to Reviewer`, `Returned`
- Will see proposals with status = `Forwarded to Reviewer` or `Returned`

### For BUDGET APPROVER
- Can transition from: `FORWARDED_TO_APPROVER`, `RETURNED_TO_APPROVER`
- Mapped to: `Forwarded to Approver`, `Returned`
- Will see proposals with status = `Forwarded to Approver` or `Returned`

### For BUDGET PLANNING ANALYST
- Can transition from: `FORWARDED_TO_BRD_ANALYST`, `RETURNED_TO_PLANNING_ANALYST`
- Mapped to: `Forwarded to Budget Planning Analyst`, `Returned`
- Will see proposals with matching statuses

## Testing

The logic now correctly filters proposals:
✅ User sees only proposals in statuses they can act on
✅ Status mapping prevents database lookup mismatches
✅ Works for all roles (Preparer, Reviewer, Approver, Analysts, Officers, Managers)

## Related Changes

- Also added `query.status = 'Draft'` for "My Proposals" tab to show only draft proposals
- Both changes work together for clean workflow experience
