# Budget Manager Visibility Fix - November 6, 2025

## Problem Summary
Budget Manager users were not seeing any proposals/data in the system. The "Detailed Records" section was empty.

## Root Cause Analysis

### Issue Location
File: `SERVER/middleware/budgetRoleVisibilityControl.js`

### Why It Happened
The `budgetRoleVisibilityControl` middleware is responsible for filtering proposal visibility based on user roles. However:

1. **Missing Role Recognition**: The middleware did not check for "BUDGET_MANAGER" or "BUDGET MANAGER" roles in the role determination logic (lines 45-65)
   - The role check had cases for: BUDGET_ADMIN, OVERALL_BUDGET_APPROVER, BUDGET_OFFICER, BUDGET_PLANNING_ANALYST, BUDGET APPROVER, BUDGET PREPARER, BUDGET REVIEWER
   - But NO case for BUDGET_MANAGER

2. **Missing Switch Case**: The switch statement that applies visibility filters (lines 230+) also lacked a case for BUDGET_MANAGER
   - BUDGET_ADMIN had `visibilityFilter = {}` (see all data)
   - BUDGET_MANAGER had no equivalent case

3. **Result Chain**:
   - When BUDGET MANAGER logs in → budgetRole remains `null`
   - When budgetRole is `null` → No visibility filter is applied
   - Without visibility filter → Fallback to hierarchical scope checks
   - Budget Manager users aren't assigned hierarchical scopes → No data shown

## Solution Implemented

### Fix 1: Add BUDGET_MANAGER Role Recognition
**Location**: Lines 56-57 in budgetRoleVisibilityControl.js

Added check for both underscore and space variants of BUDGET_MANAGER:
```javascript
} else if (userRoles.includes('BUDGET_MANAGER') || userRoles.includes('BUDGET MANAGER') || 
           workflowRoles.includes('BUDGET_MANAGER') || workflowRoles.includes('BUDGET MANAGER')) {
  budgetRole = 'BUDGET_MANAGER';
}
```

### Fix 2: Add BUDGET_MANAGER Switch Case
**Location**: Lines 239-242 in budgetRoleVisibilityControl.js

Added case that allows Budget Managers to see all proposals:
```javascript
case 'BUDGET_MANAGER':
  // BUDGET_MANAGER: Can see all proposals regardless of status (same as BUDGET_ADMIN)
  visibilityFilter = {}; // No filter for budget managers
  break;
```

## Impact

### What Changed
- Budget Manager users will now see all proposals in all statuses
- This matches the intended behavior where Budget Managers have elevated access similar to BUDGET_ADMIN

### User Experience
1. Budget Manager logs in
2. Opens "My Proposals" or "All Proposals"
3. **Before**: Empty "Detailed Records" section
4. **After**: Full visibility of all proposals with filtering options

### Affected Features
- MyProposals page
- AllProposals page
- Dashboard data
- Any endpoint using budgetRoleVisibilityFilter

## Testing Recommendations

### Manual Testing
1. Log in as a Budget Manager user
2. Navigate to MyProposals or Dashboard
3. Verify that proposals are now visible
4. Test filtering by region, fiscal year, and budget type
5. Verify workflow actions are available

### Data Verification
- Check database for Budget Manager user accounts
- Verify users have "BUDGET MANAGER" or "BUDGET_MANAGER" role
- Confirm proposals exist in the system

## Files Modified
- `SERVER/middleware/budgetRoleVisibilityControl.js`
  - Added BUDGET_MANAGER role detection (line 56)
  - Added BUDGET_MANAGER visibility filter case (lines 239-242)

## Status
✅ **COMPLETE** - Budget Manager visibility issue resolved

## Related Documentation
- RBAC System: `SERVER/docs/RBAC_SYSTEM.md`
- Budget Manager Org Selection: `SERVER/docs/BUDGET_MANAGER_ORG_SELECTION.md`
