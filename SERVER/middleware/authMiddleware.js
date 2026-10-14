const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const AuditLog = require("../models/AuditLog");
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { mainConnection } = require('../config/mongo_db');
const { requireBudgetRole } = require('./requireBudgetRole');
const { syncUserEmailFromRequest } = require('../utils/syncUserEmailFromRequest');

// --- HELPER FUNCTIONS ---
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const pickEmail = (payload) => {
  const emailFields = [
    payload.email, payload.Email, payload.userEmail, 
    payload.UserEmail, payload.mail
  ];
  const found = emailFields.find(isValidEmail);
  if (found) return found;
  
  const username = payload.Username || payload.username;
  if (Array.isArray(username)) {
    return username.map(i => String(i).trim()).find(isValidEmail) || null;
  }
  return null;
};

/**
 * UNIFIED AUTH MIDDLEWARE
 * Handles: Mock Auth (Dev), JWT Verification, Role Resolution, and Audit Logging
 */
module.exports = async (req, res, next) => {
  req.clientIp = getClientIp ? getClientIp(req) : (req.ip || req.connection?.remoteAddress);
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    if (req.method === 'OPTIONS') return next();

    // 1. DEVELOPMENT MOCK AUTH (Backdoor for local testing)
    const allowMockAuth = !isProduction && (process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true');
    const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];

    if (allowMockAuth && devUserId) {
      const uid = String(devUserId).trim();
      const devRoles = (req.headers['x-dev-roles'] || 'BUDGET_PREPARER,DEVELOPER')
                        .split(',').map(r => r.trim().toUpperCase());
      
      req.user = {
        id: uid, userId: uid, particularID: uid,
        particular: `Dev User (${uid})`,
        Roles: devRoles,
        email: req.headers['x-dev-email'] || null,
        isDev: true
      };
      
      await syncUserEmailFromRequest(req).catch(() => {});
      console.log(`[AUTH] Mock access granted for: ${uid}`);
      return requireBudgetRole(req, res, next);
    }

    // 2. TOKEN EXTRACTION (Cookies or Authorization Header)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = req.cookies?.jwtToken || req.cookies?.authToken || req.cookies?.jwt || 
                     (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // 3. STRICT VERIFICATION (Support multiple secret keys)
    const secrets = [
      process.env.JWT_CLIENT_SECRET_PROD, 
      process.env.JWT_SECRET_KEY, 
      process.env.JWT_SECRET
    ].filter(Boolean);

    let payload = null;
    for (const secret of secrets) {
      try {
        payload = jwt.verify(jwtToken, secret, { algorithms: ['HS256'] });
        if (payload) break;
      } catch (err) { /* try next secret */ }
    }

    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    req.authToken = jwtToken;

    // 4. IDENTITY EXTRACTION
    const userId = String(
      payload.userId || payload.id || payload.UserName || 
      (Array.isArray(payload.Username) ? payload.Username[0] : payload.Username) || ""
    );

    if (!userId) {
      return res.status(401).json({ error: "User identity not found in token." });
    }

    // 5. ROLE RESOLUTION (Database Fallback)
    let roles = payload.roles || payload.Roles || [];
    if (!Array.isArray(roles)) roles = [roles];

    // If roles are empty, lookup from main database
    if (roles.length === 0 && mainConnection?.readyState === 1) {
      try {
        const arDoc = await mainConnection.db.collection('AssignedRoles').findOne({ 
          $or: [{ user: userId }, { user: Number(userId) }, { user: userId.toUpperCase() }] 
        });
        if (arDoc?.roles?.length > 0) {
          const roleDocs = await mainConnection.db.collection('roles')
                                .find({ _id: { $in: arDoc.roles } }).toArray();
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
    
    if (isProduction && isSuper && !allowedSuperIds.includes(userId)) {
      AuditLog.create({ 
        userId, action: "BLOCKED_SUPERADMIN", 
        details: { error: "ID not whitelisted in production" },
        ipAddress: req.clientIp 
      }).catch(() => {});
      return res.status(403).json({ error: "Access denied. Admin ID not authorized." });
    }

    // 7. DATA FORMATTING & ATTACHING TO REQUEST
    const middleInitial = payload.MiddleName ? `${payload.MiddleName.charAt(0)}.` : "";
    const particular = `${payload.FirstName ?? ""} ${middleInitial} ${payload.LastName ?? ""} ${payload.Suffix ?? ""}`
                        .replace(/\s+/g, " ").trim() || userId;

    req.user = {
      ...payload,
      id: userId,
      userId: userId,
      particularID: userId,
      particular: particular,
      userName: particular,
      Roles: normalizedRoles,
      email: pickEmail(payload)
    };

    // 8. FINAL SYNC & AUDIT LOG
    await syncUserEmailFromRequest(req).catch(() => {});
    if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });

    AuditLog.create({
      userId,
      userName: particular,
      action: "AUTH_SUCCESS",
      userRoles: normalizedRoles,
      ipAddress: req.clientIp,
      method: req.method
    }).catch(() => {});

    // Proceed to role-based access control
    return requireBudgetRole(req, res, next);

  } catch (error) {
    console.error("[AUTH] Middleware Exception:", error.message);
    const isExpired = error.name === 'TokenExpiredError';
    
    AuditLog.create({
      userId: "SYSTEM",
      action: isExpired ? "TOKEN_EXPIRED" : "AUTH_EXCEPTION",
      ipAddress: req.clientIp,
      details: { error: error.message }
    }).catch(() => {});

    return res.status(401).json({ 
      error: isExpired ? "Session expired. Please login again." : "Access denied.",
      expired: isExpired 
    });
  }
};
