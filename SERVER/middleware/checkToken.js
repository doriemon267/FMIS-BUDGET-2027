const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
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
      // DEVELOPMENT MODE: Allow overriding user via headers; otherwise extract from JWT
      // 1) Dev override via headers
      const devUserIdHeader = req.headers['x-dev-user-id'];
      const devRolesHeader = req.headers['x-dev-roles'];
      if (devUserIdHeader) {
        const userId = String(devUserIdHeader).trim();
        let roles = [];
        if (devRolesHeader) {
          roles = String(devRolesHeader)
            .split(',')
            .map(r => r.trim())
            .filter(Boolean);
        }
        if (!roles.length) {
          roles = payload.roles || payload.role || ["BUDGET MANAGER"];
        }
        req.user = {
          id: userId,
          name: payload.name || payload.username || `Dev User ${userId}`,
          email: payload.email || `${userId}@example.com`,
          Roles: roles,
          Username: payload.Username || []
        };
        return next();
      }

      // 2) Extract from JWT payload
      // Robust extraction: try Username[0] if available, fallback to other fields
      let userId = null;
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
      // If no user ID found in JWT, use a default user ID for development, but warn
      if (!userId) {
        console.warn('⚠️ No userId found in JWT payload. Falling back to default dev user.');
        userId = "909549"; // Default test user ID for development
      }

      req.user = {
        id: userId,
        name: payload.name || payload.username || `Test Budget Admin`,
        email: payload.email || `${userId}@example.com`,
        Roles: payload.roles || payload.role || ["BUDGET MANAGER"],
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
