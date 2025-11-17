# Notification System Architecture Diagram

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW PROPOSAL WORKFLOW PAGE                │
│  (CLIENT/src/pages/NewProposalWorkflowPage.jsx)             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Query Parameters Handler                              │  │
│  │ - Reads: ?tab=pending-review&proposalId=507f1f77...  │  │
│  │ - Sets: targetProposalId state                        │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │ Proposals Loaded                                       │  │
│  │ - fetchProposals() called                             │  │
│  │ - Proposals array populated                           │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │ Auto-Selection Logic                                  │  │
│  │ - Find proposal by ID                                 │  │
│  │ - Set as selectedProposal                             │  │
│  │ - Open Details Dialog                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ▲                                            │
         │                                            │
         │                                    Navigates to
         │                                            │
         │                                            ▼
┌─────────────────────────────────────────────────────────────┐
│           NOTIFICATION DISPLAY COMPONENT                    │
│  (global/components/DashboardHeader.jsx)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Notification Bell Icon                                │  │
│  │ ├─ Shows unread count badge                          │  │
│  │ └─ Opens menu on click                               │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ Notification Menu List                                │  │
│  │ ├─ Title: "Proposal Submitted for Review"            │  │
│  │ ├─ Message: Full context                             │  │
│  │ ├─ From: Performer name                              │  │
│  │ ├─ Time: Relative timestamp                          │  │
│  │ ├─ Comment: (if return action)                       │  │
│  │ └─ Action chips (colors & labels)                    │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ Notification Click Handler                            │  │
│  │ - Mark as read via API                               │  │
│  │ - Extract relatedLink                                │  │
│  │ - Navigate user                                       │  │
│  └──────────────┬───────────────────────────────────────┘  │
└─────────────────┼─────────────────────────────────────────┘
                  │
                  │ navigateToLink()
                  │
                  ▼
```

---

## Backend Notification Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ACTION TRIGGERED                     │
│     POST /proposals/:id/action                              │
│  Body: { action: 'submit-to-reviewer', comment: '' }       │
└──────────────────────────┬────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         PERFORM ACTION FUNCTION (Backend)                   │
│  SERVER/controllers/newProposalWorkflowController.js        │
│                                                              │
│  1. Validate user permission                               │
│  2. Check proposal exists                                  │
│  3. Verify action allowed for current status               │
└──────────────────────────┬────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
  ┌──────────────────┐          ┌──────────────────┐
  │ Permission Check │          │ Status Check     │
  │ FAILED           │          │ PASSED           │
  └──────────────────┘          └─────────┬────────┘
           │                               │
        Return 403                         ▼
                           ┌──────────────────────────┐
                           │ Update Proposal Status   │
                           │ - Set new status         │
                           │ - Log in history         │
                           │ - Save to DB             │
                           └──────────┬───────────────┘
                                      │
                                      ▼
                           ┌──────────────────────────┐
                           │ Check if Notification    │
                           │ Action (is it one of 10?)│
                           └──────────┬───────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
           ┌──────────────────┐              ┌──────────────────┐
           │ YES - is in list │              │ NO - skip        │
           │ of 10 actions    │              │ notifications    │
           └─────────┬────────┘              └──────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────┐
    │ getNotificationRecipients()         │
    │ Async function                      │
    │                                    │
    │ Find users by:                     │
    │ ├─ Required role (e.g., REVIEWER)  │
    │ ├─ Same region as proposal         │
    │ └─ NOT the current user            │
    │                                    │
    │ Variants for each action:          │
    │ ├─ submit-to-reviewer → Reviewers  │
    │ ├─ submit-to-approver → Approvers  │
    │ ├─ forward-to-officer → Officers   │
    │ ├─ ... etc for all 10 actions      │
    │                                    │
    │ Returns: Array of user IDs         │
    └────────────┬───────────────────────┘
                 │
                 ▼ (if recipients found)
    ┌────────────────────────────────────┐
    │ createWorkflowNotification()        │
    │ Async function                      │
    │                                    │
    │ Build notification data:            │
    │ ├─ title: "Proposal Submitted..."  │
    │ ├─ message: "User X submitted..."  │
    │ ├─ type: PROPOSAL_SUBMITTED        │
    │ ├─ relatedLink: /workflow?...      │
    │ └─ metadata: {action, comment...}  │
    │                                    │
    │ For each recipient:                │
    │ ├─ recipientUserId: user ID        │
    │ ├─ relatedEntityId: proposal ID    │
    │ └─ ... (all other fields)          │
    │                                    │
    │ Bulk insert all notifications      │
    │ await Notification.insertMany()    │
    └────────────┬───────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────┐
    │ Send Success Response               │
    │ { success: true, data: proposal }  │
    └────────────┬───────────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Frontend     │
         │ receives OK  │
         └──────────────┘
```

---

