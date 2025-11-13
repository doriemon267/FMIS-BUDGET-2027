# Filter Status Dropdown - Status Mismatch Fix
**Date:** November 13, 2025
**Issue:** "Forwarded to Manager" filter wasn't working - showed 0 results

## Problem

The status filter dropdown was showing abbreviated status names like:
- "Forwarded to Analyst" 
- "Forwarded to Officer"
- "Forwarded to Manager"

But the database stored the actual full names:
- "Forwarded to Budget Planning Analyst"
- "Forwarded to Budget Officer"
- "Forwarded to Overall Budget Approver"

**Result:** When you selected "Forwarded to Manager", it looked for that exact string in the database... and found nothing! → 0 Results ❌

## Root Cause

The filter logic was comparing enum values directly:
```javascript
// WRONG:
const matchesFilter = filterStatus === 'all' || proposal.status === filterStatus;
// Comparing: "FORWARDED_TO_BRD_MANAGER" === "Forwarded to Overall Budget Approver" → FALSE ❌
```

## Solution

Added a mapping between enum values and actual database status values:

**File:** `CLIENT/src/pages/NewProposalWorkflowPage.jsx`

### Step 1: Created Status Enum-to-DB Mapping
```javascript
const statusEnumToDbMap = {
  'DRAFT': 'Draft',
  'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
  'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
  'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Budget Planning Analyst',
  'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
  'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Overall Budget Approver', // ✅ KEY FIX
  'FINALIZED': 'Finalized',
  'RETURNED_TO_PREPARER': 'Returned to Preparer',
  'RETURNED_TO_REVIEWER': 'Returned to Reviewer',
  'RETURNED_TO_APPROVER': 'Returned to Approver',
  'RETURNED_TO_PLANNING_ANALYST': 'Returned to Budget Planning Analyst',
  'RETURNED_TO_BRD_OFFICER': 'Returned to Budget Officer',
  'RETURNED': 'Returned'
};
```

### Step 2: Updated Filter Logic
```javascript
// OLD (broken):
const matchesFilter = filterStatus === 'all' || proposal.status === filterStatus;

// NEW (fixed):
const filterDbStatus = statusEnumToDbMap[filterStatus];
const matchesFilter = filterStatus === 'all' || proposal.status === filterDbStatus;
```

### Step 3: Updated Menu Item Labels
Changed labels to show full names for clarity:
```javascript
// Before: "Forwarded to Manager" ❌ (misleading)
// After: "Forwarded to Overall Budget Approver" ✅ (matches database)
```

## Results

Now when you select a status from the filter dropdown:

✅ "Forwarded to Overall Budget Approver" → Correctly finds all proposals with that status
✅ "Forwarded to Budget Planning Analyst" → Correctly finds all proposals with that status
✅ "Forwarded to Budget Officer" → Correctly finds all proposals with that status
✅ All other statuses work correctly

## Files Changed

- `CLIENT/src/pages/NewProposalWorkflowPage.jsx`
  - Added statusEnumToDbMap
  - Updated filter logic to use the mapping
  - Updated menu item labels to match database values

## Testing

To verify the fix works:

1. Reload the application
2. Go to "All Proposals" tab
3. Open the "Filter by Status" dropdown
4. Select any status (e.g., "Forwarded to Overall Budget Approver")
5. Should see proposals with that status ✅

Before: Would show 0 results for "Forwarded to Manager"
After: Shows correct results for "Forwarded to Overall Budget Approver" ✅

## Technical Details

The issue existed because:
1. Frontend was using ENUM values (like FORWARDED_TO_BRD_MANAGER) as keys
2. Database stores human-readable strings (like "Forwarded to Overall Budget Approver")
3. Direct string comparison failed to match

Solution: Map between the two formats before comparing.

This pattern should be used anywhere we convert between:
- Internal enum representations
- User-facing display labels
- Database stored values
