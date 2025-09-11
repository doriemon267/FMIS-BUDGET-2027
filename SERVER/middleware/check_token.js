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
      // Commented out to reduce console noise during development
      // // // For development/testing, you can set a mock user
      req.user = {
        id: payload.userId || "test-user-id",
        name: payload.name || "Test Budget Admin",
        email: payload.email || "budgetadmin@example.com",
        Roles: payload.roles || ["BUDGET ADMIN"] // Changed from USER to BUDGET ADMIN for testing
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
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ error: "Access denied" });
  }
};