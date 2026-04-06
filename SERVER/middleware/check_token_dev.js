const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const AuditLog = require("../models/AuditLog");
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { mainConnection } = require('../config/mongo_db');
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
 * Development Middleware: Allows Mock Auth and Auto-SuperAdmin
 */
module.exports = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();

    req.clientIp = getClientIp(req);
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Safety check: Avoid bypass if accidentally deployed to production
    const allowMockAuth = !isProduction && (process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true');
    const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
    
    // 1. DEVELOPMENT BACKDOOR LOGIC (Mock Auth)
    if (allowMockAuth && devUserId) {
      const uid = String(devUserId).trim();
      const devRolesHeader = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];
      const devEmailHeader = req.headers['x-dev-email'] || req.headers['X-Dev-Email'];
      let rolesArr = [];
      if (typeof devRolesHeader === 'string' && devRolesHeader.trim()) {
        rolesArr = devRolesHeader
          .split(',')
          .map((r) => String(r || '').trim())
          .filter(Boolean)
          .map((r) => r.replace(/\s+/g, '_').toUpperCase());
      }
      if (rolesArr.length === 0) {
        rolesArr = ['BUDGET_PREPARER', 'DEVELOPER'];
      }
      const devName = `Dev User (${uid})`;
      
      req.user = {
        id: uid,
        userId: uid,
        Roles: rolesArr,
        particular: devName,
        userName: devName, // tugma sa AuditLog schema
        particularID: uid,
        email: devEmailHeader ? String(devEmailHeader).trim() : null,
        isDev: true
      };

      try {
        await syncUserEmailFromRequest(req);
      } catch (_syncError) {
        // silent sync only
      }
      
      if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });

      // LOG TO DATABASE (Background)
      AuditLog.create({
        userId: uid,
        userName: devName,
        userRoles: rolesArr,
        action: "DEV_MOCK_AUTH",
        resource: "SYSTEM_ACCESS",
        method: req.method,
        ipAddress: req.clientIp,
        userAgent: req.headers['user-agent'],
        details: { mode: 'development_mock', autoAdmin: true }
      }).catch(e => console.error("AuditLog Error:", e.message));

      return requireBudgetRole(req, res, next);
    }

    // 2. JWT LOGIC (In case Dev uses actual tokens)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = 
      req.cookies?.jwtToken || 
      req.cookies?.authToken || 
      req.cookies?.jwt || 
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. Token or Dev Header required." });
    }

    // Try multiple secrets (Flexible for Dev environments)
    let payload = null;
    const secrets = [
      process.env.JWT_CLIENT_SECRET_PROD,
      process.env.JWT_SECRET_KEY,
      process.env.JWT_SECRET
    ].filter(Boolean);

    for (const secret of secrets) {
      try {
        payload = jwt.verify(jwtToken, secret, { algorithms: ['HS256'] });
        if (payload) break;
      } catch (err) { /* silent try */ }
    }

    if (payload) {
      // Expose token to auth_controller.getUser so client can use it for socket auth
      req.authToken = jwtToken;
    }

    if (!payload) {
      AuditLog.create({
        userId: "ANONYMOUS_DEV",
        userName: "UNKNOWN",
        action: "AUTH_FAILED",
        resource: "AUTHENTICATION",
        ipAddress: req.clientIp,
        status: 401
      }).catch(() => {});
      return res.status(401).json({ error: "Invalid token" });
    }

    // Identity Extraction
    // payload.Username (capital U, array) = NIA API via budget login
    // payload.username (lowercase, string) = FMIS-MAIN login JWT format
    let userId = String(
      payload.userId ||
      payload.id ||
      (Array.isArray(payload.Username) && payload.Username[0]) ||
      payload.username ||
      ''
    );
    let roles = payload.roles || payload.Roles || [];
    if (!Array.isArray(roles)) roles = [roles];
    roles = roles.map(r => typeof r === 'string' ? r.replace(/\s+/g, '_').toUpperCase() : r);

    // FMIS-MAIN JWT: has accessToken, no embedded roles → resolve full user from NIA API
    if (payload.accessToken) {
      let resolvedUser = null;
      try {
        const niaApiUrl = process.env.ACCOUNT_USER_API_URL;
        if (niaApiUrl) {
          const niaRes = await fetch(niaApiUrl, {
            headers: { Authorization: `Bearer ${payload.accessToken}` },
          });
          if (niaRes.ok) {
            const niaUser = await niaRes.json();
            const middleInitial = niaUser.MiddleName ? `${niaUser.MiddleName.charAt(0)}.` : '';
            const particular = `${niaUser.FirstName ?? ''} ${middleInitial} ${niaUser.LastName ?? ''} ${niaUser.Suffix ?? ''}`.replace(/\s+/g, ' ').trim();
            const particularID = (niaUser.Username?.[0] ?? userId).toUpperCase();

            // Look up roles from fmis_main DB using raw collection (no model registration needed)
            let dbRoles = [];
            if (mainConnection?.readyState === 1) {
              try {
                const arDoc = await mainConnection.db.collection('assigned_roles').findOne({ user: particularID });
                if (arDoc?.roles?.length > 0) {
                  const roleDocs = await mainConnection.db.collection('roles').find({ _id: { $in: arDoc.roles } }).toArray();
                  dbRoles = roleDocs.map(r => String(r.name || '').replace(/\s+/g, '_').toUpperCase());
                }
              } catch (dbErr) {
                console.warn('[check_token_dev] fmis_main role lookup failed:', dbErr.message);
              }
            }

            resolvedUser = {
              ...niaUser,
              id: particularID,
              userId: particularID,
              particular,
              particularID,
              Roles: dbRoles,
              userName: particular,
            };
          }
        }
      } catch (niaErr) {
        console.warn('[check_token_dev] NIA API fetch failed:', niaErr.message);
      }

      // Fallback: minimal user from payload (dev only — avoids 401 if NIA API is down)
      if (!resolvedUser) {
        const particularID = String(payload.username || userId).toUpperCase();
        resolvedUser = {
          id: particularID,
          userId: particularID,
          particularID,
          particular: particularID,
          userName: particularID,
          Roles: ['SUPER_ADMIN'],
        };
      }

      req.user = resolvedUser;
      try { await syncUserEmailFromRequest(req); } catch (_) {}
      if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });
      return requireBudgetRole(req, res, next);
    }

    // Non-FMIS-MAIN JWT: fallback DB role lookup for budget-native tokens
    if (roles.length === 0 && mainConnection?.readyState === 1) {
      try {
        const arDoc = await mainConnection.db.collection('assigned_roles').findOne({ user: userId });
        if (arDoc?.roles?.length > 0) {
          const roleDocs = await mainConnection.db.collection('roles').find({ _id: { $in: arDoc.roles } }).toArray();
          roles = roleDocs.map(r => String(r.name || '').replace(/\s+/g, '_').toUpperCase());
        }
      } catch (e) { /* silent */ }
    }

    const userName = `${payload.FirstName || ''} ${payload.LastName || ''}`.trim() || userId;

    req.user = {
      ...payload,
      id: userId,
      userId: userId,
      Roles: roles,
      particular: userName,
      userName: userName,
      particularID: userId,
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

    if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });

    // SUCCESS LOG
    AuditLog.create({
      userId: userId,
      userName: userName,
      userRoles: roles,
      action: "AUTH_SUCCESS_DEV",
      resource: "AUTHENTICATION",
      method: req.method,
      ipAddress: req.clientIp
    }).catch(() => {});

    return requireBudgetRole(req, res, next);

  } catch (e) {
    console.error("Dev Auth Exception:", e.message);
    AuditLog.create({
      userId: "SYSTEM",
      userName: "DEV_ERROR",
      action: "AUTH_EXCEPTION",
      resource: "AUTHENTICATION",
      ipAddress: req.clientIp,
      details: { error: e.message }
    }).catch(() => {});

    return res.status(401).json({ error: "Access denied." });
  }
};