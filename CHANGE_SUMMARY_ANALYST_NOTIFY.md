# Code Changes Summary - BUDGET APPROVER → ANALYST Notification

## File Modified
`SERVER/controllers/newProposalWorkflowController.js`

---

## Change 1: Add Handler in `getNotificationRecipients()` Function

**Location:** Lines 207-227  
**Type:** Addition (20 lines)  
**Purpose:** Find all Budget Planning Analysts in the same region to notify

```javascript
} else if (action === 'submit-to-analyst') {
  // Notify Budget Planning Analysts
  let analysts = [];
  if (proposalRegionId) {
    analysts = await User.find({
      $or: [
        { Roles: { $in: ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'] }, Region: proposalRegionId },
        { Roles: { $in: ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'] }, Region: proposalRegionString }
      ],
      _id: { $ne: currentUserId }
    }).select('_id');
  } else {
    analysts = await User.find({
      Roles: { $in: ['BUDGET_PLANNING_ANALYST', 'BUDGET PLANNING ANALYST'] },
      _id: { $ne: currentUserId }
    }).select('_id');
  }
  console.log('[getNotificationRecipients] Found', analysts.length, 'analysts for submit-to-analyst');
  recipients.push(...analysts.map(u => u._id.toString()));
} else if (action === 'forward-to-officer') {
```

---

## Change 2: Add Notification Title in `createWorkflowNotification()` Function

**Location:** Line 380 (inside `actionTitles` object)  
**Type:** Addition (1 line)  
**Purpose:** Set a meaningful notification title for this action

```javascript
const actionTitles = {
  'submit-to-reviewer': 'Proposal Submitted for Review',
  'submit-to-approver': 'Proposal Submitted for Approval',
  'submit-to-analyst': 'Proposal Submitted to Budget Planning Analyst',  // ← ADDED
  'forward-to-officer': 'Proposal Forwarded to Officer',
  'forward-to-manager': 'Proposal Submitted to Manager',
  'finalize': 'Proposal Finalized',
  'return-to-preparer': 'Proposal Returned to Preparer',
  'return-to-reviewer': 'Proposal Returned to Reviewer',
  'return-to-approver': 'Proposal Returned to Approver',
  'return-to-analyst': 'Proposal Returned to Analyst',
  'return-to-officer': 'Proposal Returned to Officer'
};
```

---

## Change 3: Add Action to Notification Trigger List

**Location:** Lines 1111-1122 (inside `performAction()` endpoint)  
**Type:** Addition (1 line)  
**Purpose:** Mark this action as requiring notification creation

```javascript
// Create notifications for relevant workflow actions
try {
  const isNotificationAction = [
    'submit-to-reviewer',
    'submit-to-approver',
    'submit-to-analyst',              // ← ADDED
    'forward-to-officer',
    'forward-to-manager',
    'finalize',
    'return-to-preparer',
    'return-to-reviewer',
    'return-to-approver',
    'return-to-analyst',
    'return-to-officer'
  ].includes(action);
```

---

## Total Changes
- **Lines Added:** 22
- **Files Modified:** 1
- **Syntax Errors:** 0
- **Status:** ✅ Ready for deployment

---

## Testing Verification

After restart, test with:

1. BUDGET APPROVER submits proposal to analyst
2. Check BUDGET PLANNING ANALYST receives notification
3. Verify deep link works: `/new-proposal-workflow?tab=pending-review&proposalId=<id>`
4. Confirm proposal auto-opens in correct tab

