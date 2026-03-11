const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const { mainConnection } = require('../config/mongo_db');
const AuditLog = require("../models/AuditLog"); // Added Logging
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { requireBudgetRole } = require('./requireBudgetRole');
const { syncUserEmailFromRequest } = require('../utils/syncUserEmailFromRequest');

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const pickEmailFromUsernameArray = (value) => {
  if (!Array.isArray(value)) return null;
  const fromIndexOne = String(value?.[1] || '').trim();
  if (fromIndexOne && isValidEmail(fromIndexOne)) return fromIndexOne;
  const anyEmail = value.map((item) => String(item || '').trim()).find((item) => isValidEmail(item));
  return anyEmail || null;
};

/**
 * Authentication & Authorization Middleware (Production Grade with Whitelist & Logging)
 */
module.exports = async (req, res, next) => {
  try {
    // 1. Skip if it's a CORS preflight request
    if (req.method === 'OPTIONS') return next();

    // 2. Token Extraction
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = 
      req.cookies?.jwtToken || 
      req.cookies?.authToken || 
      req.cookies?.jwt || 
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // 3. Strict Verification
    const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
    if (!secret) {
      console.error("[CRITICAL] JWT Secret is not configured in .env");
      return res.status(500).json({ error: "Internal server configuration error" });
    }

    const payload = jwt.verify(jwtToken, secret, { algorithms: ['HS256'] });
    if (!payload) {
      return res.status(401).json({ error: "Invalid token structure" });
    }

    // 4. Metadata & IP Tracking
    req.authToken = jwtToken;
    req.clientIp = getClientIp ? getClientIp(req) : (req.ip || req.connection?.remoteAddress);

    // 5. User Identity Extraction
    const rawUserId = payload.userId || payload.id || payload.UserName || (Array.isArray(payload.Username) ? payload.Username[0] : payload.Username);
    
    if (!rawUserId) {
      return res.status(401).json({ error: "Access denied. User identity not found in token." });
    }
    const userId = String(rawUserId);

    // 6. Name Formatting (Original Logic)
    const middleInitial = payload.MiddleName ? `${payload.MiddleName.charAt(0)}.` : "";
    const particular = `${payload.FirstName ?? ""} ${middleInitial} ${payload.LastName ?? ""} ${payload.Suffix ?? ""}`
                        .replace(/\s+/g, " ")
                        .trim() || userId;

    // 7. Role Resolution (Original DB Fallback)
    let roles = payload.roles || payload.Roles || [];
    if (!Array.isArray(roles)) roles = roles ? [roles] : [];

    if (roles.length === 0 && mainConnection?.readyState === 1) {
      try {
        const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
        const Role = mainConnection.model('roles', new mongoose.Schema({}, { strict: false }), 'roles');

        const assigned = await AssignedRole.findOne({
          $or: [{ user: userId }, { user: Number(userId) }, { user: parseInt(userId, 10) }]
        }).lean();

        if (assigned && assigned.roles && assigned.roles.length > 0) {
          const roleNames = [];
          for (const roleItem of assigned.roles) {
            if (roleItem && roleItem._bsontype === 'ObjectId') {
              const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
              if (roleDoc?.name) roleNames.push(roleDoc.name);
            } else if (typeof roleItem === 'string' && roleItem.match(/^[0-9a-fA-F]{24}$/)) {
              const roleDoc = await Role.findById(roleItem, { name: 1 }).lean();
              if (roleDoc?.name) roleNames.push(roleDoc.name);
            } else if (typeof roleItem === 'object' && roleItem?.name) {
              roleNames.push(roleItem.name);
            } else if (typeof roleItem === 'string') {
              roleNames.push(roleItem);
            }
          }
          roles = roleNames;
        }
      } catch (dbError) {
        console.error("Role DB Lookup Error (main DB):", dbError.message);
      }
    }

    const normalizedRoles = roles.map(r => String(r).replace(/\s+/g, '_').toUpperCase());

    // 8. Attach Cleaned User Object
    req.user = {
      ...payload,
      id: userId,
      userId: userId,
      Roles: normalizedRoles,
      particular: particular,
      particularID: userId,
      userName: particular, // mapped to your AuditLog schema
      email:
        payload.email ||
        payload.Email ||
        payload.userEmail ||
        payload.UserEmail ||
        payload.mail ||
        pickEmailFromUsernameArray(payload.Username) ||
        pickEmailFromUsernameArray(payload.username) ||
        null
    };

    try {
      await syncUserEmailFromRequest(req);
    } catch (_syncError) {
      // silent sync only
    }

    // 9. [NEW] STRICT PRODUCTION WHITELIST FOR SUPER ADMINS (allow if user has another valid budget role)
    // In DEVELOPMENT mode: Skip SUPER_ADMIN_IDS check if user has any valid budget role
    const IS_PRODUCTION = process.env.PRODUCTION_MODE && String(process.env.PRODUCTION_MODE).trim().length > 0;
    const isSuper = normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('SUPERADMIN');
    const allowedIds = process.env.SUPER_ADMIN_IDS ? process.env.SUPER_ADMIN_IDS.split(',').map(id => id.trim()) : [];
    const whitelistedSuper = isSuper && allowedIds.includes(userId);
    const hasOtherBudgetRole = normalizedRoles.some((r) => {
      const n = String(r || '').trim();
      return n !== 'SUPER_ADMIN' && n !== 'SUPERADMIN' && [
        'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER',
        'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'BUDGET_COORDINATOR', 'BUDGET_ADMIN', 'REVIEWER', 'APPROVER'
      ].includes(n);
    });
    
    // DEVELOPMENT MODE: Skip SUPER_ADMIN_IDS whitelist if user has any valid budget role
    if (!IS_PRODUCTION && hasOtherBudgetRole) {
      // Allow access in development for any budget role, regardless of SUPER_ADMIN_IDS
      AuditLog.create({
        userId: userId,
        userName: particular,
        userRoles: normalizedRoles,
        action: "LOGIN_SUCCESS_DEV_BYPASS",
        resource: "AUTHENTICATION",
        method: req.method,
        ipAddress: req.clientIp,
        userAgent: req.headers['user-agent'],
        details: { note: "Development mode - SUPER_ADMIN_IDS check bypassed" }
      }).catch(() => {});
    } else if (isSuper && !whitelistedSuper && !hasOtherBudgetRole) {
      // PRODUCTION MODE or no other budget role: Enforce strict SUPER_ADMIN_IDS whitelist
      AuditLog.create({
        userId: userId,
        userName: particular,
        userRoles: normalizedRoles,
        action: "BLOCKED_UNAUTHORIZED_SUPERADMIN",
        resource: "SYSTEM_ACCESS",
        method: req.method,
        ipAddress: req.clientIp,
        details: { error: "Admin ID not whitelisted in .env" }
      }).catch(() => {});
      return res.status(403).json({
        code: 'UNAUTHORIZED_SUPER_ADMIN',
        error: "Access denied. Your Role/ID is not authorized for this environment."
      });
    }

    // 10. [NEW] SUCCESS AUDIT LOG
    AuditLog.create({
      userId: userId,
      userName: particular,
      userRoles: normalizedRoles,
      action: "LOGIN_SUCCESS",
      resource: "AUTHENTICATION",
      method: req.method,
      ipAddress: req.clientIp,
      userAgent: req.headers['user-agent']
    }).catch(() => {});

    if (resolveUserIdentity) {
      req.identity = await resolveUserIdentity({ req });
    }

    return requireBudgetRole(req, res, next);

  } catch (error) {
    // 11. ERROR LOGGING
    AuditLog.create({
      userId: "ANONYMOUS",
      userName: "SYSTEM",
      action: error.name === 'TokenExpiredError' ? "TOKEN_EXPIRED" : "AUTH_EXCEPTION",
      resource: "AUTHENTICATION",
      method: req.method,
      ipAddress: req.clientIp,
      details: { error: error.message }
    }).catch(() => {});

    console.error("Auth Middleware Error:", error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Session expired. Please login again.", expired: true });
    }
    return res.status(401).json({ error: "Access denied." });
  }
};