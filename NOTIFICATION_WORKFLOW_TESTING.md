# Notification Workflow Testing Guide

## Overview
This document describes the new notification system for the New Proposal Workflow. When proposals are submitted or returned, relevant users receive notifications that include deep links to the proposal on the New Proposal Workflow page.

## Features Implemented

### Backend Changes (newProposalWorkflowController.js)
1. **Helper Functions Added:**
   - `getNotificationRecipients()`: Determines which users should receive notifications based on the workflow action
   - `createWorkflowNotification()`: Creates notifications with deep links to the proposal

2. **Notifications Created For These Actions:**
   - `submit-to-reviewer`: Notifies Budget Reviewers
   - `submit-to-approver`: Notifies Budget Approvers
   - `forward-to-officer`: Notifies Budget Officers
   - `forward-to-manager`: Notifies Budget Managers
   - `finalize`: Notifies proposal creator (Preparer)
   - `return-to-preparer`: Notifies proposal creator
   - `return-to-reviewer`: Notifies Budget Reviewers
   - `return-to-approver`: Notifies Budget Approvers
   - `return-to-analyst`: Notifies Budget Planning Analysts
   - `return-to-officer`: Notifies Budget Officers

3. **Deep Link Format:**
   - Format: `/new-proposal-workflow?tab=<tab>&proposalId=<id>`
   - Example: `/new-proposal-workflow?tab=pending-review&proposalId=507f1f77bcf86cd799439011`

### Frontend Changes (NewProposalWorkflowPage.jsx)
1. **Query Parameter Handling:**
   - `tab`: Specifies which tab to open (my-proposals, pending-review, all-proposals, monitoring)
   - `proposalId`: Specifies which proposal to auto-select

2. **Auto-Selection Logic:**
   - When proposals load and `targetProposalId` is set, the page automatically opens the Details Dialog
   - The proposal is highlighted and displayed for immediate review

3. **Notification Click Integration:**
   - Clicking a notification opens the Notification menu and navigates to the workflow page
   - The page loads the correct tab and auto-opens the proposal details

## Testing Procedures

### Test Case 1: Submit Proposal for Review
**Setup:**
- Login as Budget Preparer
- Create a new proposal
- Save it as Draft

**Steps:**
1. Click "Submit for Review" button
2. Check that submission completes
3. Logout as Preparer, Login as Budget Reviewer
4. Check Notification Bell (top-right) for new notification
5. Notification should say "Proposal Submitted for Review"

**Expected Result:**
- ✅ Notification appears in the bell menu
- ✅ Notification shows proposal title and submitter name
- ✅ Clicking notification navigates to `/new-proposal-workflow?tab=pending-review&proposalId=<id>`
- ✅ Page opens with "Pending Review" tab active
- ✅ Proposal details dialog opens automatically
- ✅ Notification is marked as read

### Test Case 2: Return Proposal to Preparer
**Setup:**
- Have a proposal that's "Forwarded to Reviewer"
- Login as Budget Reviewer

**Steps:**
1. Open the proposal details
2. Click "Return to Preparer" button
3. Add a comment explaining the return reason
4. Submit the action
5. Logout as Reviewer, Login as Budget Preparer
6. Check Notification Bell

**Expected Result:**
- ✅ Notification appears with title "Proposal Returned to Preparer"
- ✅ Notification includes the return comment
- ✅ Clicking notification navigates to workflow page with tab=pending-review
- ✅ Proposal details open automatically
- ✅ Status shows "Returned to Preparer"
- ✅ Comment from reviewer is visible

### Test Case 3: Deep Link from Different Users
**Setup:**
- Ensure multiple users exist for different roles
- Have a proposal in various stages

**Steps:**
1. Navigate directly to: `/new-proposal-workflow?tab=all-proposals&proposalId=<id>`
2. Verify page opens with correct tab
3. Verify proposal is auto-selected and details dialog opens

**Expected Result:**
- ✅ Page loads with the correct tab active
- ✅ Details dialog opens automatically
- ✅ Proposal data is loaded and displayed
- ✅ User can immediately see proposal information

