const jwt = require("jsonwebtoken");
const assignedRole = require("../models/assigned_role");
const User = require("../models/User");
const { createUserActivityLog } = require("../middleware/userLogs");

// Per-username brute force lockout (in-memory)
// Tracks failed login attempts per username; lockout after 5 failures within 15 minutes.
const _loginAttempts = new Map(); // username -> { count, firstAttempt, lockedUntil }
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// Throttle SSO resolution logging to avoid log inflation from repeated /get-user calls.
const _ssoResolvedLogCache = new Map(); // userId -> lastTimestampMs
const SSO_RESOLVED_LOG_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function _recordFailedAttempt(username) {
  const now = Date.now();
  const entry = _loginAttempts.get(username) || { count: 0, firstAttempt: now, lockedUntil: 0 };
  // Reset window if it's past the window period
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    entry.count = 0;
    entry.firstAttempt = now;
    entry.lockedUntil = 0;
  }
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  _loginAttempts.set(username, entry);
}

function _isLockedOut(username) {
  const entry = _loginAttempts.get(username);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  return false;
}

function _clearAttempts(username) {
  _loginAttempts.delete(username);
}

function _shouldLogSsoResolved(userId) {
  const key = String(userId || '').trim();
  if (!key) return false;

  const now = Date.now();
  const last = _ssoResolvedLogCache.get(key) || 0;
  if (now - last < SSO_RESOLVED_LOG_WINDOW_MS) {
    return false;
  }

  _ssoResolvedLogCache.set(key, now);
  return true;
}

