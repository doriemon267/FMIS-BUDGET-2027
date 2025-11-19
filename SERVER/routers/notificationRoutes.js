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

    // Also include role-based notifications (normalize into a few common variants)
    const userRoles = req.user.Roles || [];
    const roleSet = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet.add(raw);
      // normalized underscore upper-case (BUDGET MANAGER -> BUDGET_MANAGER)
      roleSet.add(raw.toUpperCase().replace(/\s+/g, '_'));
      // normalized with underscores and remove non-alphanum except underscore
      roleSet.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
      // Also include space-variant if stored with underscores (BUDGET_MANAGER -> BUDGET MANAGER)
      roleSet.add(raw.toUpperCase().replace(/_/g, ' '));
    });
    const roleCandidates = Array.from(roleSet);

    const baseFilter = {
      $or: [
        { recipientUserId: { $in: candidates } },
        { recipientUserIdNormalized: { $in: candidates } },
        { recipientUserId: { $in: roleCandidates } },
        { recipientUserIdNormalized: { $in: roleCandidates } },
        { recipientUserId: { $in: userRoles } },
        { recipientUserIdNormalized: { $in: userRoles } }
      ]
    };

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

// Debug helper to return raw notifications / query details for current user
// Access pattern: GET /notifications/debug?limit=100&status=UNREAD
// Optional headers: X-Debug-Recipient to override candidate; X-Debug-Notif=all to include READ
router.get('/notifications/debug', async (req, res) => {
  try {
    const { limit = 100 } = req.query || {};
    const debugMode = String(req.headers['x-debug-notif'] || '').toLowerCase();
    const overrideRecipient = req.headers['x-debug-recipient'] || req.query.recipient;

    let candidates = getRecipientCandidates(req.user);
    if (overrideRecipient) {
      const s = String(overrideRecipient).trim();
      if (s) candidates = [s];
    }

    const userRoles = req.user.Roles || [];
    const roleSet = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet.add(raw);
      roleSet.add(raw.toUpperCase().replace(/\s+/g, '_'));
      roleSet.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
    });
    const roleCandidates = Array.from(roleSet);

    const baseFilter = {
      $or: [
        { recipientUserId: { $in: candidates } },
        { recipientUserIdNormalized: { $in: candidates } },
        { recipientUserId: { $in: roleCandidates } },
        { recipientUserIdNormalized: { $in: roleCandidates } },
        { recipientUserId: { $in: userRoles } },
        { recipientUserIdNormalized: { $in: userRoles } }
      ]
    };

    const query = debugMode === 'all' ? baseFilter : { ...baseFilter, status: 'UNREAD' };

    const docs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: docs, debug: { candidates, roleCandidates, usedQuery: query } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch debug notifications', error: e.message });
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
    const userRoles = req.user.Roles || [];
    const roleSet2 = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet2.add(raw);
      roleSet2.add(raw.toUpperCase().replace(/\s+/g, '_'));
      roleSet2.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
    });
    const roleCandidates = Array.from(roleSet2);

    const filter = {
      _id: { $in: ids },
      $or: [
        { recipientUserId: { $in: candidates } },
        { recipientUserIdNormalized: { $in: candidates } },
        { recipientUserId: { $in: roleCandidates } },
        { recipientUserIdNormalized: { $in: roleCandidates } },
        { recipientUserId: { $in: userRoles } },
        { recipientUserIdNormalized: { $in: userRoles } }
      ]
    };

    const result = await Notification.updateMany(
      filter,
      { $set: { status: 'READ', readAt: new Date() } }
    );

    // Return more debug details to help the client know what changed
    const updatedCount = (result && (result.modifiedCount ?? result.nModified ?? 0));
    // Return the IDs that were actually marked as read for better UI sync
    let updatedIds = [];
    if (updatedCount > 0) {
      const updatedDocs = await Notification.find({ _id: { $in: ids }, status: 'READ' }, { _id: 1 }).lean();
      updatedIds = updatedDocs.map(d => String(d._id));
    }

    const debugMode = String(req.headers['x-debug-notif'] || '').toLowerCase();
    if (debugMode) {
      console.debug('notifications.mark-read', { filter, ids, updatedCount, updatedIds });
    }

    res.json({ success: true, modifiedCount: updatedCount, updatedIds });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read', error: e.message });
  }
});

// Mark all notifications as read for the current user/roles
router.post('/notifications/mark-all-read', async (req, res) => {
  try {
    // Optional: allow scoping by entity or proposalId
    const { entity, proposalId } = req.body || {};

    const candidates = getRecipientCandidates(req.user);
    const userRoles = req.user.Roles || [];
    const roleSet2 = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet2.add(raw);
      roleSet2.add(raw.toUpperCase().replace(/\s+/g, '_'));
      roleSet2.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
    });
    const roleCandidates = Array.from(roleSet2);

    const baseFilter = {
      $and: [
        { status: 'UNREAD' },
        {
          $or: [
            { recipientUserId: { $in: candidates } },
            { recipientUserIdNormalized: { $in: candidates } },
            { recipientUserId: { $in: roleCandidates } },
            { recipientUserIdNormalized: { $in: roleCandidates } },
            { recipientUserId: { $in: userRoles } },
            { recipientUserIdNormalized: { $in: userRoles } }
          ]
        }
      ]
    };

    if (entity) {
      baseFilter.$and.push({ entity });
    }
    if (proposalId) {
      baseFilter.$and.push({ 'metadata.proposalId': String(proposalId) });
    }

    const result = await Notification.updateMany(
      baseFilter,
      { $set: { status: 'READ', readAt: new Date() } }
    );

    const updatedCount = (result && (result.modifiedCount ?? result.nModified ?? 0));
    let updatedIds = [];
    if (updatedCount > 0) {
      const updatedDocs = await Notification.find({ ...baseFilter }, { _id: 1 }).lean();
      updatedIds = updatedDocs.map(d => String(d._id));
    }

    const debugMode = String(req.headers['x-debug-notif'] || '').toLowerCase();
    if (debugMode) {
      console.debug('notifications.mark-all-read', { baseFilter, updatedCount, updatedIds });
    }

    res.json({ success: true, modifiedCount: updatedCount, updatedIds });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read', error: e.message });
  }
});

