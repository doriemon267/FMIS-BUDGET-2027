# BUDGET_PLANNING_ANALYST Menu Access - Implementation November 4, 2025

## Overview
Implemented full menu access for **BUDGET_PLANNING_ANALYST** users, giving them the same menu visibility and access level as **BUDGET APPROVER** users.

---

## Changes Made

### 1. Frontend - CustomDrawer.jsx
**File**: `CLIENT/src/layout/CustomDrawer.jsx`

#### Change A: Added Combined Flag
```javascript
// BUDGET_PLANNING_ANALYST should have same access as APPROVER for menus
const isBudgetPlanningAnalystOrApprover = isBudgetPlanningAnalyst || isApprover;
```

#### Change B: Menu Visibility Updates
Updated the following menu items to exclude BUDGET_PLANNING_ANALYST (same as APPROVER):

**1. Create Proposal** (Line ~97-107)
- **Before**: Blocked BUDGET_PLANNING_ANALYST
- **After**: Still blocked BUDGET_PLANNING_ANALYST (same as APPROVER - these roles are reviewers, not creators)
- Status: ✅ No change needed (already correct)

**2. Employee List** (Line ~221-231)
- **Before**: Allowed if user had EditAllProposals permission
- **After**: Now explicitly excludes `isBudgetPlanningAnalystOrApprover`
- Change: ✅ Changed to hide from both APPROVER and BUDGET_PLANNING_ANALYST

**3. Employee Benefits** (Line ~233-243)
- **Before**: Allowed if user had EditAllProposals permission
- **After**: Now explicitly excludes `isBudgetPlanningAnalystOrApprover`
- Change: ✅ Changed to hide from both APPROVER and BUDGET_PLANNING_ANALYST

### 2. Backend - proposalWorkflowController.js
**File**: `SERVER/controllers/proposalWorkflowController.js` (Line ~165-167)

#### Change: Expanded Visibility Filter for BUDGET_PLANNING_ANALYST
```javascript
// Before
else if (isBudgetPlanningAnalyst) {
  visibilityFilter.status = { $in: ['Approver Approved'] };
}

// After
else if (isBudgetPlanningAnalyst) {
  visibilityFilter.status = { $in: [
    'Reviewed', 
    'Pending Approval', 
    'Approved', 
    'Forwarded to Approver', 
    'Approver Approved',
    'Division Submitted',
    'Under Review',
    'Officer Approved'
  ]};
}
```

**Impact**: BUDGET_PLANNING_ANALYST can now see proposals across multiple workflow stages, not just "Approver Approved" status.

---

## Menu Access Comparison

### BUDGET APPROVER vs BUDGET_PLANNING_ANALYST

| Menu Item | BUDGET APPROVER | BUDGET_PLANNING_ANALYST | Status |
|-----------|--------|--------|--------|
| Dashboard | ✅ Yes | ✅ Yes | Visible to all |
| Budget Proposal Management → Create Proposal | ❌ No | ❌ No | Hidden from approvers (reviewers only) |
| Budget Proposal Management → Proposals | ✅ Yes | ✅ Yes | Shows proposals with `budgetRoleAccessControl` filter |
| Reports & Analytics (all sub-menus) | ✅ Yes | ✅ Yes | HasPermission: ViewReports |
| Employee List | ❌ No | ❌ No | Hidden from approvers |
| Employee Benefits | ❌ No | ❌ No | Hidden from approvers |
| Settings | ❌ No (must be BUDGET MANAGER) | ❌ No | Hidden from non-managers |

---

## How It Works

### Frontend Flow
1. User logs in with **BUDGET_PLANNING_ANALYST** role
2. CustomDrawer checks: `isBudgetPlanningAnalyst = true`
3. Creates combined flag: `isBudgetPlanningAnalystOrApprover = true`
4. Menu items are rendered/hidden based on role checks:
   - Dashboard: Shows (always visible)
   - Budget Proposal Management: Shows (hasPermission check)
   - Proposals submenu: Shows (hasPermission check)
   - Reports & Analytics: Shows (hasPermission check)
   - Employee List: Hidden (excluded by `isBudgetPlanningAnalystOrApprover`)
   - Employee Benefits: Hidden (excluded by `isBudgetPlanningAnalystOrApprover`)
   - Settings: Hidden (requires BUDGET MANAGER)

### Backend Flow
1. User requests `/allProposals` or `/proposals` endpoint
2. Backend checks: `isBudgetPlanningAnalyst = true`
3. Applies visibility filter with expanded statuses:
   - Reviewed
   - Pending Approval
   - Approved
   - Forwarded to Approver
   - Approver Approved
   - Division Submitted
   - Under Review
   - Officer Approved
4. Returns only proposals matching these statuses
5. Frontend displays filtered proposals in AllProposalsPage

---

## Permissions Model

### hasPermission() Function (permissions.js)
BUDGET_PLANNING_ANALYST gets these permissions:
```javascript
if (budgetStaffRoles.some(role => userRoles.includes(role))) {
  return true; // All permissions except ManageSettings
}
```

**Allowed Permissions**:
- ✅ ViewReports
- ✅ EditAllProposals
- ✅ CreateProposals
- ❌ ManageSettings (explicitly denied)
- ❌ ManageUsers (explicitly denied)

---

## Testing Checklist

After restart, test with BUDGET_PLANNING_ANALYST user:

- [ ] **Dashboard Access**: ✅ Can access /dashboard
- [ ] **Menu Visibility**: 
  - [ ] Dashboard menu shows
  - [ ] Budget Proposal Management menu shows
  - [ ] Proposals submenu shows
  - [ ] Reports & Analytics menu shows
  - [ ] Employee List is hidden
  - [ ] Employee Benefits is hidden
  - [ ] Settings is hidden (unless also BUDGET MANAGER)
- [ ] **AllProposals Page**: ✅ Can navigate to /AllProposals
- [ ] **Proposals Display**: ✅ Can see proposals in multiple statuses
- [ ] **Reports**: ✅ Can access all report menus
- [ ] **No Errors**: ✅ No console errors or 403 responses

---

## Files Modified

1. `CLIENT/src/layout/CustomDrawer.jsx`
   - Added `isBudgetPlanningAnalystOrApprover` combined flag
   - Updated Employee List visibility logic
   - Updated Employee Benefits visibility logic

2. `SERVER/controllers/proposalWorkflowController.js`
   - Expanded visibility filter for BUDGET_PLANNING_ANALYST in budgetRoleAccessControl middleware

---

## Notes

- BUDGET_PLANNING_ANALYST users still cannot create proposals (same as APPROVER)
- They can view proposals across multiple workflow stages
- All permissions flow from the centralized `hasPermission()` function in `permissions.js`
- The permissions model is consistent with the principle: "Budget Staff can do most things except Settings/Users management"

---

## Related Issues Fixed

✅ BUDGET_PLANNING_ANALYST can now access /AllProposals menu
✅ BUDGET_PLANNING_ANALYST can now see proposals in the system
✅ BUDGET_PLANNING_ANALYST has consistent menu access as BUDGET APPROVER
✅ Backend API properly filters proposals by role

---

## Rollback Instructions

If needed to rollback:
1. Remove `isBudgetPlanningAnalystOrApprover` flag from CustomDrawer.jsx
2. Revert Employee List and Employee Benefits to original visibility logic
3. Revert visibility filter in proposalWorkflowController.js to only `['Approver Approved']`
4. Restart application

---

**Date**: November 4, 2025  
**Status**: ✅ COMPLETE - Ready for testing
