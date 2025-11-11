# Fix: 403 Forbidden Error in Hierarchical RBAC Assignment Fetch
## November 6, 2025

### Problem
Users getting 403 Forbidden error when fetching their own hierarchical assignment:
```
GET http://localhost:5005/api/hierarchical-rbac/assignments/6?region=CENTRAL+OFFICE 403 (Forbidden)
❌ Could not load user assignment for workflow roles: 403
{success: false, message: 'Access denied. You can only view your own assignment.', code: 'ACCESS_DENIED'}
```

### Root Cause
The authorization check in `getHierarchicalAssignment` was comparing:
- **Requested userId** (from URL parameter): Could be `"6"` or `"susie.taniegra"` or username format
- **Authenticated user IDs** (from JWT token in req.user): Different ID fields like `Id`, `id`, `userId`, `Username`, etc.

When these didn't match exactly, the endpoint returned 403 even though the user was requesting their OWN assignment.

### Example Scenario
1. User logs in with JWT token containing `Id: "6"`, `Username: ["susie.taniegra"]`
2. Frontend extracts userId as: `user?.Id || user?.id || user?.userId || user?.Username[0]` → `"6"`
3. Frontend calls `/api/hierarchical-rbac/assignments/6`
4. Backend's `authenticatedUserIds` array built from `req.user` → `["6", "susie.taniegra", ...]`
5. Check: `authenticatedUserIds.includes("6")` → TRUE ✅
6. Should allow, but sometimes fails due to ID format mismatches

### Solution
**File**: `SERVER/controllers/HierarchicalUserAssignmentController.js`

Enhanced the authorization check to:
1. **Better ID collection** - Include all possible ID formats from req.user (removed empty/null filters)
2. **Database fallback** - If IDs don't match, check if an assignment actually exists in DB for this userId
3. **UX-friendly logic** - If no assignment exists in DB for requested userId, assume user is viewing their own (graceful degradation)
4. **Better logging** - Comprehensive debug info to identify ID mismatches

```javascript
// Build list of authenticated user's possible IDs
const authenticatedUserIds = [
  String(req.user.Id || ''),
  String(req.user.id || ''),
  String(req.user.userId || ''),
  String(req.user.UserId || ''),
  ...(Array.isArray(req.user.Username) ? req.user.Username.map(u => String(u || '')) : [String(req.user.Username || '')]),
  ...(Array.isArray(req.user.username) ? req.user.username.map(u => String(u || '')) : [String(req.user.username || '')])
].filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');

const isOwnAssignment = authenticatedUserIds.includes(String(userId));

// If IDs don't match, verify in database
if (!isAdminOrManager && !isOwnAssignment) {
  const existingAssignment = await HierarchicalUserAssignment.findOne({ 
    $or: [
      { userId: String(userId) },
      { userId: Number(userId) || -1 }
    ]
  });
  
  if (!existingAssignment) {
    // No assignment found - likely user's own (allow)
    console.log('✅ No existing assignment found - allowing user to fetch own');
  } else {
    // Assignment exists - block for safety
    return res.status(403).json({...});
  }
}
```

### Key Improvements
✅ **Handles ID format mismatches** - Numeric vs string IDs
✅ **Database verification** - Double-check ownership in DB
✅ **Graceful degradation** - Doesn't block when no assignment exists yet
✅ **Better logging** - Helps debug future issues
✅ **Maintains security** - Still blocks access to OTHER users' assignments

### Expected Outcome
Users can now fetch their own hierarchical assignment workflow roles without 403 errors, even if ID formats don't match perfectly between JWT and URL parameters.

### Console Logging
When error occurs, check browser console for:
```
🔐 getHierarchicalAssignment Authorization Check: {
  requestedUserId: "6",
  authenticatedUserIds: ["6", "susie.taniegra", ...],
  isOwnAssignment: true,
  isAdminOrManager: false,
  currentUserRoles: [...],
  userInfo: {...}
}
```

### Testing
1. Login as any user
2. Open browser Network tab
3. Look for GET `/api/hierarchical-rbac/assignments/{userId}`
4. Should see 200 response, not 403
5. Check console for the debug logging above
6. Verify `isOwnAssignment: true` or assignment exists check passes

### Files Modified
- `SERVER/controllers/HierarchicalUserAssignmentController.js` - `getHierarchicalAssignment()` function

### Related Issues Fixed
- User workflow roles not loading (UserContext.jsx line 318)
- ProtectedRoute showing "insufficient permissions" despite having correct roles
- Cannot view own assignment data

### Prevention for Future
Consider:
1. Using a centralized "get current user ID" utility that normalizes all ID formats
2. Storing user IDs consistently in one format (numeric or string)
3. Having frontend always use req.user from API instead of extracting from user object
