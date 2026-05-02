/**
 * Read-only API for User Activity Logs (immutable).
 * List/filter logs; no create/update/delete from API.
 */

const express = require('express');
const router = express.Router();
const UserActivityLog = require('../models/UserActivityLog');
const isAuth = require('../middleware/is_auth');

router.use(isAuth);

function normalizeRole(role) {
  return String(role || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isSuperAdminUser(req) {
  const roles = Array.isArray(req.user?.Roles) ? req.user.Roles : [];
  const normalized = roles.map(normalizeRole);
  const roleBased = normalized.includes('SUPERADMIN');

  const currentUserId = String(req.user?.id ?? req.user?.userId ?? req.user?.Id ?? '').trim();
  const envSuperAdminIds = String(process.env.SUPER_ADMIN_IDS || '')
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const idBased = currentUserId && envSuperAdminIds.includes(currentUserId);

  return roleBased || idBased;
}

/**
 * GET /api/user-activity-logs
 * Query: userId, resource, action, resourceId, startDate, endDate, limit, page
 * Note: We do NOT log READ on this endpoint to avoid log inflation when viewing/refreshing the logs page.
 */
router.get(
  '/',
  async (req, res) => {
    try {
      const currentUserId = req.user?.id ?? req.user?.userId ?? req.user?.Id ?? '';
      const isSuperAdmin = isSuperAdminUser(req);

      const { userId, resource, action, resourceId, startDate, endDate, limit = 50, page = 1 } = req.query;

      const query = {};

      if (userId) query.userId = userId;
      else if (!isSuperAdmin) query.userId = String(currentUserId);

      if (resource) query.resource = resource;
      if (action) query.action = action;
      if (resourceId) query.resourceId = resourceId;
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = Math.max(0, (Number(page) || 1) - 1) * Math.min(100, Math.max(1, Number(limit) || 50));
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));

      const [list, total] = await Promise.all([
        UserActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
        UserActivityLog.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: list,
        pagination: { page: Number(page) || 1, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      console.error('[UserActivityLogs] list error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to list activity logs' });
    }
  }
);

/**
 * GET /api/user-activity-logs/:id (single log entry, read-only)
 * Note: We do NOT log READ here to avoid extra log entries when opening log details.
 */
router.get(
  '/:id',
  async (req, res) => {
    try {
      const currentUserId = req.user?.id ?? req.user?.userId ?? req.user?.Id ?? '';
      const isSuperAdmin = isSuperAdminUser(req);

      const doc = await UserActivityLog.findById(req.params.id).lean();
      if (!doc) return res.status(404).json({ success: false, message: 'Log entry not found' });
      if (!isSuperAdmin && String(doc.userId) !== String(currentUserId)) {
        return res.status(403).json({ success: false, message: 'Not allowed to view this log' });
      }
      res.json({ success: true, data: doc });
    } catch (err) {
      console.error('[UserActivityLogs] get error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Failed to get activity log' });
    }
  }
);

module.exports = router;

