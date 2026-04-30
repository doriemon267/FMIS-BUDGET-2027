const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const { mainConnection } = require('../config/mongo_db');
const AuditLog = require("../models/AuditLog");
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { requireBudgetRole } = require('./requireBudgetRole');
const { syncUserEmailFromRequest } = require('../utils/syncUserEmailFromRequest');
const IS_PRODUCTION = require("../utils/IS_PRODUCTION");

const EXEMPT_PATHS = [
  '/get-user', 
  '/login', 
  '/logout', 
  '/health', 
  '/hierarchical-rbac/my-access',
  '/user/profile',
  '/user/preferences'
];

const isExemptPath = (req) => {
  const url = (req.originalUrl || req.url || '').split('?')[0];
  const cleanUrl = url.replace(/^\/api/, '') || '/';
  return EXEMPT_PATHS.some((p) => cleanUrl === p || cleanUrl.startsWith(`${p}/`));
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const pickEmailFromUsernameArray = (value) => {
  if (!Array.isArray(value)) return null;
  const fromIndexOne = String(value?.[1] || '').trim();
  if (fromIndexOne && isValidEmail(fromIndexOne)) return fromIndexOne;
  const anyEmail = value.map((item) => String(item || '').trim()).find((item) => isValidEmail(item));
  return anyEmail || null;
};

/**
 * UNIFIED AUTHENTICATION MIDDLEWARE
 * Handles development mock auth, production JWT verification, role resolution, and audit logging.
 */
module.exports = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();

    const exempted = isExemptPath(req);
    req.clientIp = getClientIp ? getClientIp(req) : (req.ip || req.connection?.remoteAddress);
    
    // 1. DEVELOPMENT MOCK AUTH
    const allowMockAuth = !IS_PRODUCTION && (process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true');
    const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];

    if (allowMockAuth && devUserId) {
      const uid = String(devUserId).trim();
      const devRolesHeader = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];
      const devEmailHeader = req.headers['x-dev-email'] || req.headers['X-Dev-Email'];
      let rolesArr = [];
      if (typeof devRolesHeader === 'string' && devRolesHeader.trim()) {
        rolesArr = devRolesHeader.split(',').map(r => String(r || '').trim()).filter(Boolean).map(r => r.replace(/\s+/g, '_').toUpperCase());
      }
      if (rolesArr.length === 0) rolesArr = ['BUDGET_PREPARER', 'DEVELOPER'];
      const devName = `Dev User (${uid})`;
      
      req.user = {
        id: uid, userId: uid, particularID: uid,
        particular: devName, userName: devName,
        Roles: rolesArr,
        email: devEmailHeader ? String(devEmailHeader).trim() : null,
        isDev: true
      };
      
      await syncUserEmailFromRequest(req).catch(() => {});
      if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });

      AuditLog.create({
        userId: uid, userName: devName, userRoles: rolesArr,
        action: "DEV_MOCK_AUTH", resource: "SYSTEM_ACCESS",
        method: req.method, ipAddress: req.clientIp,
        details: { mode: 'development_mock', autoAdmin: true, path: req.originalUrl }
      }).catch(() => {});

      if (exempted) return next();
      return requireBudgetRole(req, res, next);
    }

    // 2. TOKEN EXTRACTION
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = req.cookies?.jwtToken || req.cookies?.authToken || req.cookies?.jwt || 
                     (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!jwtToken) {
      if (exempted) return next();
      console.log(`[AUTH] Access denied (No token) for: ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // 3. VERIFICATION
    const secrets = [
      process.env.JWT_CLIENT_SECRET_PROD, 
      process.env.JWT_SECRET_KEY, 
      process.env.JWT_SECRET
    ].filter(Boolean);

    let payload = null;
    let verifyError = null;
    for (const secret of secrets) {
      try {
        payload = jwt.verify(jwtToken, secret, { algorithms: ['HS256'] });
        if (payload) break;
      } catch (err) { 
        verifyError = err;
      }
    }

    if (!payload) {
      if (exempted) return next();
      console.log(`[AUTH] Access denied (Invalid token) for: ${req.method} ${req.originalUrl} - ${verifyError?.message}`);
      return res.status(401).json({ error: "Invalid or expired token.", detail: verifyError?.message });
    }
    req.authToken = jwtToken;

    // 4. IDENTITY EXTRACTION
    const rawUserId = payload.userId || payload.id || payload.UserName || (Array.isArray(payload.Username) ? payload.Username[0] : payload.Username);
    if (!rawUserId) {
      return res.status(401).json({ error: "Access denied. User identity not found in token." });
    }
    const userId = String(rawUserId);

    // 5. ROLE RESOLUTION
    let roles = payload.roles || payload.Roles || [];
    if (!Array.isArray(roles)) roles = roles ? [roles] : [];

    if (roles.length === 0 && mainConnection?.readyState === 1) {
      try {
        const arDoc = await mainConnection.db.collection('assigned_roles').findOne({ 
          $or: [{ user: userId }, { user: Number(userId) }, { user: userId.toUpperCase() }] 
        });
        if (arDoc?.roles?.length > 0) {
          const roleDocs = await mainConnection.db.collection('roles').find({ _id: { $in: arDoc.roles } }).toArray();
          roles = roleDocs.map(r => r.name);
        }
      } catch (e) {
        console.error("[AUTH] Role Lookup Error:", e.message);
      }
    }

    const normalizedRoles = roles.map(r => String(r).replace(/\s+/g, '_').toUpperCase());

    // 6. PRODUCTION SUPER ADMIN WHITELIST
    const isSuper = normalizedRoles.some(r => /SUPER.?ADMIN/i.test(r));
    const allowedSuperIds = (process.env.SUPER_ADMIN_IDS || "").split(',').map(id => id.trim());
    
    if (IS_PRODUCTION && isSuper && !allowedSuperIds.includes(userId)) {
      AuditLog.create({ 
        userId, action: "BLOCKED_SUPERADMIN", 
        details: { error: "ID not whitelisted in production" },
        ipAddress: req.clientIp 
      }).catch(() => {});
      return res.status(403).json({ error: "Access denied. Admin ID not authorized." });
    }

    // 7. DATA FORMATTING
    const middleInitial = payload.MiddleName ? `${payload.MiddleName.charAt(0)}.` : "";
    const particular = `${payload.FirstName ?? ""} ${middleInitial} ${payload.LastName ?? ""} ${payload.Suffix ?? ""}`
                        .replace(/\s+/g, " ").trim() || userId;

    req.user = {
      ...payload,
      id: userId, userId: userId, particularID: userId,
      particular: particular, userName: particular,
      Roles: normalizedRoles,
      email: payload.email || payload.Email || payload.userEmail || payload.UserEmail || payload.mail || 
             pickEmailFromUsernameArray(payload.Username) || pickEmailFromUsernameArray(payload.username) || null
    };

    // 8. FINAL SYNC & AUDIT LOG
    await syncUserEmailFromRequest(req).catch(() => {});
    if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });

    AuditLog.create({
      userId, userName: particular, action: "AUTH_SUCCESS",
      userRoles: normalizedRoles, ipAddress: req.clientIp, method: req.method
    }).catch(() => {});

    if (exempted) return next();
    return requireBudgetRole(req, res, next);

  } catch (error) {
    console.error("[AUTH] Middleware Exception:", error.message);
    const isExpired = error.name === 'TokenExpiredError';
    
    AuditLog.create({
      userId: "SYSTEM", action: isExpired ? "TOKEN_EXPIRED" : "AUTH_EXCEPTION",
      ipAddress: req.clientIp, details: { error: error.message, path: req.originalUrl }
    }).catch(() => {});

    if (isExemptPath(req)) return next();

    return res.status(401).json({ 
      error: isExpired ? "Session expired. Please login again." : "Access denied.",
      expired: isExpired 
    });
  }
};
