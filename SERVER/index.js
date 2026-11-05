require("dotenv").config({ path: ".env.local", override: true }); // Load .env.local first (overrides .env)
require("dotenv").config(); // Load .env for fallback variables

// Load .env-production if it exists and we are in production
const fs_env = require("fs");
const path_env = require("path");
if (
  (process.env.NODE_ENV === "production" || process.env.PRODUCTION_MODE === "true") &&
  fs_env.existsSync(path_env.join(__dirname, ".env-production"))
) {
  require("dotenv").config({ path: path_env.join(__dirname, ".env-production"), override: true });
  console.log("[Server] Loaded production environment from .env-production");
}

// Decrypt any ENC(...) environment values using ENV_ENCRYPTION_KEY
require("./utils/secretLoader");

// Normalize a few env variable names for developer convenience
process.env.MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_BUDGET_URL ||
  process.env.MONGODB_MAIN_URL ||
  process.env.MONGODB_URL;
process.env.MONGODB_BUDGET_URL = process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
process.env.MONGODB_MAIN_URL = process.env.MONGODB_MAIN_URL || process.env.MONGODB_URI;
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || process.env.SECRET_KEY;

// Global suppression of Node runtime deprecation warnings (Includes DEP0169 for legacy url.parse)
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (
  process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || "DEP0169"
)
  .split(",")
  .map((s) => s && s.trim())
  .filter(Boolean);

if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  try {
    process.noDeprecation = true;
    console.log("[Server] process.noDeprecation enabled via SUPPRESS_NODE_DEPRECATION_WARNINGS.");
  } catch (e) {
    // ignore if not settable
  }

  process.on("warning", (warning) => {
    try {
      const code = warning.code || warning.name || "";
      if (!SUPPRESS_NODE_DEPRECATION_WARNINGS.includes(code)) {
        console.warn(warning.name + ": " + warning.message + "\n" + (warning.stack || ""));
      }
    } catch (e) {
      console.warn(warning);
    }
  });
}

let isShuttingDown = false;

// Global error handlers to prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  const fs = require('fs');
  fs.appendFileSync('crash.log', `[${new Date().toISOString()}] Unhandled Rejection: ${reason?.message || reason}\n${reason?.stack || ''}\n`);
  
  console.error('❌ Unhandled Rejection thrown:');
  console.error('   Promise:', promise);
  console.error('   Message:', reason?.message || '(no message)');
  console.error('   Stack:', reason?.stack || '(no stack trace)');
  try {
    if (reason && typeof reason === 'object') {
      console.error('   Error details:', JSON.stringify(reason, null, 2));
    }
  } catch (e) {}
  gracefulShutdown('unhandledRejection', reason, 1);
});

process.on('uncaughtException', (err) => {
  const fs = require('fs');
  fs.appendFileSync('crash.log', `[${new Date().toISOString()}] Uncaught Exception: ${err?.message || err}\n${err?.stack || ''}\n`);
  
  console.error('❌ Uncaught Exception thrown:');
  console.error('   Message:', err?.message || '(no message)');
  console.error('   Stack:', err?.stack || '(no stack trace)');
  console.error('   Error object:', err);
  try {
    if (err && typeof err === 'object') {
      console.error('   Error keys:', Object.keys(err));
      console.error('   Error details:', JSON.stringify(err, null, 2));
    }
  } catch (e) {}
  gracefulShutdown('uncaughtException', err, 1);
});

// Apply centralized logging with redaction support
const { logger, wireConsoleToWinston } = require("./utils/winstonLogger");
wireConsoleToWinston();

const debugMode = process.env.DEBUG_MODE === "true";
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");

// Import ng bagong security_headers middleware
const securityHeaders = require("./middleware/security_headers");