## Notification Data Journey

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CREATION (In Memory)                                     │
│                                                              │
│  const notificationData = {                                │
│    recipientUserId: "user_123",                            │
│    type: "PROPOSAL_SUBMITTED",                             │
│    title: "Proposal Submitted for Review",                 │
│    message: "John Doe has submitted proposal...",          │
│    relatedEntityId: "proposal_507f1f77...",                │
│    relatedEntityType: "PROPOSAL",                          │
│    relatedLink: "/new-proposal-workflow?...",              │
│    metadata: {                                              │
│      action: "submit-to-reviewer",                         │
│      proposalTitle: "Q4 2025 Budget",                      │
│      tab: "pending-review",                                │
│      performedBy: "John Doe"                               │
│    }                                                        │
│  }                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. STORAGE (In Database)                                    │
│                                                              │
│  db.notifications.insertMany([                             │
│    { /* notification 1 */ },                               │
│    { /* notification 2 */ },                               │
│    { /* ... for each recipient */ }                        │
│  ])                                                         │
│                                                              │
│  Each doc gets:                                             │
│  ├─ _id: ObjectId (auto-generated)                         │
│  ├─ createdAt: current timestamp                           │
│  └─ status: "UNREAD"                                       │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. RETRIEVAL (Frontend Query)                               │
│                                                              │
│  GET /api/notifications                                   │
│                                                              │
│  NotificationContext:                                       │
│  ├─ Fetches with useQuery hook                            │
│  ├─ Processes response data                                │
│  ├─ Maps fields (id, title, message, etc.)                │
│  ├─ Calculates unreadCount                                │
│  └─ Provides via context to all components                │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DISPLAY (Notification Menu)                              │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Unread Notification Badge: 1 unread                  │ │
│  └───────────────┬───────────────────────────────────────┘ │
│                  │                                          │
│                  ▼                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ■ PROPOSAL SUBMITTED FOR REVIEW                      │ │
│  │   John Doe has submitted proposal 'Q4 2025 Budget'   │ │
│  │                                                       │ │
│  │   From: John Doe                                     │ │
│  │   5 minutes ago                                      │ │
│  │                                                       │ │
│  │   [Submit] [Pending Review]                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                  │                                          │
│            ┌─────┘ (click)                                 │
│            │                                                │
│            ▼                                                │
│  Navigate to deep link                                     │
│  /new-proposal-workflow?tab=pending-review&...            │
│                                                              │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. UPDATE (Mark as Read)                                    │
│                                                              │
│  POST /api/notifications/mark-read                        │
│  Body: { ids: ["notification_507f1f77..."] }             │
│                                                              │
│  Updates database:                                          │
│  db.notifications.updateMany(                             │
│    { _id: { $in: [...] } },                              │
│    { status: "READ", readAt: Date.now() }                │
│  )                                                          │
│                                                              │
│  Frontend:                                                  │
│  ├─ Invalidates notification query cache                  │
│  ├─ Re-fetches notifications                              │
│  ├─ Badge count updates                                   │
│  └─ Unread indicator removed                              │
└────────────────────────────────────────────────────────────┘
```

---

## Query Parameter Processing

```
URL Arrives at Browser:
/new-proposal-workflow?tab=pending-review&proposalId=507f1f77bcf86cd799439011
         │
         ▼
React Router useSearchParams Hook:
- searchParams object created
- Contains URLSearchParams API
         │
         ▼
useEffect Hook Triggered:
┌──────────────────────────────────┐
│ Get tab parameter                │
│ tabParam = "pending-review"      │
│                                  │
│ Find matching tab in tabs array: │
│ ├─ my-proposals (index 0)       │
│ ├─ pending-review (index 1)  ✓  │
│ ├─ all-proposals (index 2)      │
│ └─ monitoring (index 3)          │
│                                  │
│ setActiveTab(1)                  │
│ → Page switches to that tab      │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Get proposalId parameter         │
│ proposalIdParam = "507f1f77..."  │
│                                  │
│ setTargetProposalId(proposalId)  │
│ → Store for later use            │
└──────────────────────────────────┘
         │
         ▼
Proposals Load via API:
- API call with active tab filter
- Response: [ { _id: "507f1f77...", title: "..." }, ... ]
- setProposals([...])
         │
         ▼
Auto-Selection useEffect Triggers:
┌──────────────────────────────────┐
│ targetProposalId = "507f1f77..." │
│ proposals.length > 0             │
│                                  │
│ Find in proposals array:          │
│ proposals.find(p =>              │
│   p._id === "507f1f77..."        │
│ )                                │
│ → Found!                         │
│                                  │
│ setSelectedProposal(proposal)    │
│ setViewDetailsDialogOpen(true)   │
│ setTargetProposalId(null)        │
│                                  │
│ → Dialog opens automatically     │
└──────────────────────────────────┘
         │
         ▼
