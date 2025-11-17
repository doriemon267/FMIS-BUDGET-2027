# Notification UI Visual Guide - Implementation Details

**Date:** November 17, 2025

---

## Notification Appearance Reference

Based on the provided image showing Disbursement Voucher Notifications, here's what our Budget Proposal Notifications will look like:

### Image Reference (Your Example)
```
┌─────────────────────────────────────────────────────┐
│ 📋 Disbursement Voucher Notifications               │
├─────────────────────────────────────────────────────┤
│                                                       │
│ [🔔] ✓ Your Liquidation - Traveling and Training   │
│      Allowances - Local disbursement voucher has    │
│      been returned to draft.                         │
│      20 days ago                                     │
│                                                       │
│ ─────────────────────────────────────────────────── │
│                                                       │
│ [✓] ✓ Your Cash Advance - Traveling and Training   │
│      Allowances - Local disbursement voucher has    │
│      been returned to draft.                         │
│      25 days ago                                     │
│                                                       │
│ ─────────────────────────────────────────────────── │
│                                                       │
│ [✓] ✓ Your Cash Advance - Traveling and Training   │
│      Allowances - Local disbursement voucher has    │
│      been returned to draft.                         │
│      25 days ago                                     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Our Implementation - Notification Bell Menu

### Unread Notifications (Before Click)

```
┌────────────────────────────────────────────────────────┐
│ 🔔 [3] Notifications                  ✕              │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ⭕ Proposal Submitted to Budget Planning Analyst      │
│    Approver has submitted proposal "Q3 Budget"        │
│    for your action.                                    │
│    2 minutes ago                                        │
│                                                          │
│ ─────────────────────────────────────────────────────  │
│                                                          │
│ ⭕ Proposal Returned to Approver                       │
│    Reviewer has returned proposal "Q2 Revision"       │
│    with comment: "Needs more detail"                  │
│    15 minutes ago                                       │
│                                                          │
│ ─────────────────────────────────────────────────────  │
│                                                          │
│ ⭕ Proposal Submitted for Review                       │
│    Preparer has submitted proposal "Q1 Final"         │
│    for your action.                                    │
│    1 hour ago                                           │
│                                                          │
└────────────────────────────────────────────────────────┘
```

### After Clicking First Notification

```
┌────────────────────────────────────────────────────────┐
│ 🔔 [2] Notifications                  ✕              │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ✅ Proposal Submitted to Budget Planning Analyst      │  ← CHECKMARK
│    Approver has submitted proposal "Q3 Budget"        │  ← PERSISTS
│    for your action.                                    │  ← NOT DELETED
│    2 minutes ago                                        │
│                                                          │
│ ─────────────────────────────────────────────────────  │
│                                                          │
│ ⭕ Proposal Returned to Approver                       │
│    Reviewer has returned proposal "Q2 Revision"       │
│    with comment: "Needs more detail"                  │
│    15 minutes ago                                       │
│                                                          │
│ ─────────────────────────────────────────────────────  │
│                                                          │
│ ⭕ Proposal Submitted for Review                       │
│    Preparer has submitted proposal "Q1 Final"         │
│    for your action.                                    │
│    1 hour ago                                           │
│                                                          │
└────────────────────────────────────────────────────────┘
```

---

## Data Flow and Navigation

### Step 1: Notification Created
```
Database Entry:
{
  _id: ObjectId("..."),
  recipientUserId: "analyst_user_id",
  type: "PROPOSAL_SUBMITTED",
  title: "Proposal Submitted to Budget Planning Analyst",
  message: "Approver has submitted proposal 'Q3 Budget' for your action.",
  status: "UNREAD",                  ← Key: Unread state
  relatedLink: "/new-proposal-workflow?tab=all-proposals&proposalId=...",
  relatedEntityType: "PROPOSAL",
  metadata: {
    tab: "all-proposals",            ← Navigation target
    proposalTitle: "Q3 Budget",
    performedBy: "Budget Approver"
  },
  createdAt: 2025-11-17T10:30:00Z
}
```

### Step 2: Notification Displayed (UNREAD)
```
Frontend Display:
{
  id: "...",
  title: "Proposal Submitted to Budget Planning Analyst",
  message: "Approver has submitted proposal 'Q3 Budget' for your action.",
  isRead: false,                     ← No checkmark
  status: "UNREAD",
  relatedLink: "/new-proposal-workflow?tab=all-proposals&proposalId=...",
  createdAt: Date
}

