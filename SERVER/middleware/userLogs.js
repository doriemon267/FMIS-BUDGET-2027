/**
 * User Activity Logs middleware – immutable, snapshot support for updates.
 * Use once per route so you don't repeat logging logic.
 *
 * Usage:
 *   const { logUserActivity, setSnapshot } = require('../middleware/userLogs');
 *
 *   // 1) Generic middleware (logs on success)
 *   router.put('/thing/:id', logUserActivity({ action: 'UPDATE', resource: 'Thing' }), controller.update);
 *
 *   // 2) With snapshot in controller (for UPDATE before/after)
 *   const before = await Thing.findById(id).lean();
 *   // ... do update ...
 *   setSnapshot(req, before, updatedDoc);
 *   res.json(updatedDoc);
 *
 *   // 3) Manual log
 *   const { createUserActivityLog } = require('../middleware/userLogs');
 *   await createUserActivityLog(req, { action: 'EXPORT', resource: 'Report', details: { format: 'PDF' } });
 */

const UserActivityLog = require('../models/UserActivityLog');

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apiKey', 'authorization', 'jwt', 'cookie'];

/**
 * Get client IP (prefer public IP when behind proxy).
 * Order: req.ip (set by Express when trust proxy) → X-Forwarded-For → X-Real-IP → socket.
 */
function getClientIp(req) {
  if (!req) return null;
  if (req.ip) return req.ip;
  const forwarded = req.get?.('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (req.get?.('x-real-ip')) return req.get('x-real-ip').trim();
  return req.connection?.remoteAddress ?? req.socket?.remoteAddress ?? null;
}

function sanitize(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => keyLower.includes(s))) {
      out[k] = '***REDACTED***';
    } else {
      out[k] = typeof v === 'object' && v !== null ? sanitize(v) : v;
    }
  }
  return out;
}

/**
 * Attach snapshot for UPDATE (before/after). Call in route before res.json().
 * @param {object} req - Express request
 * @param {object} before - Document state before update (plain object)
 * @param {object} after  - Document state after update (plain object)
 */
function setSnapshot(req, before, after) {
  if (!req) return;
  req._userLogSnapshot = {
    before: before != null ? sanitize(typeof before.toObject === 'function' ? before.toObject() : before) : null,
    after: after != null ? sanitize(typeof after.toObject === 'function' ? after.toObject() : after) : null,
  };
}

/**
 * Create one immutable activity log entry. Does not throw.
 */
async function createUserActivityLog(req, payload = {}) {
  try {
    const userId = req?.user?.id ?? req?.user?.userId ?? req?.user?.Id ?? req?.user?.Username?.[0] ?? 'anonymous';
    const userName =
      req?.user?.particular ??
      req?.user?.name ??
      (req?.user?.FirstName && req?.user?.LastName
        ? `${req.user.FirstName} ${req.user.LastName}`.trim()
        : req?.user?.Username?.[0]) ??
      '';
    const userRoles = req?.user?.Roles ?? req?.user?.workflowRoles ?? [];
    const normalizedRoles = Array.isArray(userRoles) ? userRoles.map(String) : [String(userRoles)];

    const snapshot = payload.snapshot ?? req?._userLogSnapshot ?? null;

    const entry = {
      userId: String(userId),
      userName: String(userName || userId),
      userRoles: normalizedRoles,
      action: payload.action ?? 'CUSTOM',
      resource: payload.resource ?? req?.path?.split('/').filter(Boolean)[0] ?? 'unknown',
      resourceId: payload.resourceId ?? req?.params?.id ?? null,
      snapshot: snapshot ? sanitize(snapshot) : null,
      method: payload.method ?? req?.method ?? null,
      path: payload.path ?? req?.path ?? null,
      ipAddress: payload.ipAddress ?? getClientIp(req) ?? null,
      userAgent: payload.userAgent ?? req?.get?.('user-agent') ?? null,
      details: sanitize(payload.details ?? {}),
      timestamp: new Date(),
    };

    await UserActivityLog.create(entry);
  } catch (err) {
    console.error('[UserLogs] createUserActivityLog failed:', err?.message || err);
  }
}

/**
 * Middleware: log one activity entry on successful response (2xx).
 * Reads action, resource from options; resourceId from options.getResourceId(req) or req.params.id.
 * Snapshot taken from req._userLogSnapshot if set by route (setSnapshot(req, before, after)).
 *
 * @param {object} options
 * @param {string} options.action - e.g. 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'
 * @param {string} options.resource - e.g. 'Proposal', 'Settings'
 * @param {(req) => string} [options.getResourceId] - optional; default uses req.params.id
 * @param {(req, res) => object} [options.getDetails] - optional extra details
 */
function logUserActivity(options = {}) {
  const { action, resource, getResourceId, getDetails } = options;

  return function middleware(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = typeof getResourceId === 'function' ? getResourceId(req) : req?.params?.id;
        const details = typeof getDetails === 'function' ? getDetails(req, res) : {};
        createUserActivityLog(req, {
          action: action || 'CUSTOM',
          resource: resource || req?.path?.split('/').filter(Boolean)[0] || 'unknown',
          resourceId: resourceId ?? undefined,
          details: details,
        }).catch(() => {});
      }
      return originalJson(body);
    };

    const originalSend = res.send.bind(res);
    res.send = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = typeof getResourceId === 'function' ? getResourceId(req) : req?.params?.id;
        const details = typeof getDetails === 'function' ? getDetails(req, res) : {};
        createUserActivityLog(req, {
          action: action || 'CUSTOM',
          resource: resource || req?.path?.split('/').filter(Boolean)[0] || 'unknown',
          resourceId: resourceId ?? undefined,
          details: details,
        }).catch(() => {});
      }
      return originalSend(data);
    };

    next();
  };
}

module.exports = {
  setSnapshot,
  createUserActivityLog,
  logUserActivity,
  sanitize,
};
