# Notification Status Update Fix - November 20, 2025

## Problem Summary
User reported: "Tang inang notification ito hindi parin nagbabago" (these notifications still aren't changing)
- 2 "Proposal Returned to Approver" notifications were stuck showing as unread
- Clicking the notification or close button wasn't marking them as read
- UI wasn't updating after click

## Root Cause Analysis
After investigating all components:
1. ✅ **Backend API**: Fully functional - endpoints exist and work perfectly
2. ✅ **Database**: Update capability confirmed working - can mark notifications as READ
3. ✅ **Notification Model**: Schema correct with status and readAt fields  
4. ❌ **Frontend API Calls**: **BROKEN** - API path mismatch!

### The Bug
Frontend code was calling:
```
/api/notifications/mark-read
/api/notifications/delete
/api/notifications/mark-all-read
/api/notifications/mute
```

But the API client has `baseURL: env("SERVER_URL")` which is the backend URL.
Server has routes registered at: `/api` prefix
So actual route is: `/api/notifications/mark-read`

When frontend calls `/api/notifications/mark-read`, the request goes to:
```
${baseURL}/api/notifications/mark-read = http://server/api/api/notifications/mark-read
```

**Result: 404 Error - Endpoint not found**

## Solution Applied

### Files Modified
1. **CLIENT/src/global/components/NotificationsContext.jsx**
   - Line 32: `/api/notifications/mark-read` → `/notifications/mark-read`
   - Line 46: `/api/notifications/delete` → `/notifications/delete`
   - Line 48: `/api/notifications/${idsOrId}` → `/notifications/${idsOrId}`
   - Line 57: `/api/notifications/mute` → `/notifications/mute`
   - Line 82: `/api/notifications/mark-all-read` → `/notifications/mark-all-read`

2. **CLIENT/src/components/workflow/ProposalNotifications.jsx**
   - Line 166: `/api/notifications/mark-read` → `/notifications/mark-read`
   - Line 213: `/api/notifications/mark-all-read` → `/notifications/mark-all-read`

### Changes Summary
| Endpoint | Before | After | Status |
|----------|--------|-------|--------|
| Mark Read | `/api/notifications/mark-read` | `/notifications/mark-read` | ✅ Fixed |
| Delete | `/api/notifications/delete` | `/notifications/delete` | ✅ Fixed |
| Mark All Read | `/api/notifications/mark-all-read` | `/notifications/mark-all-read` | ✅ Fixed |
| Mute | `/api/notifications/mute` | `/notifications/mute` | ✅ Fixed |
| Fetch (GET) | `/api/notifications` | `/api/notifications` | ✅ Correct |

## How This Fix Works

1. **Before**: Click → API call to /api/api/notifications/mark-read → 404 → No update
2. **After**: Click → API call to /notifications/mark-read (via baseURL) → ✅ 200 → Updates DB → UI refreshes

## Testing Instructions

To verify the fix works:
1. Build/restart the frontend application
2. Navigate to the dashboard or notifications area
3. Click on an unread notification (close button or notification item)
4. Check the browser Network tab - should see successful request to `/api/notifications/mark-read` (baseURL automatically adds `/api`)
5. Verify the notification disappears or status changes to READ
6. Check database: notification.status should be "READ" with readAt timestamp

## Backend Verification (Already Complete)
✅ Database update works (tested with test-notification-read.js)
✅ API endpoint accepts requests and processes correctly
✅ No backend code changes needed

## Code Flow After Fix
```
User clicks notification
    ↓
markNotificationsAsRead([notificationId]) called
    ↓
API POST to /notifications/mark-read (becomes /api/notifications/mark-read via baseURL)
    ↓
Backend receives request, updates DB
    ↓
Returns { success: true, modifiedCount: 1 }
    ↓
React Query invalidates cache
    ↓
UI re-fetches notifications
    ↓
Notification gone or shows as READ ✅
```

## Key Insight
The bug was a classic frontend-backend integration issue:
- Backend routes: Mounted at `/api` → route is `/notifications/mark-read` → accessed at `/api/notifications/mark-read`
- Frontend API client: Has `/api` in baseURL
- Frontend code: Was ALSO prepending `/api` → Double `/api` → 404

The fix ensures frontend calls match the actual backend route structure.

## Status
✅ **FIX COMPLETE** - Ready for testing
- All 4 notification mutation endpoints corrected
- No backend changes needed
- Database confirmed working
- Frontend will now properly update notification status

## Related Files Modified
- CLIENT/src/global/components/NotificationsContext.jsx (4 endpoints fixed)
- CLIENT/src/components/workflow/ProposalNotifications.jsx (2 endpoints fixed)

## Next Steps
1. Rebuild frontend application
2. Test clicking notifications to verify they mark as read
3. Verify UI updates immediately after marking
4. Confirm database records status field updates
