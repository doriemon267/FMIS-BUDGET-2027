const jwt = require("jsonwebtoken");
const DEBUG = process.env.DEBUG_LOGS === 'true';
module.exports = async (req, res, next) => {
  try {
    // Allow CORS preflight to pass through
    if (req.method === 'OPTIONS') return next();

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(403).json({ error: "Access denied." });
    }
    const jwtToken = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"
    // Verify token
    const payload = jwt.verify(jwtToken, process.env.JWT_SECRET_KEY);
    if (!payload) {
      return res.status(401).json({ error: "Access denied." });
    }
    // Extract access token (if needed)
    const accessToken = payload.accessToken;
    // Check if ACCOUNT_USER_API_URL is defined
    if (!process.env.ACCOUNT_USER_API_URL) {
      // For development/testing, set a mock user derived from payload
      // Extract user ID from JWT payload, no fallbacks allowed
      const userId = payload.userId || payload.id || payload.sub;
      if (!userId) {
        return res.status(401).json({ error: "Invalid token: No user identification found" });
      }
      
      req.user = {
        id: userId,
        name: payload.name || payload.username || `User ${userId}`,
        email: payload.email || `${userId}@gov.ph`,
        Roles: payload.roles || payload.role || ["SUPER ADMIN"]
      };
      return next();
    }
    // Fetch user data from external API
    const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return res.status(403).json({ error: "Access denied" });
    }
    const user = await userRes.json();
    req.user = user; // Attach user to request
    next();
  } catch (error) {
    console.warn(`[AuthMiddleware] ${error.name} - ${error.message} - path: ${req.path}`);
    if (DEBUG) {
      console.error("Auth Middleware details:", {
        name: error.name,
        message: error.message,
        path: req.path,
        method: req.method,
        hasAuthHeader: !!req.headers.authorization
      });
    }
    return res.status(401).json({ 
      error: "Access denied",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
