# NOTIFICATION FIX - EXACT LINE-BY-LINE CHANGES

## File 1: CLIENT/src/global/components/NotificationsContext.jsx

### Change 1: Mark Notifications as Read (Line 32)
```javascript
// BEFORE (BROKEN ❌)
const { mutateAsync: markNotificationsAsRead } = useMutation({
  mutationFn: async (ids) => {
    const payload = { ids: Array.isArray(ids) ? ids : [ids] };
    await api.post('/api/notifications/mark-read', payload);  // ❌ /api/api/*
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
  },
});

// AFTER (FIXED ✅)
const { mutateAsync: markNotificationsAsRead } = useMutation({
  mutationFn: async (ids) => {
    const payload = { ids: Array.isArray(ids) ? ids : [ids] };
    await api.post('/notifications/mark-read', payload);  // ✅ /api/notifications/*
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['serverNotifications'] });
  },
});
```
**Change**: `/api/notifications/mark-read` → `/notifications/mark-read`

---

### Change 2: Delete Notifications - Bulk (Line 46)
```javascript
// BEFORE (BROKEN ❌)
const { mutateAsync: deleteNotifications } = useMutation({
  mutationFn: async (idsOrId) => {
    if (!idsOrId) return;
    if (Array.isArray(idsOrId)) {
      const payload = { ids: idsOrId };
      await api.post('/api/notifications/delete', payload);  // ❌ /api/api/*

// AFTER (FIXED ✅)
const { mutateAsync: deleteNotifications } = useMutation({
  mutationFn: async (idsOrId) => {
    if (!idsOrId) return;
    if (Array.isArray(idsOrId)) {
      const payload = { ids: idsOrId };
      await api.post('/notifications/delete', payload);  // ✅ /api/notifications/*
```
**Change**: `/api/notifications/delete` → `/notifications/delete`

---

### Change 3: Delete Notifications - Single (Line 48)
```javascript
// BEFORE (BROKEN ❌)
    } else {
      await api.delete(`/api/notifications/${idsOrId}`);  // ❌ /api/api/*
    }

// AFTER (FIXED ✅)
    } else {
      await api.delete(`/notifications/${idsOrId}`);  // ✅ /api/notifications/*
    }
```
**Change**: `/api/notifications/${id}` → `/notifications/${id}`

---

### Change 4: Mute Proposal Notifications (Line 57)
```javascript
// BEFORE (BROKEN ❌)
const { mutateAsync: muteProposal } = useMutation({
  mutationFn: async ({ proposalId, mute = true }) => {
    await api.post('/api/notifications/mute', { proposalId, mute });  // ❌ /api/api/*
  },

// AFTER (FIXED ✅)
const { mutateAsync: muteProposal } = useMutation({
  mutationFn: async ({ proposalId, mute = true }) => {
    await api.post('/notifications/mute', { proposalId, mute });  // ✅ /api/notifications/*
  },
```
**Change**: `/api/notifications/mute` → `/notifications/mute`

---

### Change 5: Mark All Notifications as Read (Line 82)
```javascript
// BEFORE (BROKEN ❌)
const { mutateAsync: markAllNotificationsAsRead } = useMutation({
  mutationFn: async (options = {}) => {
    const res = await api.post('/api/notifications/mark-all-read', options);  // ❌ /api/api/*
    return res.data;

// AFTER (FIXED ✅)
const { mutateAsync: markAllNotificationsAsRead } = useMutation({
  mutationFn: async (options = {}) => {
    const res = await api.post('/notifications/mark-all-read', options);  // ✅ /api/notifications/*
    return res.data;
```
**Change**: `/api/notifications/mark-all-read` → `/notifications/mark-all-read`

---

## File 2: CLIENT/src/components/workflow/ProposalNotifications.jsx

### Change 6: Mark Notifications as Read (Line 166)
```javascript
// BEFORE (BROKEN ❌)
const markAsRead = useCallback(async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  try {
    const response = await api.post('/api/notifications/mark-read', { ids });  // ❌ /api/api/*
    console.debug('markAsRead response:', response?.data);

// AFTER (FIXED ✅)
const markAsRead = useCallback(async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  try {
    const response = await api.post('/notifications/mark-read', { ids });  // ✅ /api/notifications/*
    console.debug('markAsRead response:', response?.data);
```
**Change**: `/api/notifications/mark-read` → `/notifications/mark-read`

---

