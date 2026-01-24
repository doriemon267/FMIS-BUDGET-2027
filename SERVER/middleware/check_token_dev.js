const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    const jwtToken = req.cookies?.jwtToken;

    if (!jwtToken)
      return res.json({ error: "Access denied. No access_token provided." });

    if (!jwt.verify(jwtToken, process.env.JWT_CLIENT_SECRET_PROD))
      return res.status(401).json({ error: "Invalid token" });

    const payload = jwt.verify(jwtToken, process.env.JWT_CLIENT_SECRET_PROD);

    // Extract access token (if needed)
    const accessToken = payload.accessToken;

    // Fetch user data from external API
    const userRes = await fetch(process.env.ACCOUNT_USER_API_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await userRes.json();

    const particular = `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim();
    const particularID = user.Username?.[0]?.toUpperCase() ?? "";

    req.user = {
      ...user,
      particular,
      particularID,
    }; // Attach user to request

    next();
  } catch (e) {
    return res.json({ error: "Access denied" });
  }
};