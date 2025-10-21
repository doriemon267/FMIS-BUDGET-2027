const jwt = require("jsonwebtoken");
const { resolveUserIdentity, getClientIp } = require("../utils/requestContext");
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
    // Capture client IP early for downstream logging
    req.clientIp = getClientIp(req);
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
      
      // Allow dev header to override identity in development mode
      const devUserId = req.headers['x-dev-user-id'] || req.headers['X-Dev-User-Id'];
      if (devUserId) {
        userId = String(devUserId).trim();
      } else if (!userId) {
        // If still no user ID found in JWT, fail with guidance
        console.error('❌ Unable to determine user identity from JWT or headers');
        console.error('JWT Payload:', JSON.stringify(payload, null, 2));
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
      
      // Normalize roles - replace spaces with underscores for consistency
      if (userRoles && Array.isArray(userRoles)) {
        userRoles = userRoles.map(role => 
          typeof role === 'string' ? role.replace(/\s+/g, '_').toUpperCase() : role
        );
      } else if (typeof userRoles === 'string') {
        userRoles = [userRoles.replace(/\s+/g, '_').toUpperCase()];
      }
      
      // Role normalization completed silently
      if (!userRoles || userRoles.length === 0) {
        console.error('❌ No user roles found in JWT or headers');
        return res.status(401).json({ error: "Authentication required: No user roles found" });
      }
      
      // Enrich req.user with multiple identifier mirrors for downstream matching
      const usernameArr = Array.isArray(payload.Username) ? payload.Username : (payload.Username ? [payload.Username] : []);
      req.user = {
        id: userId,
        userId: userId,
        UserId: userId,
        username: payload.username || userId,
        Username: usernameArr.length ? usernameArr : [userId],
        userCode: payload.userCode,
        UserCode: payload.UserCode,
        employeeCode: payload.employeeCode,
        email: payload.email,
        Roles: userRoles,
        name: payload.name || payload.username || String(userId)
      };
      const identity = await resolveUserIdentity({ req });
      req.identity = identity;
      if (req.user) {
        if (identity.userId && identity.userId !== req.user.userId) {
          req.user.userId = identity.userId;
          req.user.id = identity.userId;
        }
        if (identity.displayName) {
          req.user.displayName = identity.displayName;
          req.user.fullName = identity.displayName;
          req.user.name = identity.displayName;
        }
        if (identity.email && !req.user.email) {
          req.user.email = identity.email;
        }
        req.user.identitySource = identity.source;
      }
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
    const identity = await resolveUserIdentity({ req });
    req.identity = identity;
    if (req.user) {
      if (identity.userId) {
        req.user.userId = identity.userId;
        req.user.id = identity.userId;
      }
      if (identity.displayName) {
        req.user.displayName = identity.displayName;
        req.user.fullName = identity.displayName;
        req.user.name = identity.displayName;
      }
      if (identity.email && !req.user.email) {
        req.user.email = identity.email;
      }
      req.user.identitySource = identity.source;
    }
    next();
  } catch (error) {
    console.error("❌ Auth Middleware Error:", error.message);
    return res.status(401).json({ error: "Access denied" });
  }
};
