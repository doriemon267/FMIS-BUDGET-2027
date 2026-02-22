const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
const { mainConnection } = require('../config/mongo_db');
const { requireBudgetRole } = require('./requireBudgetRole');

module.exports = async (req, res, next) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') return next();

    const authHeader = req.headers.authorization || req.headers.Authorization;
    const jwtToken = req.cookies?.jwtToken || req.cookies?.authToken || req.cookies?.jwt || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!jwtToken) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // Verify token using production secret
    const secret = process.env.JWT_CLIENT_SECRET_PROD || process.env.JWT_SECRET_KEY;
    if (!secret) {
       console.error("Production JWT secret not configured");
       return res.status(500).json({ error: "Server configuration error" });
    }

    const payload = jwt.verify(jwtToken, secret);
    if (!payload) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Capture client IP
    req.clientIp = getClientIp(req);

    const accessToken = payload.accessToken;
    let user = null;

    // Fetch user data from external API if configured
    if (accessToken && process.env.ACCOUNT_USER_API_URL) {
      const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        user = await userRes.json();
      }
    }

    // Fallback to payload data if API call failed or wasn't configured
    const userData = user || payload;
    const userId = userData.userId || userData.id || userData.UserName || (userData.Username && userData.Username[0]);

    if (!userId) {
      return res.status(401).json({ error: "Access denied. User identity not found." });
    }

    // Normalize roles
    let roles = userData.roles || userData.Roles || userData.role || [];
    if (!Array.isArray(roles)) roles = [roles];
    roles = roles.map(r => typeof r === 'string' ? r.replace(/\s+/g, '_').toUpperCase() : r);

    // If roles missing, try to fetch from main DB assigned_roles collection
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
        if (process.env.DEBUG_LOGS === 'true') console.debug('Assigned roles lookup failed in token middleware:', e?.message || e);
      }
    }

    // Normalize email from API (pwedeng iba-ibang field name: email, Email, userEmail, UserEmail, etc.)
    let email = userData.email ?? userData.Email ?? userData.userEmail ?? userData.UserEmail ?? userData.mail ?? null;

    // Kung walang hiwalay na email pero ang userId ay "909549mund.m.edra@gmail.com", kunin ang email part para sa UI
    if (!email && typeof userId === 'string' && userId.includes('@')) {
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const match = userId.match(emailRegex);
      if (match) email = match[1];
    }

    req.user = {
      ...userData,
      id: userId,
      userId: userId,
      Roles: roles,
      particular: `${userData.FirstName || ''} ${userData.LastName || ''}`.trim() || userId,
      particularID: userId,
      email: email
    };

    const identity = await resolveUserIdentity({ req });
    req.identity = identity;

    return requireBudgetRole(req, res, next);
  } catch (error) {
    console.error("Authentication error in check_token_prod:", error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired", expired: true });
    }
    return res.status(401).json({ error: "Access denied" });
  }
};