exports.login = async (req, res) => {
  const { username, password, rememberMe } = req.body;

  // Per-username lockout check
  if (username && _isLockedOut(String(username).toLowerCase())) {
    await createUserActivityLog(req, {
      action: "LOGIN_BLOCKED_LOCKOUT",
      resource: "Auth",
      userId: username,
      details: { reason: "Too many failed attempts" },
    }).catch(() => {});
    return res.status(429).json({
      error: "Account temporarily locked. Too many failed login attempts. Please try again in 15 minutes.",
    });
  }

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
      if (username) _recordFailedAttempt(String(username).toLowerCase());
      await createUserActivityLog(req, {
        action: "LOGIN_FAILED",
        resource: "Auth",
        userId: username || "anonymous",
        details: { reason: "Invalid credentials" },
      }).catch(() => {});
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const expiresIn = credentials.expires_in;
    const tokenExpiration = expiresIn * (rememberMe ? 2 : 1); // seconds
    const cookieExpiration = tokenExpiration * 1000; // ms

    const crypto = require("crypto");
    const sessionId = crypto.randomBytes(16).toString('hex');

    const jwtToken = jwt.sign(
      { accessToken: credentials.access_token, username, sessionId },
      process.env.JWT_CLIENT_SECRET_PROD,
      { expiresIn: tokenExpiration },
    );

    const cookieOpts = {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: cookieExpiration,
      path: "/"
    };
    if (process.env.COOKIE_DOMAIN) cookieOpts.domain = process.env.COOKIE_DOMAIN;
    res.cookie("jwtToken", jwtToken, cookieOpts);

    // Save activeSessionId to database for this user (supports both existing and new users)
    if (username) {
      try {
        const candidateIds = [
          String(username).trim(),
          String(username).trim().toUpperCase(),
          String(username).trim().toLowerCase()
        ];
        
        const updateResult = await User.updateMany(
          { userId: { $in: candidateIds } },
          { $set: { activeSessionId: sessionId } }
        );
        
        if (updateResult.matchedCount === 0) {
          await User.updateOne(
            { userId: String(username).trim() },
            { $set: { activeSessionId: sessionId } },
            { upsert: true }
          );
        }
      } catch (dbErr) {
        console.error("[AUTH] Failed to update activeSessionId in login:", dbErr.message);
      }
    }

    // Clear failed attempts on successful login
    if (username) _clearAttempts(String(username).toLowerCase());

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
      roles = assignedRoles.roles.map((role) => String(role.name || '').replace(/\s+/g, '_').toUpperCase()).filter(Boolean);
    }

    // Fallback: if DB returned no roles, use roles injected by check_token_prod
    // (e.g. SUPER_ADMIN injected for SUPER_ADMIN_IDS whitelisted users)
    if (roles.length === 0 && Array.isArray(req.user?.Roles) && req.user.Roles.length > 0) {
      roles = req.user.Roles;
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

    // Whitelist only the fields the client needs — never spread the full decoded
    // token object, as it contains sensitive fields (BirthDate, Gender,
    // ProfilePicture base64, raw Username array with embedded email, etc.)
    // that must not be exposed in the browser Network tab.
    const resolvedId = user.particularID ?? user.Id ?? user.id ?? user.userId ?? null;
    // Username[0] is the employee/user code; Username[1] is the email — only expose [0]
    const primaryUsername = Array.isArray(user.Username) ? user.Username[0] : (user.Username ?? user.UserName ?? user.userName ?? null);
    const userResponse = {
      id: resolvedId,
      Id: resolvedId,
      userId: resolvedId,
      particularID: resolvedId,
      particularId: resolvedId,
      particular: resolvedId,
      // Single username string (employee code only, no email)
      Username: primaryUsername ? [primaryUsername] : [],
      userName: primaryUsername,
      firstName: user.FirstName ?? null,
      lastName: user.LastName ?? null,
      middleName: user.MiddleName ?? null,
      // Keep PascalCase variants the UI components already reference
      FirstName: user.FirstName ?? null,
      LastName: user.LastName ?? null,
      MiddleName: user.MiddleName ?? null,
      Suffix: user.Suffix ?? null,
      region: user.region ?? user.Region ?? null,
      Region: user.region ?? user.Region ?? null,
      Roles: roles,
      email: niaEmail,
      // Profile picture is needed for the avatar UI — kept but not logged
      ProfilePicture: user.ProfilePicture ?? null,
    };

    const displayName = [
      `${user.FirstName || ''} ${user.LastName || ''}`.trim(),
      user.name,
      user.UserName,
      user.userName,
      primaryUsername,
      resolvedId,
    ].find((value) => value && String(value).trim().length > 0);

    // Record SSO-based auth resolution so auth logs don't appear as logout-only.
    if (_shouldLogSsoResolved(resolvedId)) {
      await createUserActivityLog(req, {
        action: "SSO_LOGIN_RESOLVED",
        resource: "Auth",
        userId: String(resolvedId || primaryUsername || 'unknown'),
        userName: String(displayName || 'unknown'),
        details: {
          source: "get-user",
          via: "sso-session",
          hasRoles: Array.isArray(roles) && roles.length > 0,
        },
      }).catch(() => {});
    }

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

    // Tinanggal na ang pag-attach ng X-Auth-Token header dahil gumagamit na tayo ng HttpOnly cookies.
    res.json({ user: userResponse });
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

  // Clear the active session id from the User collection
  if (req?.user?.userId || req?.user?.id || userId !== "anonymous") {
    try {
      const uid = String(req?.user?.userId || req?.user?.id || userId);
      await User.updateMany(
        { userId: { $in: [uid, uid.toUpperCase(), uid.toLowerCase()] } },
        { $set: { activeSessionId: null } }
      );
    } catch (err) {
      console.error("[AUTH] Logout session clear error:", err.message);
    }
  }

  // In dev (HTTP) the browser rejects Secure+SameSite=None — use Lax instead
  const IS_PRODUCTION = require("../utils/IS_PRODUCTION");
  const clearOpts = IS_PRODUCTION
    ? { httpOnly: true, secure: true, sameSite: "None" }
    : { httpOnly: true, secure: false, sameSite: "Lax" };
  if (process.env.COOKIE_DOMAIN) clearOpts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie("jwtToken", clearOpts);

  res.status(200).json({ message: "Logged out successfully" });
};