### Change 7: Mark All Notifications as Read (Line 213)
```javascript
// BEFORE (BROKEN ❌)
const markAllAsRead = useCallback(async () => {
  try {
    setLoading(true);
    let responseData;
    if (typeof markAllNotificationsAsRead === 'function') {
      responseData = await markAllNotificationsAsRead();
    } else {
      const r = await api.post('/api/notifications/mark-all-read');  // ❌ /api/api/*
      responseData = r?.data;
    }

// AFTER (FIXED ✅)
const markAllAsRead = useCallback(async () => {
  try {
    setLoading(true);
    let responseData;
    if (typeof markAllNotificationsAsRead === 'function') {
      responseData = await markAllNotificationsAsRead();
    } else {
      const r = await api.post('/notifications/mark-all-read');  // ✅ /api/notifications/*
      responseData = r?.data;
    }
```
**Change**: `/api/notifications/mark-all-read` → `/notifications/mark-all-read`

---

## Summary of Changes

| # | File | Line(s) | Endpoint | Old | New |
|---|------|---------|----------|-----|-----|
| 1 | NotificationsContext.jsx | 32 | Mark Read | `/api/notifications/mark-read` | `/notifications/mark-read` |
| 2 | NotificationsContext.jsx | 46 | Delete Bulk | `/api/notifications/delete` | `/notifications/delete` |
| 3 | NotificationsContext.jsx | 48 | Delete Single | `/api/notifications/{id}` | `/notifications/{id}` |
| 4 | NotificationsContext.jsx | 57 | Mute | `/api/notifications/mute` | `/notifications/mute` |
| 5 | NotificationsContext.jsx | 82 | Mark All Read | `/api/notifications/mark-all-read` | `/notifications/mark-all-read` |
| 6 | ProposalNotifications.jsx | 166 | Mark Read | `/api/notifications/mark-read` | `/notifications/mark-read` |
| 7 | ProposalNotifications.jsx | 213 | Mark All Read | `/api/notifications/mark-all-read` | `/notifications/mark-all-read` |

---

## Pattern of Fixes

All changes follow the same pattern:
```
Remove '/api' prefix from frontend API paths

Because:
- API Client baseURL already = /api
- Backend routes already mounted at /api
- Frontend was adding /api twice
- Causing /api/api/... paths (404 errors)
```

---

## Files NOT Changed

These files were verified and need NO changes:

✅ `CLIENT/src/global/components/NotificationsContext.jsx` - Lines 20 (GET only)
✅ `CLIENT/src/components/workflow/ProposalNotifications.jsx` - Line 45 (GET only)
✅ `SERVER/routers/notificationRoutes.js` - All routes correct
✅ `SERVER/models/Notification.js` - Schema correct
✅ `SERVER/controllers/notificationController.js` - Handlers correct
✅ `SERVER/index.js` - Route mounting correct
✅ Database - No schema changes needed

---

## Deployment Instructions

1. **Update Frontend Files**:
   - Replace: `CLIENT/src/global/components/NotificationsContext.jsx`
   - Replace: `CLIENT/src/components/workflow/ProposalNotifications.jsx`

2. **Rebuild Frontend**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   - Deploy new frontend bundle
   - No server restart needed
   - No database migrations needed

4. **Clear Cache**:
   - Hard refresh browser (Ctrl+Shift+R)

5. **Test**:
   - Click notification
   - Verify Network tab shows `/api/notifications/mark-read` with status 200
   - Verify notification updates in UI
   - Verify database status field changed to READ

---

## Verification Commands

### Check Frontend Changes
```bash
grep -n "'/api/notifications" CLIENT/src/global/components/NotificationsContext.jsx
grep -n "'/api/notifications" CLIENT/src/components/workflow/ProposalNotifications.jsx
# Should return 0 results (all fixed)
```

### Check Backend Routes
```bash
grep -n "router.post('/notifications" SERVER/routers/notificationRoutes.js
# Should show:
# 158: router.post('/notifications/mark-read',
# 222: router.post('/notifications/mark-all-read',
# etc.
```

### Test in Browser Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Click notification
4. Look for: `POST /api/notifications/mark-read`
5. Status should be: `200 OK` ✅

---

## Total Impact

- **Lines Changed**: 7 API endpoint paths
- **Files Modified**: 2 frontend component files
- **Backend Changes**: 0 (already correct)
- **Database Changes**: 0 (already functional)
- **Breaking Changes**: 0 (backward compatible)
- **Risk Level**: Very Low (frontend-only, isolated changes)

---

**Status**: ✅ All changes applied and verified
**Ready for**: Production deployment
