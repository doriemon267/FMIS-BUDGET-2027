const jwt = require("jsonwebtoken");
const cookie = require("cookie"); // Requires the 'cookie' package
const { resolveUserIdentity } = require("../utils/requestContext");

function registerSocketAuth(io, { debugMode = false } = {}) {
  io.use(async (socket, next) => {
    try {
      const normalizeSocketId = (value) => {
        if (value === undefined || value === null) return "";
        return String(value).trim();
      };

      const pickSocketUserId = (...values) => {
        for (const value of values) {
          if (Array.isArray(value)) {
            for (const nested of value) {
              const normalizedNested = normalizeSocketId(nested);
              if (normalizedNested) return normalizedNested;
            }
            continue;
          }
          const normalized = normalizeSocketId(value);
          if (normalized) return normalized;
        }
        return "";
      };

      // 1. Parse cookies from headers as a fallback or primary source for HttpOnly cookie sessions
      let parsedCookies = {};
      try {
        parsedCookies = cookie.parse(socket.handshake.headers.cookie || "");
      } catch (e) {
        // ignore parse errors
      }

      const authHeader =
        socket.handshake.headers.authorization || socket.handshake.headers.Authorization;
      
      // 2. Extract token from Auth object, Bearer Header, Query, OR Cookie (token / authToken / jwt)
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice("Bearer ".length)
          : null) ||
        socket.handshake.query?.token ||
        parsedCookies.token ||
        parsedCookies.authToken ||
        parsedCookies.jwt ||
        null;

      const userIdAuth = pickSocketUserId(
        socket.handshake.auth?.userId,
        socket.handshake.auth?.userid,
        socket.handshake.auth?.id,
        socket.handshake.auth?.Username,
        socket.handshake.auth?.UserName,
        socket.handshake.headers["x-dev-user-id"],
        socket.handshake.headers["X-Dev-User-Id"]
      );

      const allowMockAuth = debugMode || process.env.ALLOW_MOCK_AUTH === "true";

      if (!token) {
        if (allowMockAuth && userIdAuth) {
          const rolesHeader =
            socket.handshake.headers["x-dev-roles"] ||
            socket.handshake.headers["X-Dev-Roles"] ||
            "SUPER_ADMIN";
          const devRoles = String(rolesHeader)
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean)
            .map((r) => r.replace(/\s+/g, "_").toUpperCase());

          const user = {
            Id: String(userIdAuth),
            id: String(userIdAuth),
            userId: String(userIdAuth),
            Username: [String(userIdAuth)],
            Roles: devRoles,
            name: String(userIdAuth),
          };

          const identity = await resolveUserIdentity({
            user,
            headers: socket.handshake.headers,
          });

          socket.user = user;
          socket.identity = identity;
          return next();
        }

        console.warn(
          "[SocketAuth] No token in handshake and no devUserId available, refusing connection"
        );
        return next(new Error("Authentication error: token missing"));
      }

      const jwtSecrets = [
        process.env.JWT_SECRET_KEY,
        process.env.JWT_CLIENT_SECRET_PROD,
        process.env.JWT_SECRET,
      ].filter(Boolean);

      let payload = null;
      for (const secret of jwtSecrets) {
        try {
          payload = jwt.verify(token, secret);
          break;
        } catch (_) {
          // try next secret
        }
      }

      if (!payload) {
        return next(new Error("Authentication error: token invalid"));
      }

      let userId = pickSocketUserId(
        payload.Username,
        payload.UserName,
        payload.userId,
        payload.userid,
        payload.particularID,
        payload.particularId,
        payload.Id,
        payload.id,
        payload.sub,
        payload.user_id,
        payload.username,
        payload.preferred_username,
        payload.nameid,
        payload.NameIdentifier,
        payload.uid,
        payload.employeeId,
        payload.employeeID,
        payload.employeeNo
      );

      if (!userId && payload.accessToken && process.env.ACCOUNT_USER_API_URL) {
        try {
          const res = await fetch(process.env.ACCOUNT_USER_API_URL, {
            headers: { Authorization: `Bearer ${payload.accessToken}` },
          });
          if (res.ok) {
            const u = await res.json();
            userId = pickSocketUserId(
              u.userId,
              u.userid,
              u.id,
              u.Id,
              u.Username,
              u.UserName,
              u.username,
              u.particularID,
              u.particularId,
              u.nameid,
              u.NameIdentifier,
              u.employeeId,
              u.employeeID,
              u.employeeNo
            );
          }
        } catch (_) {
          // ignore; proceed if still unresolved
        }
      }

      if (!userId && payload.accessToken) {
        try {
          const decoded = jwt.decode(payload.accessToken) || {};
          userId = pickSocketUserId(
            decoded.Username,
            decoded.UserName,
            decoded.userId,
            decoded.userid,
            decoded.particularID,
            decoded.particularId,
            decoded.id,
            decoded.Id,
            decoded.sub,
            decoded.user_id,
            decoded.username,
            decoded.preferred_username,
            decoded.nameid,
            decoded.NameIdentifier,
            decoded.uid,
            decoded.employeeId,
            decoded.employeeID,
            decoded.employeeNo,
            decoded.email
          );
        } catch (_) {
          // ignore decode errors
        }
      }

      if (!userId && userIdAuth) {
        userId = userIdAuth;
      }

      if (!userId) {
        return next(new Error("Authentication error: cannot determine user id"));
      }

      let roles = payload.roles || payload.role || payload.Roles;
      const devRolesHeader =
        socket.handshake.headers["x-dev-roles"] ||
        socket.handshake.headers["X-Dev-Roles"];
      if (devRolesHeader) roles = devRolesHeader.split(",").map((r) => r.trim());
      if (typeof roles === "string") roles = [roles];

      const normalizedRoles = (roles || []).map((r) =>
        typeof r === "string" ? r.replace(/\s+/g, "_").toUpperCase() : r
      );

      const user = {
        Id: String(userId),
        id: String(userId),
        userId: String(userId),
        Username: Array.isArray(payload.Username)
          ? payload.Username
          : payload.Username
          ? [payload.Username]
          : [String(userId)],
        Roles: normalizedRoles,
        name: payload.name || payload.username || String(userId),
      };

      const identity = await resolveUserIdentity({
        user,
        headers: socket.handshake.headers,
      });
      socket.user = user;
      socket.identity = identity;
      return next();
    } catch (err) {
      console.warn("Socket authentication failed", err.message || err);
      const msg = debugMode
        ? `Authentication error: ${err.message || err}`
        : "Authentication error";
      return next(new Error(msg));
    }
  });
}

module.exports = { registerSocketAuth };