/**
 * Optional token middleware - loads user from JWT if present, but never rejects.
 * Use for routes that benefit from knowing the user (e.g. logout audit) but don't require auth.
 */
const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    const jwtToken = req.cookies?.jwtToken || req.cookies?.authToken || req.cookies?.jwt
      || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1] : null);

    if (!jwtToken) return next();

    const secrets = [
      process.env.JWT_CLIENT_SECRET_PROD,
      process.env.JWT_SECRET_KEY,
      process.env.JWT_SECRET,
      process.env.SECRET_KEY
    ].filter(Boolean);

    let payload = null;
    for (const secret of secrets) {
      try {
        payload = jwt.verify(jwtToken, secret);
        if (payload) break;
      } catch (_) { /* continue */ }
    }

    if (payload) {
      const userId = payload.userId || payload.id || payload.sub
        || (payload.Username && payload.Username[0]) || payload.username;
      if (userId) {
        req.user = {
          id: userId,
          userId,
          Username: payload.Username || [payload.username],
          name: payload.name || payload.username,
        };
      }
    }
  } catch (_) { /* ignore */ }
  next();
};