User Sees:
┌──────────────────────────────────┐
│ Pending Review tab is active     │
│ Details dialog is open           │
│ Proposal data is displayed       │
│ Ready for action                 │
└──────────────────────────────────┘
```

---

## State Flow Diagram

```
Initial State:
┌─────────────────────────┐
│ activeTab: 0 (or 1)     │
│ proposals: []           │
│ selectedProposal: null  │
│ targetProposalId: null  │
│ viewDetailsDialogOpen:  │
│   false                 │
└────────────┬────────────┘
             │
    URL Query Params Arrive
    (?tab=pending-review&proposalId=...)
             │
             ▼
┌─────────────────────────┐
│ activeTab: 1            │
│ proposals: []           │
│ selectedProposal: null  │
│ targetProposalId:       │
│   "507f1f77bcf86..."    │ ◄─ SET BY FIRST EFFECT
│ viewDetailsDialogOpen:  │
│   false                 │
└────────────┬────────────┘
             │
    fetchProposals() completes
             │
             ▼
┌─────────────────────────┐
│ activeTab: 1            │
│ proposals: [            │
│   {_id: "507f1f77...",  │
│    title: "Q4 Budget"}, │
│   { ... }               │
│ ]                       │
│ selectedProposal: null  │
│ targetProposalId:       │
│   "507f1f77bcf86..."    │
│ viewDetailsDialogOpen:  │
│   false                 │
└────────────┬────────────┘
             │
    Auto-selection effect triggers
             │
             ▼
┌─────────────────────────┐
│ activeTab: 1            │
│ proposals: [...]        │
│ selectedProposal: {     │ ◄─ SET BY SECOND EFFECT
│   _id: "507f1f77...",   │
│   title: "Q4 Budget",   │
│   ... full details      │
│ }                       │
│ targetProposalId: null  │ ◄─ CLEARED
│ viewDetailsDialogOpen:  │
│   true                  │ ◄─ DIALOG OPENS
└─────────────────────────┘
             │
             ▼
    User sees proposal details
    in dialog, ready to review
```

---

## Database Schema Usage

```
Notification Document:
{
  _id: ObjectId,
  recipientUserId: "user_123",                    ← Indexed
  type: "PROPOSAL_SUBMITTED",
  title: "Proposal Submitted for Review",
  message: "John Doe has submitted proposal...",
  entity: "proposal",
  recordIds: [ObjectId("507f1f77...")],
  org: {
    region: "NCR",
    department: "Finance",
    division: "Budget"
  },
  status: "UNREAD",                               ← Indexed
  createdBy: { userId: "user_456", name: "..." },
  createdAt: ISODate("2025-11-17T10:30:00Z"),
  readAt: null,
  relatedLink: "/new-proposal-workflow?tab=pending-review&proposalId=507f1f77...",
  metadata: {
    action: "submit-to-reviewer",
    proposalTitle: "Q4 2025 Operating Budget",
    proposalId: "507f1f77bcf86cd799439011",
    tab: "pending-review",
    performedBy: "John Doe",
    comment: "Please review the updated amounts"
  }
}

Queries Used:
1. Create:
   db.notifications.insertMany([{...}, {...}])
   
2. Read (by user):
   db.notifications.find({
     recipientUserId: "user_123"
   }).sort({ createdAt: -1 })
   
3. Update (mark read):
   db.notifications.updateMany({
     _id: { $in: [...] }
   }, {
     status: "READ",
     readAt: Date.now()
   })
```

---

## Error Handling Flow

```
Action Initiated
         │
         ▼
Validation Check
    ├─ FAIL → Return 403/400
    │
    └─ PASS
         │
         ▼
Update Proposal
    ├─ FAIL → Return 500
    │
    └─ PASS
         │
         ▼
Try Notification Creation
    ├─ Get Recipients
    │  ├─ FAIL → Log error, continue
    │  └─ PASS → Create notifications
    │
    ├─ Create Notifications
    │  ├─ FAIL → Log error, continue
    │  └─ PASS → Notifications sent
    │
    └─ Error caught in catch block
       └─ Log error, don't affect action
         │
         ▼
Return 200 Success
(Proposal updated regardless
 of notification status)
```

---

## Performance Timeline

```
User clicks "Submit"
│
├─ Request sent (1ms)
│
├─ performAction() executes (5-10ms)
│  ├─ Validation (1ms)
│  ├─ Status update (2ms)
│  ├─ Save to DB (3ms)
│  └─ Start notification (async, non-blocking)
│
├─ Response sent (50ms total)
│ ✓ User gets immediate feedback
│
├─ Meanwhile: Notification creation (100-200ms)
│  ├─ Query for recipients (30-50ms)
│  ├─ Build notifications (10ms)
│  └─ Bulk insert to DB (30-50ms)
│  ✓ Doesn't block user experience
│
└─ Notification appears when user refreshes (1-2s)
   or fetches via NotificationContext
```

---

This architecture ensures:
- ✅ Fast action responses
- ✅ Non-blocking notifications
- ✅ Proper error handling
- ✅ Scalable design
- ✅ User-friendly experience
