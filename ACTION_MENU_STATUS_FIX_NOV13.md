# Budget Planning Analyst Action Menu Fix
**Date:** November 13, 2025

## Problem
Budget Planning Analyst couldn't submit proposals to Budget Officer because the "Forward to Budget Officer" action wasn't appearing in the Actions menu.

## Root Cause
The `getAvailableActions()` function was checking for abbreviated status names that didn't match the actual database statuses:

| Role | Expected Status in Code | Actual Status in DB |
|------|------------------------|-------------------|
| Budget Planning Analyst | `'Forwarded to Analyst'` | `'Forwarded to Budget Planning Analyst'` ❌ |
| Budget Officer | `'Forwarded to Officer'` | `'Forwarded to Budget Officer'` ❌ |
| Budget Manager | `'Forwarded to Manager'` | `'Forwarded to Overall Budget Approver'` ❌ |

Since the statuses didn't match, the action conditions were never true, so no actions appeared.

## Solution
Updated `getAvailableActions()` to use the correct full status names that match the database:

**File:** `CLIENT/src/pages/NewProposalWorkflowPage.jsx` (Lines 492-510)

### Before
```javascript
// BUDGET PLANNING ANALYST actions
if (userRoles.includes('BUDGET PLANNING ANALYST') && (currentStatus === 'Forwarded to Analyst' || currentStatus === 'Returned to Analyst')) {
  // Actions would never show ❌
}

// BUDGET OFFICER actions  
if (userRoles.includes('BUDGET OFFICER') && (currentStatus === 'Forwarded to Officer' || currentStatus === 'Returned to Officer')) {
  // Actions would never show ❌
}

// BUDGET MANAGER actions
if (userRoles.includes('BUDGET MANAGER') && currentStatus === 'Forwarded to Manager') {
  // Actions would never show ❌
}
```

### After
```javascript
// BUDGET PLANNING ANALYST actions ✅ FIXED
if (userRoles.includes('BUDGET PLANNING ANALYST') && (currentStatus === 'Forwarded to Budget Planning Analyst' || currentStatus === 'Returned to Budget Planning Analyst' || currentStatus === 'Returned')) {
  actions.push(
    { label: 'Forward to Budget Officer', value: 'forward-to-officer', icon: <SendIcon />, color: 'primary' },
    { label: 'Return to Budget Approver', value: 'return-to-approver', icon: <RejectIcon />, color: 'warning' }
  );
}

// BUDGET OFFICER actions ✅ FIXED
if (userRoles.includes('BUDGET OFFICER') && (currentStatus === 'Forwarded to Budget Officer' || currentStatus === 'Returned to Budget Officer' || currentStatus === 'Returned')) {
  actions.push(
    { label: 'Forward to Budget Manager', value: 'forward-to-manager', icon: <SendIcon />, color: 'primary' },
    { label: 'Return to Budget Planning Analyst', value: 'return-to-analyst', icon: <RejectIcon />, color: 'warning' }
  );
}

// BUDGET MANAGER actions ✅ FIXED
if (userRoles.includes('BUDGET MANAGER') && (currentStatus === 'Forwarded to Overall Budget Approver' || currentStatus === 'Returned')) {
  actions.push(
    { label: 'Finalize Proposal', value: 'finalize', icon: <ApproveIcon />, color: 'success' },
    { label: 'Return to Budget Officer', value: 'return-to-officer', icon: <RejectIcon />, color: 'warning' }
  );
}
```

## Available Actions by Status

### Budget Planning Analyst
When proposal status = `Forwarded to Budget Planning Analyst`:
- ✅ Forward to Budget Officer
- ✅ Return to Budget Approver

When proposal status = `Returned` (from somewhere):
- ✅ Forward to Budget Officer
- ✅ Return to Budget Approver

### Budget Officer
When proposal status = `Forwarded to Budget Officer`:
- ✅ Forward to Budget Manager
- ✅ Return to Budget Planning Analyst

When proposal status = `Returned`:
- ✅ Forward to Budget Manager
- ✅ Return to Budget Planning Analyst

### Budget Manager
When proposal status = `Forwarded to Overall Budget Approver`:
- ✅ Finalize Proposal
- ✅ Return to Budget Officer

When proposal status = `Returned`:
- ✅ Finalize Proposal
- ✅ Return to Budget Officer

## Testing

Now users should see:
1. **Budget Planning Analyst** can see "Forward to Budget Officer" action ✅
2. **Budget Officer** can see "Forward to Budget Manager" action ✅
3. **Budget Manager** can see "Finalize Proposal" action ✅

## Related Changes

This fix complements:
- Edit permission fix (allows BRD roles to edit items)
- Status mapping fix (ensures "Pending Review" shows correct proposals)
- "My Proposals" filter (only shows draft proposals for preparer)