// Socket & Database Initializations
const { initializeSocket } = require("./socket");
const connectMongo = require("./config/mongo_db");
const { mainConnection } = connectMongo;
const { initAgenda, stopAgenda } = require("./schedulers/agenda");
const { ensureDatabaseIndexes } = require("./config/dbIndexes");
const { initializeCleanupScheduler, stopCleanupScheduler } = require("./utils/backupCleanup");
const { initializeBackupSystem } = require("./backup-scripts/initBackupSystem");
const { initializeScheduledJobs, stopScheduledJobs } = require("./controllers/databaseBackupController");

// ROUTE IMPORTS
const isAuth = require("./middleware/is_auth");
const enforceOrgAccess = require("./middleware/enforceOrgAccess");

// Database Trigger Connection
connectMongo();
require("./models/UserOrganizationalAssignment");

// Helper function para sa Path Normalization (Inaalis ang trailing slashes)
const normalizePath = (p) => (p || "").toLowerCase().replace(/\/+$/, "") || "/";

const app = express();
app.disable('x-powered-by');

// 1. DYNAMIC TRUST PROXY
const trustProxyValue = process.env.TRUST_PROXY 
  ? (process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10))
  : 1;

app.set('trust proxy', trustProxyValue);

// Security Headers
app.use(securityHeaders());

// Compression Middleware Setup
const compression = require('compression');
app.use(compression({ threshold: 1024 }));

const apiPrefix = "/api";

// Ensure uploads folder exists
try {
  const uploadsPath = path.join(__dirname, "uploads", "proposal_attachments");
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log("[Server] Created uploads folder for proposal attachments");
  }
} catch (e) {
  console.error("Failed to create uploads folder", e.message || e);
}

if (!process.env.MONGODB_URI && !process.env.MONGODB_BUDGET_URL && !process.env.MONGODB_MAIN_URL) {
  console.warn("[Server] ⚠️ No MongoDB URI found in .env. Server connection might fail.");
}

const isProductionRuntime = String(process.env.NODE_ENV || '').toLowerCase() === 'production' || String(process.env.PRODUCTION_MODE || '').trim().length > 0;
const hasESignatureEncryptionKey = !!process.env.ESIGNATURE_IMAGE_ENCRYPTION_KEY && String(process.env.ESIGNATURE_IMAGE_ENCRYPTION_KEY).trim().length > 0;

if (!hasESignatureEncryptionKey) {
  const eSignatureKeyMessage = '[Server] ESIGNATURE_IMAGE_ENCRYPTION_KEY is required to protect workflow e-signature images at rest.';
  if (isProductionRuntime) {
    throw new Error(eSignatureKeyMessage);
  }
  console.warn(`${eSignatureKeyMessage} Running without key in non-production.`);
}

const attachWorkflowRef = require("./middleware/attachWorkflowRef");
const server = http.createServer(app);
const io = initializeSocket(server, { debugMode });

// 2. CORS CONFIGURATION (STRICT REGEX FOR NIA SUBDOMAINS)
const niaDomainRegex = /^https:\/\/(?:[a-zA-Z0-9-]+\.)*nia\.gov\.ph$/i;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const originStr = String(origin).trim().toLowerCase();

      const allowedOrigins = [
        process.env.CLIENT1,
        process.env.CLIENT2,
        process.env.CLIENT3,
        "https://budget.nia.gov.ph",
        "https://budget-server.nia.gov.ph"
      ].filter(Boolean).map(o => o.toLowerCase());

      const isAllowedExplicit = allowedOrigins.includes(originStr);
      const isOfficialNia = niaDomainRegex.test(originStr);
      const isLocalDev = process.env.NODE_ENV !== 'production' && (
        originStr.startsWith("http://localhost") || 
        originStr.startsWith("http://127.0.0.1") || 
        originStr.includes("fmis.local")
      );

      if (isAllowedExplicit || isOfficialNia || isLocalDev) {
        return callback(null, true);
      }

      console.warn("[CORS Blocked]:", origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", "Authorization", "X-CSRF-Token", "X-Workflow-Ref",
      "X-Requested-With", "X-User-Object", "X-Reauth-Password", "X-Reauth-User",
      ...(process.env.NODE_ENV !== 'production' ? ["X-Dev-User-Id", "X-Dev-Roles"] : [])
    ],
    optionsSuccessStatus: 204,
    exposedHeaders: ["Content-Disposition", "X-Document-ID"],
  })
);

