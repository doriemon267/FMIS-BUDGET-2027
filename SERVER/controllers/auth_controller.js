const jwt = require("jsonwebtoken");
const assignedRole = require("../models/AssignedRole");

exports.login = async (req, res) => {
  const { username, password, rememberMe } = req.body;

  try {
    const tokenApi = process.env.ACCOUNT_TOKEN_API_URL;
    const clientId = process.env.CLIENT_ID;
    const ownerId = process.env.OWNER_ID;
    const encodedCredentials = Buffer.from(`${clientId}:${ownerId}`).toString(
      "base64",
    );

    // Fetch access token from API
    const credentials = await (
      await fetch(tokenApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encodedCredentials}`,
        },
        body: new URLSearchParams({
          grant_type: "password",
          username,
          password,
        }),
      })
    ).json();

    if (!credentials.access_token) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const expiresIn = credentials.expires_in;
    const tokenExpiration = expiresIn * (rememberMe ? 2 : 1); // seconds
    const cookieExpiration = tokenExpiration * 1000; // ms

    const jwtToken = jwt.sign(
      { accessToken: credentials.access_token, username },
      process.env.JWT_CLIENT_SECRET_PROD,
      { expiresIn: tokenExpiration },
    );

    res.cookie("jwtToken", jwtToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: cookieExpiration,
    });

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = req.user;

    // Fetch assigned roles
    let roles = [];
    const assignedRoles = await assignedRole
      .findOne({ user: user.particularID })
      .populate({ path: "roles", select: "name" });

    if (assignedRoles) {
      roles = assignedRoles.roles.map((role) => role.name);
    }

    user.Roles = roles;

    res.json({ user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("jwtToken", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });

  res.status(200).json({ message: "Logged out successfully" });
};