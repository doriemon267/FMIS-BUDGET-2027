# Proposal Workflow Notification System - Implementation Summary

## November 17, 2025

### What Was Implemented

A complete notification system for the New Proposal Workflow that automatically creates and sends notifications when proposals are submitted or returned, with deep linking directly to the proposal on the workflow page.

---

## Files Modified

### 1. **SERVER/controllers/newProposalWorkflowController.js**
   
   **Changes Made:**
   - Added imports:
     ```javascript
     const Notification = require('../models/Notification');
     const notificationController = require('./notificationController');
     ```

   - Added `getNotificationRecipients()` helper function:
     - Queries database for appropriate users based on workflow action
     - Filters by role, region, and excludes the current user
     - Supports all workflow transitions (submit, return, forward, finalize)

   - Added `createWorkflowNotification()` helper function:
     - Generates notification titles and messages based on action
     - Creates deep links with format: `/new-proposal-workflow?tab=<tab>&proposalId=<id>`
     - Includes metadata with proposal details, action, comment, and performer info
     - Bulk creates notifications for all recipients

   - Modified `performAction()` function:
     - Added notification creation logic before success response
     - Checks if action is notification-worthy
     - Gets recipients and creates notifications asynchronously
     - Doesn't block action response if notification creation fails

### 2. **CLIENT/src/pages/NewProposalWorkflowPage.jsx**

   **Changes Made:**
   - Added `targetProposalId` state variable:
     ```javascript
     const [targetProposalId, setTargetProposalId] = useState(null);
     ```

   - Enhanced query parameter handling useEffect:
     - Now checks for `tab` parameter (replaces old `view` parameter)
     - Now checks for `proposalId` parameter
     - Sets state for auto-selection when proposals load

   - Added auto-selection useEffect:
     - Triggers when proposals load and `targetProposalId` is set
     - Finds proposal by ID from proposals array
     - Automatically opens Details Dialog
     - Clears `targetProposalId` after selection

---

## How It Works

### Submission Flow

```
User Performs Action (Submit/Return/Forward)
          ↓
performAction() in Backend
          ↓
canPerformAction() validates permission
          ↓
Proposal status updated & saved
          ↓
getNotificationRecipients() queries for users
          ↓
createWorkflowNotification() creates notifications
          ↓
Notifications bulk-inserted to database
          ↓
Success response sent to frontend
```

### Notification Click Flow

```
User clicks Notification in Bell Menu
          ↓
handleNotificationSelect() marks as read
          ↓
navigateToLink() sends user to deep link URL
          ↓
NewProposalWorkflowPage receives ?tab=X&proposalId=Y
          ↓
useEffect sets targetProposalId
          ↓
fetchProposals() loads proposals
          ↓
Auto-selection useEffect finds & selects proposal
          ↓
Details Dialog opens automatically
          ↓
User sees proposal information immediately
```

---

## Notification Actions

The following actions trigger notifications:

| Action | Recipients | Notification Type |
|--------|-----------|-------------------|
| `submit-to-reviewer` | Budget Reviewers | PROPOSAL_SUBMITTED |
| `submit-to-approver` | Budget Approvers | PROPOSAL_SUBMITTED |
| `forward-to-officer` | Budget Officers | PROPOSAL_SUBMITTED |
| `forward-to-manager` | Budget Managers | PROPOSAL_SUBMITTED |
| `finalize` | Proposal Creator | PROPOSAL_SUBMITTED |
| `return-to-preparer` | Proposal Creator | PROPOSAL_RETURNED |
| `return-to-reviewer` | Budget Reviewers | PROPOSAL_RETURNED |
| `return-to-approver` | Budget Approvers | PROPOSAL_RETURNED |
| `return-to-analyst` | Budget Planning Analysts | PROPOSAL_RETURNED |
| `return-to-officer` | Budget Officers | PROPOSAL_RETURNED |

---

## Query Parameter Format

Deep links follow this format:
```
/new-proposal-workflow?tab=<tab>&proposalId=<id>
```

**Parameters:**
- `tab`: Which tab to display
  - `my-proposals`: User's own proposals
  - `pending-review`: Proposals awaiting user's action
  - `all-proposals`: All proposals in the system
  - `monitoring`: Monitoring dashboard (Budget Managers only)

- `proposalId`: MongoDB ObjectId of the proposal to select and display

**Example:**
```
/new-proposal-workflow?tab=pending-review&proposalId=507f1f77bcf86cd799439011
```

---

## Recipient Selection Logic

Recipients are determined based on the action:

- **Submission actions** (`submit-to-*`, `forward-to-*`):
  - Query for users with target role in same region
  - Exclude the current user performing the action

- **Return actions** (`return-to-*`):
  - Query for users with target role in same region
  - Exclude the current user

- **Finalization**:
  - Notify the proposal creator (Budget Preparer who created it)

---

## Metadata Included

Each notification carries metadata for rich display:
```javascript
{
  action: "submit-to-reviewer",           // The workflow action
  proposalTitle: "2025 Operating Budget", // For context
  proposalId: "507f...",                  // Link identifier
  tab: "pending-review",                  // Target tab
  performedBy: "John Doe",                // Who did the action
  comment: "Please review...",            // Optional comment for returns
}
```

---

## Error Handling

- Notification creation failures are caught and logged but don't block the workflow action
- Errors include helpful context (operation, user, details)
- Server continues normal operation even if notifications can't be created

---

## Security & Performance

**Security:**
- Only appropriate recipients receive notifications
- User role validation prevents unauthorized access
- Proposal ID must exist and be accessible to user

**Performance:**
- Notifications created asynchronously (non-blocking)
- Bulk insert used for multiple recipients
- Queries optimized with field selection (`.select('_id')`)
- Indexed on Roles, Region, and _id fields

---

## Testing Checklist

- [ ] Preparer submits → Reviewer gets notification
- [ ] Reviewer receives notification with correct proposal title
- [ ] Clicking notification navigates to pending-review tab
- [ ] Proposal details open automatically
- [ ] Reviewer returns with comment → Preparer gets notification
- [ ] Return comment appears in notification
- [ ] All workflow stages create notifications correctly
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Notifications are marked as read after clicking

---

## Related Documentation

- See `NOTIFICATION_WORKFLOW_TESTING.md` for detailed testing procedures
- See `NotificationContext.jsx` for frontend notification management
- See `Notification.js` model for database schema
- See `notificationController.js` for notification utilities

---

## Future Improvements

1. Real-time updates via WebSocket/Socket.io
2. Email notification integration
3. SMS alerts for critical approvals
4. User notification preferences
5. Notification templates for customization
6. Automated reminder notifications
7. Bulk action notifications

---

## Code Examples

### Create a notification programmatically:
```javascript
const recipients = await getNotificationRecipients(
  'submit-to-reviewer',
  proposal,
  'BUDGET PREPARER',
  userId
);

await createWorkflowNotification(
  'submit-to-reviewer',
  proposal,
  recipients,
  'John Doe',
  ''
);
```

### Navigate to proposal from notification:
```javascript
// URL auto-generated in backend
const link = `/new-proposal-workflow?tab=pending-review&proposalId=${proposal._id}`;

// Frontend automatically:
// 1. Parses tab parameter
// 2. Switches to correct tab
// 3. Sets targetProposalId
// 4. Auto-selects and opens proposal
```

---

**Implementation Date:** November 17, 2025  
**Status:** ✅ Complete and Ready for Testing
