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
 * Unified Authentication & Authorization Middleware
 * Supports:
 * - Development mock auth (x-dev-user-id headers)
 * - Development JWT with flexible secret handling
 * - Production JWT with strict secret verification
 * - Role resolution from DB + preserves valid Budget/Admin roles from JWT
 * - SUPER_ADMIN whitelist enforcement (stricter in production)
 */
module.exports = async (req, res, next) => {
  try {
    // 1. Skip CORS preflight
    if (req.method === 'OPTIONS') return next();

    req.clientIp = getClientIp(req);
    const isProduction = process.env.NODE_ENV === 'production' || 
                         (process.env.PRODUCTION_MODE && String(process.env.PRODUCTION_MODE).trim().length > 0);
    
    // 2. DEVELOPMENT MOCK AUTH (Backdoor for dev/testing)
    const allowMockAuth = !isProduction && (process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true');
    const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
    
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
        userName: devName,
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

    // 3. JWT TOKEN EXTRACTION
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = 
      req.cookies?.jwtToken || 
      req.cookies?.authToken || 
      req.cookies?.jwt || 
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // 4. JWT VERIFICATION
    let payload = null;
    
    if (isProduction) {
      // PRODUCTION: Strict secret verification
      const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
      if (!secret) {
        console.error("[CRITICAL] JWT Secret is not configured in .env");
        return res.status(500).json({ error: "Internal server configuration error" });
      }
      
      try {
        payload = jwt.verify(jwtToken, secret, { algorithms: ['HS256'] });
      } catch (err) {
        AuditLog.create({
          userId: "ANONYMOUS",
          userName: "UNKNOWN",
          action: "AUTH_FAILED",
          resource: "AUTHENTICATION",
          ipAddress: req.clientIp,
          status: 401,
          details: { error: err.message }
        }).catch(() => {});
        
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: "Session expired. Please login again.", expired: true });
        }
        return res.status(401).json({ error: "Access denied." });
      }
    } else {
      // DEVELOPMENT: Flexible secret handling (try multiple)
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
    }

    if (!payload) {
      return res.status(401).json({ error: "Invalid token structure" });
    }

    // 5. USER IDENTITY EXTRACTION
    req.authToken = jwtToken;
    
    let userId = String(
      payload.userId ||
      payload.id ||
      payload.username ||
      payload.UserName ||
      (Array.isArray(payload.Username) ? payload.Username[0] : payload.Username) ||
      ''
    );
    
    if (!userId && isProduction) {
      return res.status(401).json({ error: "Access denied. User identity not found in token." });
    }

    // 6. NAME FORMATTING
    const middleInitial = payload.MiddleName ? `${payload.MiddleName.charAt(0)}.` : "";
    const particular = `${payload.FirstName ?? ""} ${middleInitial} ${payload.LastName ?? ""} ${payload.Suffix ?? ""}`
                        .replace(/\s+/g, " ")
                        .trim() || userId;

    // --- SINGLE ACTIVE SESSION CHECK ---
    if (payload.iat) {
      try {
        const User = require("../models/User");
        const userDoc = await User.findOne({ 
          userId: { $in: [userId, userId.toUpperCase(), userId.toLowerCase()] } 
        }).lean();

        if (userDoc && payload.iat < userDoc.lastLoginIat) {
          AuditLog.create({
            userId: userId,
            userName: particular,
            action: "SESSION_KICKED_OUT",
            resource: "AUTHENTICATION",
            ipAddress: req.clientIp,
            details: { 
              reason: "Logged in from another device/browser",
              tokenIat: payload.iat,
              lastLoginIat: userDoc.lastLoginIat
            }
          }).catch(() => {});

          return res.status(401).json({ 
            error: "Your account has been accessed on another device or browser. You will be automatically signed out.", 
            expired: true 
          });
        }

        if (!userDoc || payload.iat > userDoc.lastLoginIat) {
          await User.findOneAndUpdate(
            { userId: userId },
            { 
              userId: userId, 
              lastLoginIat: payload.iat, 
              updatedAt: new Date() 
            },
            { upsert: true, new: true }
          ).catch(err => console.error("[AUTH] User sync error:", err.message));
        }
      } catch (err) {
        console.error("[AUTH] Active session verification error:", err.message);
      }
    }

    // ==========================================
    // 7. ROLE RESOLUTION (PRESERVE TOKENS + DB)
    // ==========================================
    let roles = [];

    // 7.0 PRESERVE TARGET ROLES FROM JWT
    const payloadRolesArr = payload.Roles || payload.roles || [];
    const targetRolesToPreserve = [
        'SUPER_ADMIN', 'SUPERADMIN', 'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER', 
        'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER', 'BUDGET_PLANNING_ANALYST', 
        'BUDGET_OFFICER', 'BUDGET_COORDINATOR', 'BUDGET_ADMIN', 'REVIEWER', 'APPROVER'
    ];

    const preservedRolesFromToken = [];
    if (Array.isArray(payloadRolesArr)) {
        payloadRolesArr.forEach(r => {
            const roleStr = String(r).replace(/\s+/g, '_').toUpperCase();
            if (targetRolesToPreserve.includes(roleStr) && !preservedRolesFromToken.includes(roleStr)) {
                preservedRolesFromToken.push(roleStr);
            }
        });
    }

    // 7a. FMIS-MAIN JWT with accessToken (NIA API integration)
    if (payload.accessToken && !isProduction) {
      let resolvedUser = null;
      try {
        const niaApiUrl = process.env.ACCOUNT_USER_API_URL;
        if (niaApiUrl) {
          const niaRes = await fetch(niaApiUrl, {
            headers: { Authorization: `Bearer ${payload.accessToken}` },
          });
          if (niaRes.ok) {
            const niaUser = await niaRes.json();
            const ni = niaUser.MiddleName ? `${niaUser.MiddleName.charAt(0)}.` : '';
            const part = `${niaUser.FirstName ?? ''} ${ni} ${niaUser.LastName ?? ''} ${niaUser.Suffix ?? ''}`.replace(/\s+/g, ' ').trim();
            const pidFromNia = (niaUser.Username?.[0] ?? userId).toUpperCase();

            let dbRoles = [];
            if (mainConnection?.readyState === 1) {
              try {
                const arDoc = await mainConnection.db.collection('assigned_roles').findOne({ user: pidFromNia });
                if (arDoc?.roles?.length > 0) {
                  const roleDocs = await mainConnection.db.collection('roles').find({ _id: { $in: arDoc.roles } }).toArray();
                  dbRoles = roleDocs.map(r => String(r.name || '').replace(/\s+/g, '_').toUpperCase());
                }
              } catch (dbErr) {
                console.warn('[check_token_unified] fmis_main role lookup failed:', dbErr.message);
              }
            }

            // RE-INJECT PRESERVED ROLES
            preservedRolesFromToken.forEach(preservedRole => {
                if (!dbRoles.includes(preservedRole)) {
                    dbRoles.push(preservedRole);
                }
            });

            resolvedUser = {
              ...niaUser,
              id: pidFromNia,
              userId: pidFromNia,
              particular: part,
              particularID: pidFromNia,
              Roles: dbRoles,
              userName: part,
            };
          }
        }
      } catch (niaErr) {
        console.warn('[check_token_unified] NIA API fetch failed:', niaErr.message);
      }

      if (!resolvedUser) {
        const particularID = String(payload.username || userId).toUpperCase();
        resolvedUser = {
          id: particularID,
          userId: particularID,
          particularID,
          particular: particularID,
          userName: particularID,
          Roles: preservedRolesFromToken.length > 0 ? preservedRolesFromToken : ['SUPER_ADMIN'], 
        };
      }

      req.user = resolvedUser;
      try { await syncUserEmailFromRequest(req); } catch (_) {}
      if (resolveUserIdentity) req.identity = await resolveUserIdentity({ req });
      return requireBudgetRole(req, res, next);
    }

    // 7b. Standard DB role lookup
    if (roles.length === 0 && mainConnection?.readyState === 1) {
      try {
        if (isProduction) {
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
        } else {
          const arDoc = await mainConnection.db.collection('assigned_roles').findOne({ user: userId });
          if (arDoc?.roles?.length > 0) {
            const roleDocs = await mainConnection.db.collection('roles').find({ _id: { $in: arDoc.roles } }).toArray();
            roles = roleDocs.map(r => String(r.name || '').replace(/\s+/g, '_').toUpperCase());
          }
        }
      } catch (dbError) {
        console.error("Role DB Lookup Error:", dbError.message);
      }
    }

    // RE-INJECT PRESERVED ROLES (Kung may nahila man sa DB o wala, isasama ito)
    preservedRolesFromToken.forEach(preservedRole => {
        const hasRole = roles.some(r => {
            const roleStr = String(r).replace(/\s+/g, '_').toUpperCase();
            return roleStr === preservedRole;
        });
        if (!hasRole) {
            roles.push(preservedRole);
        }
    });

    // 8. NORMALIZE ROLES
    const normalizedRoles = roles.map(r => String(r).replace(/\s+/g, '_').toUpperCase());

    // 9. SUPER_ADMIN WHITELIST (stricter in production)
    const allowedSuperIds = process.env.SUPER_ADMIN_IDS
      ? process.env.SUPER_ADMIN_IDS.split(',').map((id) => id.trim())
      : [];
    const isSuper = normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('SUPERADMIN');
    const whitelistedSuper = isSuper && allowedSuperIds.includes(userId);
    const hasOtherBudgetRole = normalizedRoles.some((r) => {
      const n = String(r || '').trim();
      return n !== 'SUPER_ADMIN' && n !== 'SUPERADMIN' && [
        'BUDGET_MANAGER', 'OVERALL_BUDGET_APPROVER', 'BUDGET_PREPARER', 'BUDGET_REVIEWER', 'BUDGET_APPROVER',
        'BUDGET_PLANNING_ANALYST', 'BUDGET_OFFICER', 'BUDGET_COORDINATOR', 'BUDGET_ADMIN', 'REVIEWER', 'APPROVER'
      ].includes(n);
    });

    // In development mode: Allow if user has valid budget role regardless of SUPER_ADMIN_IDS
    if (!isProduction && hasOtherBudgetRole) {
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
      // Enforce strict SUPER_ADMIN_IDS whitelist
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

    // 10. ATTACH CLEANED USER OBJECT
    req.user = {
      ...payload,
      id: userId,
      userId: userId,
      Roles: normalizedRoles,
      particular: particular,
      particularID: userId,
      userName: particular,
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

    // 11. SUCCESS AUDIT LOG
    AuditLog.create({
      userId: userId,
      userName: particular,
      userRoles: normalizedRoles,
      action: isProduction ? "LOGIN_SUCCESS" : "AUTH_SUCCESS_DEV",
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
    // 12. ERROR LOGGING
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