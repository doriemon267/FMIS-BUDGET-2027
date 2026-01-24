const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    const jwtToken = req.cookies?.jwt;

    if (!jwtToken)
      return res.json({ error: "Access denied. No access_token provided." });

    if (!jwt.verify(jwtToken, process.env.JWT_CLIENT_SECRET_PROD))
      return res.status(401).json({ error: "Invalid token" });

    const userPayload = jwt.verify(
      jwtToken,
      process.env.JWT_CLIENT_SECRET_PROD
    );

    const particular = `${userPayload.FirstName ?? ""} ${
      userPayload.LastName ?? ""
    }`.trim();
    const particularID = userPayload.UserName;

    req.user = {
      ...userPayload,
      particular,
      particularID,
    }; // Attach user to request

    next();
  } catch (e) {
    return res.json({ error: "Access denied" });
  }
};