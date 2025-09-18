const jwt = require("jsonwebtoken");
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
      // DEVELOPMENT MODE: Extract user info from JWT payload (using actual logged-in user data)
      // Payload logging removed for cleaner output
      
      // For development mode, we'll use the actual logged in user's information
      // The JWT might not contain userId directly, so we need to handle this case
      let userId = null;
      
      // First try to extract from various JWT fields
      if (payload.Username && Array.isArray(payload.Username) && payload.Username[0]) {
        userId = payload.Username[0];
      } else if (typeof payload.Username === 'string' && payload.Username) {
        userId = payload.Username;
      } else if (payload.userId) {
        userId = payload.userId;
      } else if (payload.Id) {
        userId = String(payload.Id);
      } else if (payload.id) {
        userId = payload.id;
      } else if (payload.sub) {
        userId = payload.sub;
      } else if (payload.user_id) {
        userId = payload.user_id;
      } else if (payload.username) {
        userId = payload.username;
      }
      
      // If no user ID found in JWT, check for dev headers from frontend (always allowed in dev mode)
      if (!userId) {
        // The frontend sends X-Dev-User-Id header for development authentication
        const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
        if (devUserId) {
          userId = String(devUserId).trim();
        }
      }
      
      if (!userId) {
        console.error('❌ Unable to determine user identity from JWT or headers');
        console.error('Available headers:', Object.keys(req.headers));
        return res.status(401).json({ error: "Authentication required: Unable to identify user" });
      }
      
      // User authenticated successfully
      // Extract roles from dev headers if available  
      const devRoles = req.headers['x-dev-roles'] || req.headers['X-Dev-Roles'];
      let userRoles = payload.roles || payload.role;
      if (devRoles) {
        userRoles = devRoles.split(',').map(r => r.trim()).filter(Boolean);
      }
      
      // Reject if no roles found - no fallback roles allowed
      if (!userRoles || userRoles.length === 0) {
        console.error('❌ No user roles found in JWT or headers');
        return res.status(401).json({ error: "Authentication required: No user roles found" });
      }
      
      req.user = {
        id: userId,
        name: payload.name || payload.username,
        email: payload.email,
        Roles: userRoles,
        Username: payload.Username || []
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
    console.error("❌ Auth Middleware Error:", error.message);
    return res.status(401).json({ error: "Access denied" });
  }
};