// Express Standard Parsers & Security Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize()); // Prevent NoSQL Injections

// 3. SPECIALIZED RATE LIMITERS MOUNTING
const { apiLimiter, authLimiter, uploadLimiter, proposalLimiter } = require('./middleware/rateLimiter');
app.use(`${apiPrefix}/`, apiLimiter);
app.use(`${apiPrefix}/auth/login`, authLimiter);
if (uploadLimiter) app.use(`${apiPrefix}/uploads`, uploadLimiter);
if (proposalLimiter) app.use(`${apiPrefix}/proposals`, proposalLimiter);

const { logWorkflowAction } = require('./middleware/auditLogger');

// Serve SPA built files
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// SPA Routing Handler
app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    req.accepts("html") &&
    !req.path.startsWith(apiPrefix) &&
    !req.path.startsWith("/uploads") &&
    !req.path.startsWith("/socket.io") &&
    !path.extname(req.path)
  ) {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
  }
  return next();
});

// Legacy Route Rewrite compatibility Layer
app.use((req, res, next) => {
  try {
    if (req.path.startsWith(apiPrefix) || req.path === "/") return next();
    const excludedPrefixes = ["/uploads", "/socket.io", "/favicon.ico"];
    if (excludedPrefixes.some((prefix) => req.path.startsWith(prefix))) return next();
    req.url = `${apiPrefix}${req.url}`;
    return next();
  } catch (e) {
    return next();
  }
});

// =========================================================
// 4. CSRF HANDLING LAYER (FIXED & STABLE SESSION)
// =========================================================
const { doubleCsrf } = require("csrf-csrf");

const csrfCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};
if (process.env.COOKIE_DOMAIN) csrfCookieOptions.domain = process.env.COOKIE_DOMAIN;

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "default_fallback_secret",
  // ✅ STABLE SESSION IDENTIFIER: Hindi na magmamatch-fail sa pagitan ng GET at POST
  getSessionIdentifier: (req) => {
    return req.cookies?.token || "fmis-budget-stable-session";
  },
  cookieName: "x-csrf-token",
  cookieOptions: csrfCookieOptions,
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getTokenFromRequest: (req) => req.headers["x-csrf-token"] || req.headers["x-xsrf-token"],
});

// ✅ KUNG GUSTONG I-EXEMPT ANG SPECIFIC POST ENDPOINT FOR TESTING:
const csrfExemptPrefixes = [
  `${apiPrefix}/auth/login`,
  `${apiPrefix}/csrf-token`,
  `${apiPrefix}/test`,
  "/webhook",
  "/health"
  // Halimbawa: kung gusto mong pansamantalang i-exempt ang POST proposal route, i-uncomment ito:
  // `${apiPrefix}/proposals` 
];

app.use((req, res, next) => {
  const fullPath = (req.originalUrl || req.path || "").toLowerCase();

  const isExempt = csrfExemptPrefixes.some((prefix) => fullPath.startsWith(prefix.toLowerCase()));

  if (isExempt) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
});

