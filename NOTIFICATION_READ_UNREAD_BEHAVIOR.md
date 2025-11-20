# Notification Read/Unread Behavior - November 20, 2025

## What Happens When You Open/Click a Notification?

### ✅ Notification Remains in List
When you click on a notification to open it:
1. The notification **stays in the list** (not deleted)
2. The notification is marked as **READ** in the database
3. The **badge count decreases** (since unread count goes down)
4. The notification list is **refreshed** to show the new state

### 📊 Visual Indicators

#### UNREAD Notifications (Default State)
- **Background**: Light blue (`rgba(25,118,210,0.12)`)
- **Left Border**: Blue vertical bar (4px wide)
- **Text**: Bold font weight (700)
- **Badge**: None (counted in notification badge)
- **On Hover**: Slightly darker blue background with box shadow

#### READ Notifications (After Opening)
- **Background**: Transparent (no color)
- **Left Border**: None (transparent)
- **Text**: Normal font weight (500)
- **Badge**: Gray "Read" label appears
- **On Hover**: Light gray background

### Example Timeline

```
User opens notification list:
├─ 3 unread notifications show (badge shows "3")
│  ├─ Notification 1 [bold, blue background, blue border]
│  ├─ Notification 2 [bold, blue background, blue border]
│  └─ Notification 3 [bold, blue background, blue border]
│
User clicks Notification 1:
├─ Notification 1 is marked as READ
├─ Badge now shows "2" (3-1)
├─ List refreshes
└─ Notification 1 now shows [normal text, no color, "Read" badge]

Result in list:
├─ Notification 1 [normal text, transparent bg, "Read" badge] ← Clicked
├─ Notification 2 [bold, blue background, blue border] ← Unread
└─ Notification 3 [bold, blue background, blue border] ← Unread
```

## Features

✅ **Persistent List** - Notifications stay visible even after reading
✅ **Clear Distinction** - Easy to see which are read vs unread
✅ **Accurate Count** - Badge updates in real-time
✅ **Quick Review** - Can review past notifications without losing them
✅ **Navigation** - Clicking any notification takes you to the relevant page

## Implementation Details

### Files Modified
- `CLIENT/src/global/components/DashboardHeader.jsx`
  - Added "Read" badge for read notifications
  - Updated styling to distinguish read/unread states
  - Maintains full notification history in list

### Notification Lifecycle
1. **Created** → Appears unread in list, badge increments
2. **Clicked** → Marked as read, badge decrements, "Read" label shown
3. **Persists** → Remains in list for history/reference
4. **Navigation** → User taken to relevant proposal or page

## Visual Summary

| State | Background | Border | Text | Badge | Count |
|-------|-----------|--------|------|-------|-------|
| **Unread** | Blue tint | Blue bar | Bold | - | Included |
| **Read** | Transparent | None | Normal | "Read" | Excluded |

## Testing

To verify behavior:
1. Open a proposal and submit/return it
2. Check notification badge shows count
3. Click the notification
4. Observe:
   - ✓ Notification changes appearance (bold → normal, blue → gray)
   - ✓ "Read" badge appears on clicked notification
   - ✓ Badge count decreases by 1
   - ✓ Notification stays in list for reference

**Status:** 🟢 WORKING - Read indicators now clearly show notification state