### Test Case 4: Forward Through Multiple Stages
**Setup:**
- Create complete workflow scenario with multiple approvals needed

**Steps:**
1. Preparer submits to Reviewer → Check Reviewer notification
2. Reviewer submits to Approver → Check Approver notification
3. Approver submits to Analyst → Check Analyst notification
4. Continue through all stages, checking notifications at each step

**Expected Result:**
- ✅ Each role receives appropriate notification
- ✅ Each notification has correct deep link
- ✅ All notifications navigate to correct tab and proposal
- ✅ No errors in browser console

### Test Case 5: Notification Metadata Validation
**Steps:**
1. Perform a submission action
2. Open browser DevTools
3. Navigate via notification link
4. Check URL in address bar
5. Check Redux/Context state for notification data

**Expected Result:**
- ✅ URL contains correct query parameters: `?tab=<tab>&proposalId=<id>`
- ✅ Tab parameter matches the proposal's expected tab
- ✅ ProposalId matches the selected proposal

## Notification Data Structure

Each notification contains:
```json
{
  "recipientUserId": "user_id",
  "type": "PROPOSAL_SUBMITTED|PROPOSAL_RETURNED",
  "title": "Proposal Submitted for Review|Proposal Returned to Preparer",
  "message": "User X has submitted|returned proposal 'Title' for your action.",
  "relatedEntityId": "proposal_id",
  "relatedEntityType": "PROPOSAL",
  "relatedLink": "/new-proposal-workflow?tab=pending-review&proposalId=proposal_id",
  "metadata": {
    "action": "submit-to-reviewer",
    "proposalTitle": "Proposal Title",
    "proposalId": "proposal_id",
    "tab": "pending-review",
    "performedBy": "John Doe",
    "comment": "Optional comment for returns"
  }
}
```

## Troubleshooting

### Issue: Notifications not appearing
**Possible Causes:**
- User might not have appropriate role for the action
- Check server logs for "getNotificationRecipients" errors
- Verify Notification model is properly imported

**Solution:**
```javascript
// Check backend logs for errors
// Verify recipients were found: look for console.log outputs
```

### Issue: Deep link not working
**Possible Causes:**
- Query parameters not being parsed correctly
- Tab value doesn't match defined tabs
- proposalId format incorrect

**Solution:**
```javascript
// Check browser DevTools
// Verify URL: /new-proposal-workflow?tab=pending-review&proposalId=<mongoId>
// Check NewProposalWorkflowPage state for targetProposalId
```

### Issue: Details dialog not opening
**Possible Causes:**
- Proposal not found in the proposals list
- targetProposalId being cleared too early
- viewDetailsDialogOpen state not being set

**Solution:**
```javascript
// Verify proposal exists in proposals array
// Check browser console for auto-selection logic
// Verify useEffect dependencies
```

## Rollback Instructions

If issues arise, revert changes with:
```bash
git revert <commit-hash>
```

Or manually remove:
1. Delete `getNotificationRecipients()` function
2. Delete `createWorkflowNotification()` function
3. Remove notification creation block in `performAction()` function
4. Remove `targetProposalId` state and useEffects from NewProposalWorkflowPage
5. Remove Notification import from newProposalWorkflowController.js

## Performance Considerations

- Notifications are created asynchronously and don't block the action response
- User queries are optimized with `.select('_id')` to minimize data transfer
- Bulk insert is used for multiple notifications (`Notification.insertMany()`)
- Queries are indexed on `Roles`, `Region`, and `_id` fields

## Future Enhancements

1. **Real-time Notifications:** Integrate Socket.io for real-time notification updates
2. **Email Notifications:** Add email alerts for critical workflow events
3. **Notification Preferences:** Allow users to customize which notifications they receive
4. **Notification History:** Implement archive/restore for notifications
5. **Batch Notifications:** Group multiple notifications into a single update

## Contact for Issues

For questions or issues with this feature, contact the development team with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/screen recordings
- Browser/server logs