// DEBUG: Create test notification for current user (development only)
router.post('/notifications/test', async (req, res) => {
  try {
    const candidates = getRecipientCandidates(req.user);
    const recipientUserId = candidates[0] || req.user?.id || 'test-user';

    const testNotifications = [
      {
        recipientUserId,
        type: 'PROPOSAL_SUBMITTED',
        title: 'Your Liquidation - Traveling and Training Allowances - Local disbursement voucher',
        message: 'John Doe has submitted proposal for your action.',
        relatedEntityId: 'test-proposal-1',
        relatedEntityType: 'PROPOSAL',
        relatedLink: '/new-proposal-workflow?tab=all-proposals&proposalId=test-1',
        entity: 'proposal',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 20 * 60000)
      },
      {
        recipientUserId,
        type: 'PROPOSAL_RETURNED',
        title: 'Your Cash Advance - Traveling and Training Allowances',
        message: 'Jane Smith has returned proposal with feedback. Comment: Please review the budget allocation.',
        relatedEntityId: 'test-proposal-2',
        relatedEntityType: 'PROPOSAL',
        relatedLink: '/new-proposal-workflow?tab=all-proposals&proposalId=test-2',
        entity: 'proposal',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 25 * 60000)
      },
      {
        recipientUserId,
        type: 'PROPOSAL_SUBMITTED',
        title: 'Your Cash Advance - Traveling and Training Allowances',
        message: 'Mark Johnson has submitted proposal for your action.',
        relatedEntityId: 'test-proposal-3',
        relatedEntityType: 'PROPOSAL',
        relatedLink: '/new-proposal-workflow?tab=all-proposals&proposalId=test-3',
        entity: 'proposal',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 25 * 60000)
      },
      {
        recipientUserId,
        type: 'PROPOSAL_SUBMITTED',
        title: 'Your Cash Advance - Traveling and Training Allowances',
        message: 'Robert Davis has submitted proposal for your action.',
        relatedEntityId: 'test-proposal-4',
        relatedEntityType: 'PROPOSAL',
        relatedLink: '/new-proposal-workflow?tab=all-proposals&proposalId=test-4',
        entity: 'proposal',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 26 * 60000)
      },
      {
        recipientUserId,
        type: 'PROPOSAL_SUBMITTED',
        title: 'Your Cash Advance - Payroll of Salaries, Wages',
        message: 'Sarah Wilson has submitted proposal for your action.',
        relatedEntityId: 'test-proposal-5',
        relatedEntityType: 'PROPOSAL',
        relatedLink: '/new-proposal-workflow?tab=all-proposals&proposalId=test-5',
        entity: 'proposal',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 26 * 60000)
      }
    ];

    const result = await Notification.insertMany(testNotifications);
    res.json({
      success: true,
      message: `Created ${result.length} test notifications`,
      recipientUserId,
      candidates
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to create test notifications', error: e.message });
  }
});

// Delete a specific notification (only recipient/role can delete)
router.delete('/notifications/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const candidates = getRecipientCandidates(req.user);
    const userRoles = req.user.Roles || [];
    const roleSet = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet.add(raw);
      roleSet.add(raw.toUpperCase().replace(/\s+/g, '_'));
      roleSet.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
    });
    const roleCandidates = Array.from(roleSet);

    const filter = {
      _id: id,
      $or: [
        { recipientUserId: { $in: candidates } },
        { recipientUserIdNormalized: { $in: candidates } },
        { recipientUserId: { $in: roleCandidates } },
        { recipientUserIdNormalized: { $in: roleCandidates } },
        { recipientUserId: { $in: userRoles } },
        { recipientUserIdNormalized: { $in: userRoles } }
      ]
    };

    const result = await Notification.findOneAndDelete(filter);
    if (!result) return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
    res.json({ success: true, deletedId: id });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete notification', error: e.message });
  }
});

// Bulk delete notifications by ids (optional)
router.post('/notifications/delete', async (req, res) => {
  try {
    const { ids = [] } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'ids array is required' });
    const candidates = getRecipientCandidates(req.user);
    const userRoles = req.user.Roles || [];
    const roleSet = new Set();
    userRoles.forEach((r) => {
      if (!r) return;
      const raw = String(r).trim();
      if (!raw) return;
      roleSet.add(raw);
      roleSet.add(raw.toUpperCase().replace(/\s+/g, '_'));
      roleSet.add(raw.toUpperCase().replace(/[\s\/-]+/g, '_').replace(/[^A-Z0-9_]/g, '_'));
    });
    const roleCandidates = Array.from(roleSet);

    const filter = {
      _id: { $in: ids },
      $or: [
        { recipientUserId: { $in: candidates } },
        { recipientUserIdNormalized: { $in: candidates } },
        { recipientUserId: { $in: roleCandidates } },
        { recipientUserIdNormalized: { $in: roleCandidates } },
        { recipientUserId: { $in: userRoles } },
        { recipientUserIdNormalized: { $in: userRoles } }
      ]
    };

    const result = await Notification.deleteMany(filter);
    const deletedCount = result && (result.deletedCount ?? 0);
    res.json({ success: true, deletedCount });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete notifications', error: e.message });
  }
});

module.exports = router;