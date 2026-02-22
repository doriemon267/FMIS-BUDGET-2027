const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { mainConnection } = require('../config/mongo_db');
const { requireBudgetRole } = require('./requireBudgetRole');

module.exports = async (req, res, next) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') return next();

    // Dev-only backdoor for testing with headers (if explicitly enabled or in debug mode)
    const allowMockAuth = process.env.ALLOW_MOCK_AUTH === 'true' || process.env.DEBUG_MODE === 'true';
    const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
    const devRolesHeader = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];

    if (allowMockAuth && devUserId) {
      const uid = String(devUserId).trim();
      const rolesArr = devRolesHeader ? String(devRolesHeader).split(',').map(r => r.trim()).filter(Boolean) : ['DEVELOPER'];
      
      req.user = {
        id: uid,
        userId: uid,
        Id: uid,
        Username: [uid],
        Roles: rolesArr,
        name: uid,
        particular: `Dev User (${uid})`,
        particularID: uid,
      };
      
      const identity = await resolveUserIdentity({ req });
      req.identity = identity;
      req.clientIp = getClientIp(req);
      return requireBudgetRole(req, res, next);
    }

    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = req.cookies?.jwtToken || req.cookies?.authToken || req.cookies?.jwt || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // Try multiple secrets for flexibility
    let payload = null;
    const secrets = [
      process.env.JWT_CLIENT_SECRET_PROD,
      process.env.JWT_SECRET_KEY,
      process.env.JWT_SECRET,
      process.env.SECRET_KEY
    ].filter(Boolean);

    for (const secret of secrets) {
      try {
        payload = jwt.verify(jwtToken, secret);
        if (payload) break;
      } catch (err) {
        // continue
      }
    }

    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Capture client IP
    req.clientIp = getClientIp(req);

    // Development mode user resolution (local JWT or external API)
    let userId = payload.userId || payload.id || payload.sub || (payload.Username && payload.Username[0]);
    
    // If we have an accessToken but no direct user info, try external API
    if (!userId && payload.accessToken && process.env.ACCOUNT_USER_API_URL) {
      try {
        const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
          headers: { Authorization: `Bearer ${payload.accessToken}` },
        });
        if (userRes.ok) {
          const user = await userRes.json();
          userId = user.userId || user.id || user.Username?.[0];
          // Merge API user data if needed
          Object.assign(payload, user);
        }
      } catch (e) {
        console.error("External API fetch failed in dev token:", e.message);
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "User identity not found in token" });
    }

    // Normalize roles
    let roles = payload.roles || payload.Roles || payload.role || [];
    if (!Array.isArray(roles)) roles = [roles];
    roles = roles.map(r => typeof r === 'string' ? r.replace(/\s+/g, '_').toUpperCase() : r);

    // If roles are missing in the token payload, try to fetch from main DB assigned_roles
    if ((!roles || roles.length === 0) && mainConnection && mainConnection.readyState) {
      try {
        const AssignedRole = mainConnection.model('assigned_roles', new mongoose.Schema({}, { strict: false }), 'assigned_roles');
        const Role = mainConnection.model('roles', new mongoose.Schema({}, { strict: false }), 'roles');
        const assigned = await AssignedRole.findOne({ $or: [{ user: userId }, { user: Number(userId) }] }).lean();
        if (assigned && Array.isArray(assigned.roles) && assigned.roles.length > 0) {
          const resolved = [];
          for (const r of assigned.roles) {
            if (r && typeof r === 'string' && r.match(/^[0-9a-fA-F]{24}$/)) {
              const doc = await Role.findById(r).lean();
              if (doc && doc.name) resolved.push(doc.name.replace(/\s+/g, '_').toUpperCase());
            } else if (r && r._bsontype === 'ObjectId') {
              const doc = await Role.findById(r).lean();
              if (doc && doc.name) resolved.push(doc.name.replace(/\s+/g, '_').toUpperCase());
            } else if (typeof r === 'string') {
              resolved.push(r.replace(/\s+/g, '_').toUpperCase());
            } else if (r && typeof r === 'object' && r.name) {
              resolved.push(String(r.name).replace(/\s+/g, '_').toUpperCase());
            }
          }
          if (resolved.length) roles = Array.from(new Set(resolved));
        }
      } catch (e) {
        // ignore db lookup failures in dev token middleware
        if (process.env.DEBUG_LOGS === 'true') console.debug('Assigned roles lookup failed in token middleware:', e?.message || e);
      }
    }

    req.user = {
      ...payload,
      id: userId,
      userId: userId,
      Roles: roles,
      particular: `${payload.FirstName || ''} ${payload.LastName || ''}`.trim() || userId,
      particularID: userId
    };

    const identity = await resolveUserIdentity({ req });
    req.identity = identity;

    return requireBudgetRole(req, res, next);
  } catch (e) {
    console.error("Authentication error in check_token_dev:", e);
    return res.status(401).json({ error: "Access denied due to an error." });
  }
};
