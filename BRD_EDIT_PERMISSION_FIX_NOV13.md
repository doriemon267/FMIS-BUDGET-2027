# Budget Planning Analyst Edit Permission Fix
**Date:** November 13, 2025

## Problem
Budget Planning Analyst (and other BRD roles) could see proposals in "Pending Review" but couldn't edit them. The edit controls (pencil icons, text fields) were hidden.

## Root Cause
The `canUserEdit()` function in the frontend only checked for BUDGET REVIEWER and BUDGET APPROVER roles. BRD staff roles (Budget Planning Analyst, Budget Officer, Budget Manager) were excluded, so edit mode was never enabled for them.

## Solution
Updated the `canUserEdit()` function to include all BRD roles with their appropriate status conditions.

**File:** `CLIENT/src/pages/NewProposalWorkflowPage.jsx` (Lines 211-244)

### Before
```javascript
const canUserEdit = () => {
  // Only checked BUDGET REVIEWER and BUDGET APPROVER
  if (userRoles.some(role => ['BUDGET REVIEWER', 'BUDGET_REVIEWER'].includes(role))) {
    return ['Forwarded to Reviewer', 'Returned to Reviewer'].includes(status);
  }
  if (userRoles.some(role => ['BUDGET APPROVER', 'BUDGET_APPROVER'].includes(role))) {
    return ['Forwarded to Approver', 'Returned to Approver'].includes(status);
  }
  return false; // ❌ BRD roles returned false
};
```

### After
```javascript
const canUserEdit = () => {
  // BUDGET REVIEWER
  if (userRoles.some(role => ['BUDGET REVIEWER', 'BUDGET_REVIEWER'].includes(role))) {
    return ['Forwarded to Reviewer', 'Returned to Reviewer'].includes(status);
  }
  // BUDGET APPROVER
  if (userRoles.some(role => ['BUDGET APPROVER', 'BUDGET_APPROVER'].includes(role))) {
    return ['Forwarded to Approver', 'Returned to Approver'].includes(status);
  }
  // BUDGET PLANNING ANALYST ✅ NEW
  if (userRoles.some(role => ['BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST'].includes(role))) {
    return ['Forwarded to Budget Planning Analyst', 'Returned to Budget Planning Analyst', 'Returned'].includes(status);
  }
  // BUDGET OFFICER ✅ NEW
  if (userRoles.some(role => ['BUDGET OFFICER', 'BUDGET_OFFICER'].includes(role))) {
    return ['Forwarded to Budget Officer', 'Returned to Budget Officer', 'Returned'].includes(status);
  }
  // BUDGET MANAGER ✅ NEW
  if (userRoles.some(role => ['BUDGET MANAGER', 'BUDGET_MANAGER'].includes(role))) {
    return ['Forwarded to Overall Budget Approver', 'Returned'].includes(status);
  }
  return false;
};
```

## Edit Conditions by Role

### ✅ Budget Planning Analyst Can Edit When:
- Status = `Forwarded to Budget Planning Analyst`
- Status = `Returned to Budget Planning Analyst`
- Status = `Returned`

### ✅ Budget Officer Can Edit When:
- Status = `Forwarded to Budget Officer`
- Status = `Returned to Budget Officer`
- Status = `Returned`

### ✅ Budget Manager Can Edit When:
- Status = `Forwarded to Overall Budget Approver`
- Status = `Returned`

## What Can Be Edited

When edit mode is enabled, users can edit proposal items:
- ✅ Income/Revenue items
- ✅ Personnel details and amounts
- ✅ MOOE (Maintenance and Other Operating Expenses)
- ✅ Capital Outlay

## User Experience Flow

1. **Budget Planning Analyst** receives proposal at "Forwarded to Budget Planning Analyst" status
2. Opens "View Details" 
3. **Now can edit** all proposal line items ✅
4. Makes changes (amounts, details, etc.)
5. **Saves changes** using "Save Changes" button
6. Proposes action: Forward to Officer, Return to Approver, etc.

## Implementation Details

The `canUserEdit()` function is used to:
- Show/hide edit icons (pencil icons)
- Enable/disable input fields
- Show/hide the "Save Changes" button
- Control edit mode throughout the proposal details dialog

## Testing

Users should now be able to:
1. Login as Budget Planning Analyst
2. Go to "Pending Review" tab
3. See proposals forwarded to them
4. Click "View Details"
5. See editable fields (numbers can be changed)
6. Make edits and save them

## Related Changes

- Backend already supports BRD edits to line items
- Status mappings are correct in all workflows
- Edit endpoints work for all roles
- Only the frontend permission check was missing
