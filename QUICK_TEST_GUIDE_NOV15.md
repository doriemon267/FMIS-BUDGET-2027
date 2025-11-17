# Quick Test Guide - Notification System Fix

## What Was Fixed
The notification system was querying the **wrong user model** for roles.
- ❌ **Before:** Searched `User` model for `Roles` field with space-separated names
- ✅ **After:** Searches `HierarchicalUserAssignment` model for `workflowRoles` field with underscore names

## File Modified
`SERVER/controllers/newProposalWorkflowController.js` - Lines 153-314 (getNotificationRecipients function)

## How to Verify the Fix

### Step 1: Start Fresh
```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Start server
cd D:\DREED\FMIS-BUDGET-SEPTEMBER\SERVER
npm start
```

### Step 2: Watch Server Logs
The logs should show lines like:
```
[getNotificationRecipients] Found X users with roles [...]  ← Should show X > 0
```

NOT like (which was the bug):
```
[getNotificationRecipients] Found 0 users with roles [...]  ← This was the problem
```

### Step 3: Test Workflow Actions

| Action | Steps | Expected Result |
|--------|-------|-----------------|
| **Submit to Reviewer** | 1. Log in as BUDGET_PREPARER<br>2. Create proposal<br>3. Click "Submit to Reviewer" | Server logs show "Found X reviewers"<br>BUDGET_REVIEWER gets notification |
| **Submit to Approver** | 1. Log in as BUDGET_REVIEWER<br>2. Open proposal<br>3. Click "Submit to Approver" | Server logs show "Found X approvers"<br>BUDGET_APPROVER gets notification |
| **Submit to Analyst** | 1. Log in as BUDGET_APPROVER<br>2. Open proposal<br>3. Click "Submit to Analyst" | Server logs show "Found X analysts"<br>BUDGET_PLANNING_ANALYST gets notification |
| **Return Actions** | 1. Log in as any reviewer/approver<br>2. Click "Return to [role]"<br>3. Enter comment | Server logs show "Found X [recipients]"<br>Previous role recipient gets notification |

### Step 4: Check UI
- Notifications should appear in recipient's notification area
- Should be clickable and show checkmark
- Should NOT disappear after clicking

### Step 5: Check Database (Optional)
```javascript
// MongoDB query to verify users exist with roles
db.hierarchicaluserassignments.find({ 
  workflowRoles: { $in: ['BUDGET_REVIEWER'] },
  isActive: true 
}).count()
// Should return > 0
```

## What to Look For in Logs

### ✅ GOOD - Notifications Working
```
[getNotificationRecipients] Called with action: submit-to-reviewer
[getNotificationRecipients] Query: {"workflowRoles":{"$in":["BUDGET_REVIEWER"]},"isActive":true,"regionId":"68be0fba37907a9f5551c935"}
[getNotificationRecipients] Found 2 users with roles ["BUDGET_REVIEWER"]
[getNotificationRecipients] Found 2 reviewers for submit-to-reviewer
[getNotificationRecipients] Returning 2 recipients
[createWorkflowNotification] Starting with 2 recipients
```

### ❌ BAD - Notifications NOT Working
```
[getNotificationRecipients] Found 0 users with roles ["BUDGET_REVIEWER"]
[getNotificationRecipients] Found 0 reviewers for submit-to-reviewer
[getNotificationRecipients] Returning 0 recipients
[createWorkflowNotification] No recipients to notify
```

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Model Queried** | `User` | `HierarchicalUserAssignment` |
| **Field Used** | `Roles` | `workflowRoles` |
| **Role Names** | "BUDGET REVIEWER" (spaces) | "BUDGET_REVIEWER" (underscores) |
| **User ID Field** | `_id` | `userId` |
| **Result** | 0 recipients found | X recipients found |
| **Notifications Sent** | ❌ None | ✅ All |

## Expected Behavior After Fix

1. ✅ When user performs workflow action → recipients found (> 0)
2. ✅ Notification created in database
3. ✅ Notification appears in recipient's UI with link to proposal
4. ✅ Clicking notification shows checkmark, doesn't delete
5. ✅ Deep link navigates to correct proposal tab
6. ✅ No casting errors in server logs
7. ✅ All 11 workflow actions have recipients

## Troubleshooting Quick Links

- [Full Documentation](NOTIFICATION_SYSTEM_FIX_COMPLETE.md)
- [Root Cause Analysis](NOTIFICATION_FIX_SUMMARY_NOV15.md)
- Server Log File: `SERVER/logs/` or console output

## Key Points to Remember

1. The bug wasn't a code logic error - it was using the **wrong data source**
2. `HierarchicalUserAssignment` is the **authoritative source** for workflow roles
3. Role names use **underscores** in the database (BUDGET_APPROVER)
4. Each action now filters by **region** when appropriate
5. System now queries **active users only** (isActive: true)

---

**Ready to test?** 
1. Restart server: `npm start` in SERVER folder
2. Watch for logs: `[getNotificationRecipients] Found X ...` (should be > 0)
3. Test all workflow actions
4. Verify notifications appear in UI

**Questions?** Check [Full Documentation](NOTIFICATION_SYSTEM_FIX_COMPLETE.md)