Visual State:
⭕ [Unread indicator] Title
   Message
   Time ago
```

### Step 3: User Clicks Notification
```
Action Flow:
1. markNotificationAsRead(notificationId)
   ↓
2. API Call: POST /notifications/mark-read
   ├─ Payload: { ids: [notificationId] }
   ↓
3. Backend Update:
   ├─ status: "UNREAD" → "READ"
   ├─ readAt: new Date()
   ├─ Document remains (NOT deleted)
   ↓
4. Frontend Updates:
   ├─ isRead: false → true
   ├─ status: "UNREAD" → "READ"
   ├─ Shows checkmark
   ├─ Notification persists
   ↓
5. Navigate:
   └─ window.location = relatedLink
      "/new-proposal-workflow?tab=all-proposals&proposalId=..."
```

### Step 4: Notification Updated (READ with Checkmark)
```
Database Update:
{
  _id: ObjectId("..."),
  recipientUserId: "analyst_user_id",
  status: "READ",                    ← Changed
  readAt: 2025-11-17T10:32:00Z,     ← Timestamp added
  // All other fields remain the same
}

Frontend Display (After Refresh):
{
  isRead: true,                      ← Flag updated
  status: "READ",
  // Shows checkmark
}

Visual State:
✅ [Read indicator] Title
   Message
   Time ago
   (Notification is lighter/dimmed but VISIBLE)
```

### Step 5: Page Navigation
```
URL Changes:
From: /notifications (bell menu)
To:   /new-proposal-workflow?tab=all-proposals&proposalId=<proposal_id>

NewProposalWorkflowPage Component:
1. Parse URL parameters:
   ├─ tab=all-proposals
   └─ proposalId=<id>
   ↓
2. Update state:
   ├─ setActiveTab(2)  // All Proposals is index 2
   └─ setTargetProposalId(<id>)
   ↓
3. Load proposals for All Proposals tab
   ↓
4. When proposals load:
   ├─ Find proposal matching proposalId
   ├─ Auto-select it
   ├─ Open details dialog
   ↓
5. User sees full proposal details and can:
   ├─ Review content
   ├─ Perform actions
   ├─ Add comments
   └─ Submit
```

---

## Notification Status Lifecycle

```
Timeline of a Notification:
═════════════════════════════════════════════════════════

T=0 PROPOSAL SUBMITTED
├─ Status: UNREAD (from DB perspective)
├─ Visual: ⭕ (unread dot)
├─ Location: Bell menu → appears
├─ Indicator: Unread count: +1
└─ Appearance: Highlighted/Bold

        ↓ (User clicks)

T=5min NOTIFICATION CLICKED
├─ Status: READ (from DB perspective)
├─ Visual: ✅ (checkmark appears)
├─ Location: Bell menu → still there!
├─ Indicator: Unread count: -1
├─ Appearance: Faded/Dimmed (but visible)
├─ Behavior: Navigate to proposal
└─ Action: Call markNotificationAsRead()

        ↓ (User closes proposal dialog)

T=10min RETURN TO APP
├─ Status: READ (persisted in DB)
├─ Visual: ✅ (checkmark remains)
├─ Location: Bell menu → still there!
├─ Behavior: Can click again if needed
└─ Appearance: Still visible in history

        ↓ (Next day)

