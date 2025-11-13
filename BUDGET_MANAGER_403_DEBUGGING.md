# 403 Error Debugging Guide - Budget Manager Finalize Action
**Date:** November 13, 2025

## Problem
Budget Manager is getting 403 Forbidden when trying to Finalize a Proposal.

## Diagnostic Steps

### 1. **Check Server Console Logs**
When the user tries to finalize, look for these logs:

```
[getUserRole] Full req.user object: { ... }
[getUserRole] User Roles from request: ['BUDGET_MANAGER', ...]
[getUserRole] Mapped role: BUDGET MANAGER
[PERFORM_ACTION] User: { userRole: 'BUDGET MANAGER', userId: '...', userName: '...' }
[PERFORM_ACTION] Request: { proposalId: '...', action: 'finalize', comment: '...' }
[PERFORM_ACTION] Proposal Status: 'Forwarded to Overall Budget Approver'
[PERFORM_ACTION] Mapped Workflow Status: FORWARDED_TO_BRD_MANAGER
[canPerformAction] Role: BUDGET MANAGER
[canPerformAction] Available transitions: ['FORWARDED_TO_BRD_MANAGER', 'RETURNED_TO_PREPARER']
[canPerformAction] Transitions for status: { finalize: 'FINALIZED', return-to-officer: 'RETURNED_TO_OFFICER' }
[canPerformAction] Result: true
[PERFORM_ACTION] canPerformAction result: true
[PERFORM_ACTION] Transitions available for role: BUDGET MANAGER ['FORWARDED_TO_BRD_MANAGER', 'RETURNED_TO_PREPARER']
[PERFORM_ACTION] Transitions for status FORWARDED_TO_BRD_MANAGER : { finalize: 'FINALIZED', return-to-officer: 'RETURNED_TO_OFFICER' }
[PERFORM_ACTION] Action finalize available: YES
```

### 2. **If canPerformAction Returns False**
Look for this log:
```
[PERFORM_ACTION] canPerformAction result: false
[PERFORM_ACTION] 403 - User cannot perform action. User role: ??? Action: finalize Status: ???
```

**Troubleshoot:**
- Check the `User role` - should be `'BUDGET MANAGER'`
- Check the `Action` - should be `'finalize'`
- Check the `Status` - should be `'Forwarded to Overall Budget Approver'` or `'Returned'`

If any of these are wrong:
- User role = null/undefined → Check req.user.Roles in middleware
- Action wrong → Check frontend sending wrong action name
- Status wrong → Check what proposal status is in database

### 3. **If User Role is null/undefined**
The issue is in the middleware. Check:
```javascript
// In checkToken.js or check_token.js
req.user = user; // Make sure this is being set
```

Also check if the API response includes the `Roles` field:
```
[getUserRole] Full req.user object shows:
  - Does it have a 'Roles' field?
  - Is 'Roles' an array?
  - Does it contain 'BUDGET_MANAGER' or 'BUDGET MANAGER'?
```

### 4. **If Transitions for Status is undefined**
The status mapping is wrong. Check:
- Actual proposal status in database
- How it maps in statusMapping object
- WORKFLOW_TRANSITIONS has entry for that mapped status

**Expected for Budget Manager:**
- Status `'Forwarded to Overall Budget Approver'` → Maps to `'FORWARDED_TO_BRD_MANAGER'`
- Status `'Returned'` → Maps to `'RETURNED_TO_PREPARER'`

### 5. **Database Check**
Run the test script to verify proposal statuses:
```bash
cd SERVER
node test-budget-manager-finalize.js
```

This will show:
- ✅ Proposals at Budget Manager stage
- ✅ Status in database
- ✅ How it maps to workflow enum
- ✅ Available actions

## Common Issues & Fixes

### Issue 1: User Role = null
**Cause:** Middleware not setting req.user.Roles correctly

**Fix:**
- Check the ACCOUNT_USER_API_URL returns correct format
- Verify API response includes `Roles` field
- Log the API response in middleware

### Issue 2: Status Doesn't Map
**Cause:** Status in database doesn't match any key in statusMapping

**Check in logs:**
```
[PERFORM_ACTION] Proposal Status: 'Some Weird Status'
[PERFORM_ACTION] Mapped Workflow Status: 'Some Weird Status'  // Not mapped! ❌
```

**Fix:**
- Add this status to statusMapping in performAction
- Or update database to use correct status value

### Issue 3: Action Not in Transitions
**Cause:** WORKFLOW_TRANSITIONS doesn't have this action for this role/status

**Check in logs:**
```
[PERFORM_ACTION] Action finalize available: NO  // ❌
```

**Fix:**
- Check WORKFLOW_TRANSITIONS definition
- Ensure 'BUDGET MANAGER' has entry for the status
- Ensure that status has the 'finalize' action defined

## Current Configuration

### Budget Manager Transitions
```javascript
'BUDGET MANAGER': {
  'FORWARDED_TO_BRD_MANAGER': {
    'finalize': 'FINALIZED',           // ✅ Can finalize
    'return-to-officer': 'RETURNED_TO_OFFICER'
  },
  'RETURNED_TO_PREPARER': {
    'finalize': 'FINALIZED',           // ✅ Can finalize
    'return-to-officer': 'RETURNED_TO_OFFICER'
  }
}
```

### Allowed Statuses
- `'Forwarded to Overall Budget Approver'` → Action: finalize ✅
- `'Returned'` → Action: finalize ✅

## Next Steps if Still Failing

1. **Run test script:** `node test-budget-manager-finalize.js`
2. **Check server logs** for the exact issue
3. **Verify database** has proposal at correct status
4. **Verify user** has BUDGET MANAGER role
5. **Check frontend** is sending action='finalize'

If issue persists, share the server logs showing:
- Full req.user object
- Proposal status
- Mapped workflow status
- All the canPerformAction checks

Then we can pinpoint exactly where it's failing.