app.get(`${apiPrefix}/csrf-token`, (req, res) => {
  try {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  } catch (err) {
    console.warn('[csrf-token]', err?.message || err);
    res.status(500).json({ error: 'Unable to generate CSRF token' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  return next(err);
});

// PUBLIC UTILITY ENDPOINTS
app.get("/", (req, res) => res.json({ message: "server is UP!" }));

app.get(`${apiPrefix}/test`, (req, res) => {
  res.json({ message: "Server is working without MongoDB!", timestamp: new Date(), status: "OK" });
});

// 5. GLOBAL ORGANIZATIONAL ENFORCEMENT INTERCEPTOR (NORMALIZED & SAFE)
const publicEndpoints = [
  "/",
  `${apiPrefix}/test`,
  `${apiPrefix}/csrf-token`,
  `${apiPrefix}/auth/login`
];

app.use((req, res, next) => {
  try {
    if (req.method === "OPTIONS") return next();

    const cleanPath = normalizePath(req.path);

    if (publicEndpoints.includes(cleanPath)) {
      return next();
    }

    return isAuth(req, res, () => enforceOrgAccess(req, res, next));
  } catch (e) {
    return res.status(500).json({ message: "Server error during access enforcement" });
  }
});

// PROTECTED STATIC FILE SERVING
app.use("/uploads", isAuth, express.static(path.join(__dirname, "uploads")));

// ENDPOINT / ROUTER MOUNTING
const masterRouter = require("./routers");
app.use(apiPrefix, masterRouter);

// =========================================================
// VAPT FIX: UNMATCHED API 404 CATCH-ALL HANDLER
// =========================================================
// Sinisigurong magbabalik ng JSON 404 sa halip na SPA HTML index.html
app.use(`${apiPrefix}/*`, (req, res) => {
  return res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

// Catch-all 404 para sa iba pang hindi kilalang static resources
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Requested resource or endpoint not found"
  });
});

// =========================================================
// VAPT FIX: GLOBAL ERROR HANDLER (Sanitizes response & hides stack traces)
// =========================================================
app.use((err, req, res, next) => {
  if (logger && logger.error) {
    logger.error(`[Global Error Handler] ${req.method} ${req.path} - ${err.message}`, {
      stack: err.stack,
      ip: req.ip
    });
  } else {
    console.error(`❌ [Global Error] ${req.method} ${req.path} - ${err.message}`, err.stack);
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production' || process.env.PRODUCTION_MODE === 'true';

  return res.status(statusCode).json({
    success: false,
    message: isProd && statusCode === 500
      ? "An unexpected internal server error occurred."
      : (err.message || "Internal Server Error")
  });
});

async function gracefulShutdown(signal = 'unknown', error = null, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    logger.warn(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    if (error) {
      logger.error('[Shutdown] Error context', { error: error?.message || String(error) });
    }

    try {
      stopCleanupScheduler();
      stopScheduledJobs();
    } catch (stopError) {
      logger.warn('[Shutdown] Failed stopping cron schedulers', { error: stopError?.message || stopError });
    }

    try {
      await stopAgenda();
    } catch (agendaError) {
      logger.warn('[Shutdown] Failed stopping agenda', { error: agendaError?.message || agendaError });
    }

    await new Promise((resolve) => {
      try { io.close(() => resolve()); } catch (_) { resolve(); }
    });

    await new Promise((resolve) => {
      try { server.close(() => resolve()); } catch (_) { resolve(); }
    });

    try {
      await mongoose.connection.close(false);
    } catch (mongoError) {
      logger.warn('[Shutdown] Failed closing mongoose default connection', { error: mongoError?.message || mongoError });
    }

    try {
      if (mainConnection && mainConnection.readyState === 1) {
        await mainConnection.close(false);
      }
    } catch (mainMongoError) {
      logger.warn('[Shutdown] Failed closing main Mongo connection', { error: mainMongoError?.message || mainMongoError });
    }

    logger.info('[Shutdown] Completed.');
  } catch (shutdownError) {
    logger.error('[Shutdown] Unexpected failure', { error: shutdownError?.message || shutdownError });
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 6. SAFE DATABASE & SERVER INITIALIZATION (PREVENTS RACE CONDITION)
const PORT = process.env.APP_PORT || process.env.PORT || 5005;

mongoose.connection.once("open", async () => {
  try {
    await ensureDatabaseIndexes(mongoose, logger);
    await initAgenda({ mongoConnection: mongoose.connection });
    initializeCleanupScheduler();
    await initializeScheduledJobs();
  } catch (e) {
    console.error("Failed during database initialization tasks:", e.stack || e);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    initializeBackupSystem();
    console.log(`🚀 FMIS - BUDGET IS UP AND RUNNING :: ${PORT}`);
  });
}

module.exports = { app, server };