T=24hrs LATER
├─ Status: READ (unchanged)
├─ Visual: ✅ (still visible)
├─ Location: Notification center → History
├─ Behavior: Full access to notification
└─ Audit: Timestamp shows "readAt" and "createdAt"
```

---

## Key Differences from Standard Delete Pattern

### ❌ Old/Wrong Pattern (DELETE on Click)
```javascript
// User clicks notification
// → Notification is DELETED from database
// → Disappears from UI
// → Lost forever
// → No history/audit trail
❌ Bad UX - User can't reference notification again
```

### ✅ Our Pattern (MARK READ - PERSISTENT)
```javascript
// User clicks notification
// → Notification status changes to "READ"
// → Shows checkmark ✅
// → Remains visible in history
// → Fully auditable with timestamps
✅ Good UX - Matches email/disbursement pattern
✅ Good for compliance - Full audit trail
✅ Good for UX - Users can review past notifications
```

---

## Implementation Details: Why Persistent Matters

### Use Case 1: Reference Check
```
Monday:  User receives notification about "Q3 Budget"
Tuesday: User needs to remember who submitted it
         Clicks notification → Can read original message
         Knows: Budget Approver submitted on Monday 10:30am
✓ Possible because notification is persistent
```

### Use Case 2: Audit Compliance
```
Auditor asks: "Who notified you about budget changes?"
Admin can show:
  - Notification created: 2025-11-17 10:30:00
  - Marked read: 2025-11-17 10:32:00
  - By user: analyst_user_id
  - For proposal: Q3 Budget (ID: ...)
✓ Full audit trail available
```

### Use Case 3: Duplicate Prevention
```
User sees notification, navigates away, comes back
Same notification still shows in bell menu
Can click again if needed (e.g., forgot the proposal link)
No need for re-notification
✓ Better than forcing duplicate notifications
```

---

## Technical Implementation Summary

### Backend (Already Implemented)
```javascript
// newProposalWorkflowController.js - createWorkflowNotification()
const notificationData = recipientUserIds.map(userId => ({
  recipientUserId: userId,
  status: 'UNREAD',                    // ← Key: Not deleted
  relatedLink: `/new-proposal-workflow?tab=all-proposals&proposalId=...`,
  // ... other fields
}));

Notification.insertMany(notificationData);  // ← Persists to DB
```

### Backend Mark Read (Already Implemented)
```javascript
// notificationController.js - markAsRead()
exports.markAsRead = async (notificationId) => {
  const notification = await Notification.findByIdAndUpdate(
    notificationId,
    { 
      status: 'READ',                  // ← Changes status
      readAt: new Date()               // ← Adds timestamp
      // ← Does NOT delete
    },
    { new: true }
  );
  return notification;
};
```

### Frontend Handling (Already Implemented)
```javascript
// NotificationContext.jsx
const { mutateAsync: markNotificationAsReadAsync } = useMutation({
  mutationFn: async (id) => {
    await api.post("/notifications/mark-read", { ids: [id] });
    return id;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    // ← Refreshes query, notification persists
  },
});
```

### Display Logic (Already Implemented)
```javascript
// NotificationContext.jsx
const notifications = rawList.map((item) => ({
  isRead: String(item.status || "").toUpperCase() === "READ",
  status: String(item.status || "UNREAD").toUpperCase(),
  relatedLink: item.relatedLink || null,
  // ← Checkmark shown when isRead === true
  // ← Item never filtered out
}));
```

---

## Summary

✅ **Persistent Notifications Implementation:**
- Notifications do NOT delete when clicked
- Status changes from UNREAD → READ
- Checkmark displays in UI
- Full audit trail with timestamps
- Matches enterprise notification patterns
- Complies with disbursement UI style (from provided image)

✅ **Navigation Working:**
- Always points to `/new-proposal-workflow?tab=all-proposals&proposalId=<id>`
- Ensures consistent user experience
- Auto-opens proposal in correct tab

✅ **Database Design:**
- Supports notification history
- Enables audit compliance
- Tracks readAt timestamp
- Maintains all context in metadata

