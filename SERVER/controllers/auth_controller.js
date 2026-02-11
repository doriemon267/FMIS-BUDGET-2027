const jwt = require("jsonwebtoken");
const assignedRole = require("../models/assigned_role");
const User = require("../models/User");

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

    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: cookieExpiration,
    };
    if (process.env.COOKIE_DOMAIN) cookieOpts.domain = process.env.COOKIE_DOMAIN;
    res.cookie("jwtToken", jwtToken, cookieOpts);

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = req.user;

    console.log("[AUTH][GET-USER] Incoming user from token middleware:", {
      id: user?.particularID ?? user?.id ?? user?._id ?? null,
      username: user?.username ?? user?.UserName ?? null,
      region: user?.region ?? user?.Region ?? null,
    });

    // Fetch assigned roles
    let roles = [];
    const assignedRoles = await assignedRole
      .findOne({ user: user.particularID })
      .populate({ path: "roles", select: "name" });

    if (!assignedRoles) {
      console.log("[AUTH][GET-USER] No assigned roles found for user", {
        userParticularID: user?.particularID,
      });
    }

    if (assignedRoles) {
      roles = assignedRoles.roles.map((role) => role.name);
    }

    console.log("[AUTH][GET-USER] Resolved roles for user:", roles);

    const niaEmail =
      user.email ??
      user.userEmail ??
      user.Email ??
      user.UserEmail ??
      user.mail ??
      null;

    const userResponse = {
      ...user,
      Roles: roles,
      email: niaEmail,
    };

    // Sync NIA Email to User collection so workflow notifications use user.Email (NIA) instead of HUA email
    if (niaEmail && user.particularID) {
      try {
        await User.findOneAndUpdate(
          { userId: String(user.particularID) },
          { $set: { email: niaEmail } }
        );
      } catch (e) {
        if (process.env.DEBUG_LOGS === "true") {
          console.debug("[AUTH][GET-USER] User email sync skip:", e?.message);
        }
      }
    }

    console.log("[AUTH][GET-USER] Sending user response payload (safe fields only).");

    res.json({ user: userResponse });
  } catch (e) {
    console.error("[AUTH][GET-USER] Error while resolving user:", e);
    res.status(500).json({ error: "Server error" });
  }
};

exports.logout = (req, res) => {
  const clearOpts = { httpOnly: true, secure: true, sameSite: "None" };
  if (process.env.COOKIE_DOMAIN) clearOpts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie("jwtToken", clearOpts);

  res.status(200).json({ message: "Logged out successfully" });
};