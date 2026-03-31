const jwt = require("jsonwebtoken");
const assignedRole = require("../models/assigned_role");
const User = require("../models/User");
const { createUserActivityLog } = require("../middleware/userLogs");

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
      await createUserActivityLog(req, {
        action: "LOGIN_FAILED",
        resource: "Auth",
        userId: "anonymous",
        details: { reason: "Invalid credentials" },
      }).catch(() => {});
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
       domain: process.env.COOKIE_DOMAIN || ".fmis.local", 
      path: "/"
    };
    if (process.env.COOKIE_DOMAIN) cookieOpts.domain = process.env.COOKIE_DOMAIN;
    res.cookie("jwtToken", jwtToken, cookieOpts);

    await createUserActivityLog(req, {
      action: "LOGIN_SUCCESS",
      resource: "Auth",
      userId: username || "unknown",
      details: { success: true },
    }).catch(() => {});

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    await createUserActivityLog(req, {
      action: "LOGIN_FAILED",
      resource: "Auth",
      userId: "anonymous",
      details: { reason: "Server error" },
    }).catch(() => {});
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = req.user;

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    const pickEmailFromUsernameArray = (value) => {
      if (!Array.isArray(value)) return null;
      const fromIndexOne = String(value?.[1] || '').trim();
      if (fromIndexOne && isValidEmail(fromIndexOne)) return fromIndexOne;
      const anyEmail = value.map((item) => String(item || '').trim()).find((item) => isValidEmail(item));
      return anyEmail || null;
    };

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
      pickEmailFromUsernameArray(user.Username) ??
      pickEmailFromUsernameArray(user.username) ??
      user.mail ??
      null;

    const userResponse = {
      ...user,
      Roles: roles,
      email: niaEmail,
    };

    // Sync NIA Email to User collection so workflow notifications use user.Email (NIA) instead of HUA email
    // and also keep HierarchicalUserAssignment email in sync whenever the user logs in.
    if (niaEmail) {
      try {
        // Collect all possible identifiers that might have been used as userId
        const candidateIds = [];
        const pushIf = (v) => {
          if (v !== undefined && v !== null && String(v).trim() !== "") {
            candidateIds.push(String(v).trim());
          }
        };

        pushIf(user.particularID);
        pushIf(user.particularId);
        pushIf(user.Id);
        pushIf(user.id);
        pushIf(user.userId);
        pushIf(
          Array.isArray(user.Username) && user.Username.length > 0
            ? user.Username[0]
            : user.Username
        );
        pushIf(user.username);

        if (candidateIds.length > 0) {
          // Build both string and numeric variants to handle schemas
          // where userId may be stored as Number instead of String.
          const stringIds = Array.from(
            new Set(candidateIds.map((v) => String(v)))
          );
          const numericIds = Array.from(
            new Set(
              stringIds
                .map((v) => {
                  const n = Number(v);
                  return Number.isNaN(n) ? null : n;
                })
                .filter((v) => v !== null)
            )
          );
          const allIds = [...stringIds, ...numericIds];

          // Update main User collection (any document whose userId matches one of the candidate IDs)
          await User.updateMany(
            { userId: { $in: allIds } },
            { $set: { email: niaEmail } }
          );

          // Also update any existing hierarchical assignment record(s) for this user
          try {
            const HierarchicalUserAssignment = require("../models/HierarchicalUserAssignment");
            await HierarchicalUserAssignment.updateMany(
              { userId: { $in: allIds } },
              { $set: { email: niaEmail } }
            );
          } catch (huaErr) {
            if (process.env.DEBUG_LOGS === "true") {
              console.debug(
                "[AUTH][GET-USER] HierarchicalUserAssignment email sync skip:",
                huaErr?.message
              );
            }
          }
        }
      } catch (e) {
        if (process.env.DEBUG_LOGS === "true") {
          console.debug("[AUTH][GET-USER] User email sync skip:", e?.message);
        }
      }
    }

    console.log("[AUTH][GET-USER] Sending user response payload (safe fields only).");

    // Include token so client can send it to budget API when auth and budget are different origins
    const out = { user: userResponse };
    if (req.authToken) out.token = req.authToken;
    res.json(out);
  } catch (e) {
    console.error("[AUTH][GET-USER] Error while resolving user:", e);
    res.status(500).json({ error: "Server error" });
  }
};

exports.logout = async (req, res) => {
  const userId = req?.user?.id ?? req?.user?.userId ?? req?.user?.Id ?? req?.user?.Username?.[0] ?? "anonymous";

  await createUserActivityLog(req, {
    action: "LOGOUT",
    resource: "Auth",
    userId: String(userId),
    details: { success: true },
  }).catch(() => {});

  const clearOpts = { httpOnly: true, secure: true, sameSite: "None" };
  if (process.env.COOKIE_DOMAIN) clearOpts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie("jwtToken", clearOpts);

  res.status(200).json({ message: "Logged out successfully" });
};