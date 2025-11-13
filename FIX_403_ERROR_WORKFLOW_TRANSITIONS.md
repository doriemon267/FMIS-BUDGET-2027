# 403 Forbidden Error - Complete Fix with Workflow Transitions
**Date:** November 13, 2025

## Problem
Users (especially BRD staff) were getting 403 Forbidden errors when trying to perform actions on proposals with certain statuses, even when they had the correct role and permissions.

## Root Causes

### 1. **Missing Status Mappings in canPerformAction**
The function was missing mappings for specific "Returned to" statuses. ✅ FIXED

### 2. **Missing Transitions in WORKFLOW_TRANSITIONS Table**
The BRD roles (Budget Planning Analyst, Budget Officer, Budget Manager) didn't have transition definitions for when status was "Returned" (which maps to RETURNED_TO_PREPARER).

**Example Problem:**
```
Status in DB: "Returned"
Maps to: RETURNED_TO_PREPARER
Budget Planning Analyst checking if they can act...
Looks in WORKFLOW_TRANSITIONS['BUDGET PLANNING ANALYST']['RETURNED_TO_PREPARER']
Result: undefined ❌ Returns false → 403 error
```

## Solutions Implemented

### 1. **Enhanced Status Mappings (Both Functions)**
Added all "Returned to" status variations in both `canPerformAction()` and `performAction()`:
- `Returned` → `RETURNED_TO_PREPARER`
- `Returned to Reviewer` → `RETURNED_TO_REVIEWER`
- `Returned to Approver` → `RETURNED_TO_APPROVER`
- `Returned to Budget Planning Analyst` → `RETURNED_TO_PLANNING_ANALYST`
- `Returned to Budget Officer` → `RETURNED_TO_OFFICER`

### 2. **Extended WORKFLOW_TRANSITIONS for BRD Roles**

**Budget Planning Analyst** now has transitions for:
```javascript
'FORWARDED_TO_BRD_ANALYST': { actions... }
'RETURNED_TO_PLANNING_ANALYST': { actions... }
'RETURNED_TO_PREPARER': { actions... }  // ✅ NEW
```

**Budget Officer** now has transitions for:
```javascript
'FORWARDED_TO_BRD_OFFICER': { actions... }
'RETURNED_TO_OFFICER': { actions... }
'RETURNED_TO_PREPARER': { actions... }  // ✅ NEW
```

**Budget Manager** now has transitions for:
```javascript
'FORWARDED_TO_BRD_MANAGER': { actions... }
'RETURNED_TO_PREPARER': { actions... }  // ✅ NEW
```

### 3. **Added Comprehensive Debug Logging**
Added logging at multiple points to help diagnose 403 errors:
```javascript
[PERFORM_ACTION] User: { userRole, userId, userName }
[PERFORM_ACTION] Request: { proposalId, action, comment }
[PERFORM_ACTION] Proposal Status: (actual status in DB)
[PERFORM_ACTION] Mapped Workflow Status: (enum format)
[canPerformAction] Role, Status, MappedStatus, Action
[canPerformAction] Available transitions, Result
```

This makes it easy to see exactly why a 403 is occurring.

## What This Fixes

### Before Fix ❌
- BRD staff get 403 when proposal status is "Returned"
- Error happens silently with generic 403 message
- Hard to debug without checking logs

### After Fix ✅
- BRD staff can act on proposals in ANY return status
- Clear console logs show exactly what's being checked
- All workflow transitions properly defined
- 403 errors should be gone for legitimate action attempts

## Workflow Statuses BRD Staff Can Now Handle

### Budget Planning Analyst Can Act On:
- ✅ `Forwarded to Budget Planning Analyst`
- ✅ `Returned to Budget Planning Analyst`
- ✅ `Returned` (generic return)

**Available Actions:**
- Forward to Budget Officer
- Return to Budget Approver

### Budget Officer Can Act On:
- ✅ `Forwarded to Budget Officer`
- ✅ `Returned to Budget Officer`
- ✅ `Returned` (generic return)

**Available Actions:**
- Forward to Budget Manager
- Return to Budget Planning Analyst

### Budget Manager Can Act On:
- ✅ `Forwarded to Overall Budget Approver`
- ✅ `Returned` (generic return)

**Available Actions:**
- Finalize Proposal
- Return to Budget Officer

## Files Modified

**`SERVER/controllers/newProposalWorkflowController.js`**
- Updated `WORKFLOW_TRANSITIONS` object (lines 5-65)
  - Added RETURNED_TO_PREPARER transitions for all BRD roles
- Enhanced `canPerformAction()` function (lines 95-127)
  - Added all "Returned to" status mappings
  - Added debug logging
- Enhanced `performAction()` function (lines 465-530)
  - Added status mappings
  - Added comprehensive debug logging

## How to Verify the Fix

1. **Check Logs:**
   - When a user performs an action, the server logs should show:
   ```
   [PERFORM_ACTION] User: { userRole: 'BUDGET PLANNING ANALYST', ... }
   [PERFORM_ACTION] Proposal Status: 'Returned'
   [PERFORM_ACTION] Mapped Workflow Status: 'RETURNED_TO_PREPARER'
   [canPerformAction] Role: BUDGET PLANNING ANALYST
   [canPerformAction] Result: true
   ```

2. **Test Different Statuses:**
   - Create proposal → Submit
   - Someone returns it → User should be able to act
   - User forwards it → Next user should be able to act

3. **If Still Getting 403:**
   - Check console logs for the exact status/role/action combo
   - Verify the role is correctly extracted from req.user.Roles
   - Ensure the database actually has the status that's being checked

## Debugging 403 Errors

If you still encounter 403 errors after this fix:

1. **Check Server Console** for logs showing:
   - What role was detected
   - What status the proposal has
   - What transitions are available for that role
   - Why canPerformAction returned false

2. **Common Issues:**
   - User role not being recognized → Check req.user.Roles
   - Status name mismatch → Check exact status in database
   - Action name mismatch → Ensure frontend and backend use same action names

3. **Next Steps if Issue Persists:**
   - Add user._id to logs to verify auth middleware is working
   - Check if user actually has the role in their Roles array
   - Verify NewProposalWorkflow collection has the proposal
   - Check if status is exactly matching one of the mapped values
