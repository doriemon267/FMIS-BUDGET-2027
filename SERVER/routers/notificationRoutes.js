const router = require('express').Router();
const Notification = require('../models/Notification');
const checkToken = require('../middleware/checkToken');

// Auth for all notification routes
router.use(checkToken);

// Helper to build candidate recipient identifiers for current user
const getRecipientCandidates = (user = {}) => {
  const ids = new Set();
  const add = (v) => {
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) ids.add(s);
    }
  };
  const first = (v) => Array.isArray(v) ? v[0] : v;

  // Common ID fields
  add(user.id); add(user.Id); add(user.ID);

  // Username fields (array or string, various casings)
  add(first(user.Username));
  add(user.username);

  // System-specific identifiers
  add(user.userId); add(user.UserId); add(user.UserID);
  add(user.userCode); add(user.UserCode);
  add(user.employeeCode); add(user.EmployeeCode);
  add(user.empCode); add(user.EmpCode);
  add(user.code); add(user.Code);

  // Auth/provider identifiers
  add(user.email); add(user.Email);
  add(user.sub); add(user.subject);
  add(user.authId); add(user.auth_id); add(user.authID);
  add(user.accountId); add(user.AccountId); add(user.AccountID);

  return Array.from(ids);
};

// List notifications for current user (UNREAD by default)
// Debug modes via header X-Debug-Notif:
// - 'true'  → include debug metadata
// - 'all'   → return all statuses (READ + UNREAD) for the matched recipient(s) and include debug metadata
// Optional: X-Debug-Recipient to override recipient filter for inspection
router.get('/notifications', async (req, res) => {
  try {
    const debugMode = String(req.headers['x-debug-notif'] || '').toLowerCase();
    const overrideRecipient = req.headers['x-debug-recipient'];

    let candidates = getRecipientCandidates(req.user);
    if (overrideRecipient) {
      const s = String(overrideRecipient).trim();
      if (s) candidates = [s];
    }

    const baseFilter = candidates.length
      ? { recipientUserId: { $in: candidates } }
      : { recipientUserId: String(req.user.id) };

    const query = debugMode === 'all'
      ? baseFilter
      : { ...baseFilter, status: 'UNREAD' };

    const list = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const includeDebug = debugMode === 'true' || debugMode === 'all';
    if (includeDebug) {
      return res.json({ success: true, data: list, debug: { candidates, usedQuery: query } });
    }

    res.json({ success: true, data: list });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: e.message });
  }
});

// Mark notifications as read
router.post('/notifications/mark-read', async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids array is required' });
    }
    const candidates = getRecipientCandidates(req.user);
    const filter = candidates.length
      ? { _id: { $in: ids }, recipientUserId: { $in: candidates } }
      : { _id: { $in: ids }, recipientUserId: String(req.user.id) };
    await Notification.updateMany(
      filter,
      { $set: { status: 'READ', readAt: new Date() } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read', error: e.message });
  }
});

module.exports = router;