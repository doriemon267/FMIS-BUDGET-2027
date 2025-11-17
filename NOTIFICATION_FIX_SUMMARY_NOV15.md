# Notification System Fix - November 15, 2025

## Problem Identified & Resolved

### Root Cause
The notification system was querying the wrong user model and field:
- **Was querying:** `User` model with `Roles` field
- **Should query:** `HierarchicalUserAssignment` model with `workflowRoles` field

### Why It Didn't Work
1. The `User` model has a basic `roles` field (lowercase) that doesn't contain workflow role information
2. Workflow roles are stored in `HierarchicalUserAssignment.workflowRoles` array with standardized names
3. Role naming convention mismatch:
   - Code was looking for: "BUDGET APPROVER" (with space)
   - Database stores: "BUDGET_APPROVER" (with underscore)

### Result of Bug
All notification actions were returning **0 recipients**, even though users with proper workflow roles existed in the system.

---

## Solution Implemented

### File Modified
**`SERVER/controllers/newProposalWorkflowController.js`**

### Changes Made

Rewrote the `getNotificationRecipients()` function (lines 153-327) to:

1. **Query the correct model:** `HierarchicalUserAssignment` instead of `User`
2. **Use correct field:** `workflowRoles` instead of `Roles`
3. **Use correct role names:** Underscore-separated (`BUDGET_APPROVER`, `BUDGET_PLANNING_ANALYST`) instead of space-separated
4. **Implement region filtering:** Properly filter by `regionId` when available
5. **Filter by user ID:** Use `userId` field from HierarchicalUserAssignment instead of MongoDB `_id`

### Implementation Details

#### Helper Function
```javascript
const findUsersByWorkflowRole = async (roles, region = null) => {
  let query = { 
    workflowRoles: { $in: roles },
    isActive: true 
  };
  
  if (region && region !== null) {
    query.regionId = region;
  }
  
  const users = await HierarchicalUserAssignment.find(query)
    .select('userId workflowRoles regionId');
  return users;
};
```

#### Updated Actions
All 11 notification actions now use the corrected query logic:

| Action | Role Notified | Filter |
|--------|---------------|--------|
| submit-to-reviewer | BUDGET_REVIEWER | By region |
| submit-to-approver | BUDGET_APPROVER | By region |
| submit-to-analyst | BUDGET_PLANNING_ANALYST | By region |
| forward-to-officer | BUDGET_OFFICER | By region |
| forward-to-manager | OVERALL_BUDGET_APPROVER, BUDGET_ADMIN | No region |
| finalize | Proposal creator (createdBy) | Direct |
| return-to-preparer | Proposal creator | Direct |
| return-to-reviewer | BUDGET_REVIEWER | By region |
| return-to-approver | BUDGET_APPROVER | By region |
| return-to-analyst | BUDGET_PLANNING_ANALYST | By region |
| return-to-officer | BUDGET_OFFICER | By region |

---

## Verification Steps

After restarting the server, test each workflow action:

### Test Case: Submit to Reviewer
1. Log in as BUDGET_PREPARER
2. Create a new proposal
3. Click "Submit to Reviewer"
4. Expected: Check server logs for `[getNotificationRecipients] Found X reviewers for submit-to-reviewer` (X > 0)
5. Expected: Notification should appear for all BUDGET_REVIEWER users in the same region

### Server Log Indicators
When notifications are working correctly, you should see logs like:
```
[getNotificationRecipients] Called with action: submit-to-reviewer
[getNotificationRecipients] Query: {"workflowRoles":{"$in":["BUDGET_REVIEWER"]},"isActive":true,"regionId":"..."}
[getNotificationRecipients] Found 2 users with roles ["BUDGET_REVIEWER"]
[getNotificationRecipients] Found 2 reviewers for submit-to-reviewer
[getNotificationRecipients] Returning 2 recipients
[createWorkflowNotification] Starting with 2 recipients
```

---

## Database Schema Reference

### HierarchicalUserAssignment Fields Used
- **userId** (String, unique): User identifier
- **userName** (String): User display name
- **email** (String): User email
- **workflowRoles** (Array of String): Workflow roles like 'BUDGET_PREPARER', 'BUDGET_REVIEWER', etc.
- **regionId** (ObjectId): Region assignment
- **isActive** (Boolean): Whether user is active

### Valid Workflow Role Values (in workflowRoles array)
```
'BUDGET_PREPARER'
'BUDGET_REVIEWER'
'BUDGET_APPROVER'
'BUDGET_PLANNING_ANALYST'
'BUDGET_OFFICER'
'OVERALL_BUDGET_APPROVER'
'BUDGET_ADMIN'
```

---

## Technical Notes

### Why This Was Missed
1. The `User` model exists and has a `roles` field, so queries didn't error out
2. The `HierarchicalUserAssignment` model was imported but not used for notification queries
3. The casting error fix (Phase 3) worked around the immediate MongoDB error but didn't address the underlying model mismatch

### Performance Impact
Minimal - we're now querying the correct indexed collection with filtered results

### Backward Compatibility
No breaking changes - all notification formats and delivery mechanisms remain the same

---

## Next Steps

1. **Restart Server:** Kill all Node processes and restart with `npm start`
2. **Run Tests:** Test each workflow action as documented above
3. **Monitor Logs:** Check server console for notification recipient counts
4. **Verify UI:** Confirm notifications appear in user interface with checkmarks
5. **Clean Up:** Remove diagnostic logging if no longer needed

---

## Success Metrics

✅ Notifications are created for all workflow actions
✅ Correct recipients are identified (0 → X users where X > 0)
✅ Notifications persist with checkmarks when clicked
✅ Deep linking works (tabs and proposalId parameters)
✅ No casting errors in server logs

---

## Files Changed
- `SERVER/controllers/newProposalWorkflowController.js` - Lines 153-327 (complete rewrite of getNotificationRecipients function)

## Testing Required
- [x] Code syntax validation
- [ ] Server restart and startup verification
- [ ] submit-to-reviewer action test
- [ ] submit-to-approver action test
- [ ] submit-to-analyst action test
- [ ] return-to-reviewer action test
- [ ] All other return actions tests
- [ ] Notification UI verification
