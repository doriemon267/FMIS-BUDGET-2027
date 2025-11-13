# 403 Forbidden Error Fix - Status Mapping for Returned Statuses
**Date:** November 13, 2025

## Problem
When users (especially Budget Planning Analyst, Budget Officer) tried to perform actions on proposals that had been returned to them, they received:
```
POST http://localhost:5005/api/proposals/.../action 403 (Forbidden)
Error performing action: AxiosError {message: 'Request failed with status code 403'...}
```

## Root Cause
The `canPerformAction()` function was missing status mappings for all the "Returned to" statuses. When a proposal status was "Returned to Budget Planning Analyst" or "Returned to Budget Officer", these specific statuses weren't in the `statusMapping` object, so they couldn't be converted to the correct workflow enum format.

**Example:**
```javascript
// DB Status: "Returned to Budget Planning Analyst"
// Expected Mapping: "RETURNED_TO_PLANNING_ANALYST"
// Actual Mapping: NOT IN statusMapping → Failed validation → 403 Error ❌
```

## Solution
Added complete status mappings for all "Returned to" variations in both the `canPerformAction()` and `performAction()` functions.

**File:** `SERVER/controllers/newProposalWorkflowController.js`

### Before - Missing Mappings
```javascript
const statusMapping = {
  'Draft': 'DRAFT',
  'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
  'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
  'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
  'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
  'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
  'Finalized': 'FINALIZED',
  'Returned': 'RETURNED_TO_PREPARER'
  // ❌ Missing: Returned to Reviewer, Returned to Approver, etc.
};
```

### After - Complete Mappings ✅
```javascript
const statusMapping = {
  'Draft': 'DRAFT',
  'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
  'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
  'Forwarded to Budget Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
  'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
  'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
  'Finalized': 'FINALIZED',
  'Returned': 'RETURNED_TO_PREPARER',
  'Returned to Reviewer': 'RETURNED_TO_REVIEWER',           // ✅ NEW
  'Returned to Approver': 'RETURNED_TO_APPROVER',           // ✅ NEW
  'Returned to Budget Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST', // ✅ NEW
  'Returned to Budget Officer': 'RETURNED_TO_OFFICER'       // ✅ NEW
};
```

## What This Fixes

### Users Can Now:
1. ✅ **Budget Planning Analyst** can perform actions when status = "Returned to Budget Planning Analyst"
2. ✅ **Budget Officer** can perform actions when status = "Returned to Budget Officer"
3. ✅ **Budget Reviewer** can perform actions when status = "Returned to Reviewer"
4. ✅ **Budget Approver** can perform actions when status = "Returned to Approver"

### Actions Available After Fix:
- Return proposals to previous stage
- Forward to next stage in workflow
- Finalize (for Budget Manager)

## How The Fix Works

1. User clicks "Actions" → selects action (e.g., "Forward to Budget Officer")
2. Frontend sends POST to `/api/proposals/{id}/action` with action type
3. Backend `performAction()` function is called
4. Backend gets current proposal status (e.g., "Returned to Budget Planning Analyst")
5. `statusMapping` converts it to workflow enum (e.g., "RETURNED_TO_PLANNING_ANALYST")
6. `canPerformAction()` checks if user can perform the action with this status → ✅ NOW WORKS
7. Workflow transition is performed → Status updates successfully → 200 OK

## Files Modified

**`SERVER/controllers/newProposalWorkflowController.js`**
- Updated `canPerformAction()` function (line ~103)
- Updated `performAction()` function (line ~467)
- Both now include complete status mappings

## Testing

After fix, try:
1. Have a proposal in "Returned to Budget Planning Analyst" status
2. Login as Budget Planning Analyst
3. Go to "Pending Review" tab
4. Click "Actions" → "Forward to Budget Officer"
5. **Expected:** Action completes successfully (200 OK)
6. **Before Fix:** 403 Forbidden error

## Related Issues Resolved

This also handles the transition table properly for all roles returning proposals:
- BUDGET REVIEWER returns to BUDGET PREPARER ✅
- BUDGET APPROVER returns to BUDGET REVIEWER ✅
- BUDGET PLANNING ANALYST returns to BUDGET APPROVER ✅
- BUDGET OFFICER returns to BUDGET PLANNING ANALYST ✅
- BUDGET MANAGER returns to BUDGET OFFICER ✅

All return statuses now properly map to their workflow enums for action validation.
