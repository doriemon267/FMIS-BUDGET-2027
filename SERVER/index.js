require("dotenv").config(); // Load .env
require("dotenv").config({ path: ".env.local", override: true }); // Load .env.local (overrides .env)
// Decrypt any ENC(...) environment values using ENV_ENCRYPTION_KEY
require("./utils/secretLoader");
// Normalize a few env variable names for developer convenience (do not override explicit settings)
// Ensure we use what the user's `.env` provides; allow multiple aliases while respecting user values
process.env.MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_BUDGET_URL ||
  process.env.MONGODB_MAIN_URL ||
  process.env.MONGODB_URL;
process.env.MONGODB_BUDGET_URL =
  process.env.MONGODB_BUDGET_URL || process.env.MONGODB_URI;
process.env.MONGODB_MAIN_URL =
  process.env.MONGODB_MAIN_URL || process.env.MONGODB_URI;
process.env.JWT_SECRET_KEY =
  process.env.JWT_SECRET_KEY ||
  process.env.JWT_SECRET ||
  process.env.SECRET_KEY;
// Keep ALLOW_MOCK_AUTH exactly as provided: no normalization here so .env determines its value
// If DEP0123 or other warnings are listed in SUPPRESS_NODE_DEPRECATION_WARNINGS,
// set process.noDeprecation = true as early as possible to suppress Node runtime deprecation warnings
// and also filter the emitted 'warning' events that match codes in that list.
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (
  process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || ""
)
  .split(",")
  .map((s) => s && s.trim())
  .filter(Boolean);
if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  try {
    // Setting this suppresses Node runtime deprecation warnings globally (same as --no-deprecation)
    process.noDeprecation = true;
    console.log(
      "[Server] process.noDeprecation enabled via SUPPRESS_NODE_DEPRECATION_WARNINGS."
    );
  } catch (e) {
    // ignore if not settable
  }
  // Listen for 'warning' events and drop matching codes
  process.on("warning", (warning) => {
    try {
      const code = warning.code || warning.name || "";
      if (!SUPPRESS_NODE_DEPRECATION_WARNINGS.includes(code)) {
        // Print other warnings
        console.warn(
          warning.name + ": " + warning.message + "\n" + (warning.stack || "")
        );
      }
      // Otherwise drop the warning entirely
    } catch (e) {
      // If handling fails, print the warning normally
      console.warn(warning);
    }
  });
}
// Note: No re-declaration of SUPPRESS_NODE_DEPRECATION_WARNINGS here; handled above
// Removed console silencing - we want essential startup messages to show

// Apply log redaction and debug mode globally
const { logger: redactLogger } = require("./utils/logRedactor");
const debugLogger = require("./utils/debugLogger");

// Store original console methods before replacing
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Replace console methods with combined redaction + debug filtering
const shouldRedact = process.env.REDACT_LOGS === "true";
const debugMode = process.env.DEBUG_MODE === "true";

console.log = (...args) => {
  if (debugMode) {
    if (shouldRedact) redactLogger.log(...args);
    else originalConsole.log(...args);
  }
};

console.info = (...args) => {
  if (debugMode) {
    if (shouldRedact) redactLogger.info?.(...args);
    else originalConsole.info?.(...args);
  }
};

console.debug = (...args) => {
  if (debugMode) {
    if (shouldRedact) redactLogger.debug?.(...args);
    else originalConsole.debug?.(...args);
  }
};

// Errors and warnings always show (but still get redacted)
console.error = (...args) => {
  if (shouldRedact) redactLogger.error(...args);
  else originalConsole.error(...args);
};

console.warn = (...args) => {
  if (shouldRedact) redactLogger.warn(...args);
  else originalConsole.warn(...args);
};
const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require('helmet');
const csurf = require('csurf');
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const { resolveUserIdentity } = require("./utils/requestContext");
const personnelRoutes = require("./routers/personnel");
const positionTitleRoutes = require("./routers/PositionTitle");
const departmentRouter = require("./routers/Department");
const employeeRouter = require("./routers/employeeListRoutes");
const statusRouter = require("./routers/Status");
const salaryRouter = require("./routers/salaryRoutes");
const mooeRoutes = require("./routers/mooeRoutes");
const fiscalYearRoutes = require("./routers/fiscalYearRoutes");
const personnelServicesRouter = require("./routers/personnelServices_router");
const excelUploadRouter = require("./routers/excelUpload");
const capitalOutlayRouter = require("./routers/capitalOutlayRouter");
const capitalOutlayDetailsRouter = require("./routers/capitalOutlayDetailsRouter");
const categoryRouter = require("./routers/category");
// const proposalRouter = require("./routers/proposalRoutes");  // DISABLED - Using RBAC router instead
const proposalRBACRouter = require("./routers/proposalRoutesRBAC"); // ✅ RBAC router with role-based visibility control
const rataRoutes = require("./routers/RATARoutes");
const regionRouter = require("./routers/RegionRoutes");
const settings = require("./routers/settingsRoutes");
const annexRouter = require("./routers/annex");
const personnelServicesAnnexesRoutes = require("./routers/ps_annexes");
const setupRouter = require("./routers/setupRoutes");
const employeeCourtAppearanceRouter = require("./routers/employeeCourtAppearanceRoutes");
const subsistenceSTRouter = require("./routers/subsistenceAllowanceSTRoutes");
// const overtimeRouter = require("./routers/overtimeRoutes");
const overtimeRouter = require("./routers/overtimeRoutes");
const subsistenceAllowanceRouter = require("./routers/subsistenceAllowanceMDSRoutes");
const loyaltyPayRouter = require("./routers/loyaltyPayRoutes");
const reportsRouter = require("./routers/reports.routes");
const cosPersonnelRouter = require("./routers/cosPersonnelRoutes");
const proposalSummaryRoutes = require("./routers/proposalSummary");
// New Proposal Workflow Routes
const newProposalWorkflowRoutes = require("./routes/newProposalWorkflowRoutes");
const mssqlRoutes = require("./routers/mssqlRoutes");
const mssqlSalaryTableRoutes = require("./routers/mssqlSalaryTableRoutes");
const debugRoutes = require("./routers/debugRoutes");
const todoRouter = require("./routers/todo_router");
const eventsRouter = require("./routers/eventsRouter");
//PARA SA MGA UPLOADER
const chartOfAccountsRouter = require("./routers/uploader/chartOfAccounts");
const uploadcategories = require("./routers/uploader/categories");
const uploadstatus = require("./routers/uploader/statuses");
const uploadregions = require("./routers/uploader/regions");
const uploaddepartments = require("./routers/uploader/departments");
const uploadpositions = require("./routers/uploader/positionTitles");
const uploadsalaries = require("./routers/uploader/salaryGrades");
const uploadstatuses = require("./routers/uploader/statuses");
const uploadratas = require("./routers/uploader/ratas");
const mealAllowance = require("./routers/mealAllowanceRoutes");
const incomeCategoryRouter = require("./routers/incomeCategoryRoutes");
const incomeCategoryGroupRouter = require("./routers/incomeCategoryGroupRoutes");
const incomeSubcategoryRouter = require("./routers/incomeSubcategoryRoutes");
const incomeSubcategoryRoutes = require("./routers/income_subcategories");
const statsRouter = require("./routers/statsRoutes");
const childrenAllowance = require("./routers/childrenAllowanceRoutes");
const exportRoutes = require("./routers/exportRoutes");
const medicalAllowanceRouter = require("./routers/medicalAllowanceRoutes");
const incomeRouter = require("./routers/incomeRoutes");
const incomeExcelUploadRouter = require("./routers/incomeExcelUploadRoutes");
const discountSettingsRouter = require("./routes/discountSettings");
const retireeRouter = require("./routers/retireeRoutes");
const budgetarySupportRoutes = require("./routers/budgetarySupportRoutes");
const tierRoutes = require("./routers/tierRoutes");
const chartOfAccountsCRUDRouter = require("./routers/chartOfAccountsRoutes");
const titleMappingRouter = require("./routers/titleMappingRoutes");
const employeeMasterRouter = require("./routers/employeeMasterRoutes");
const iasOMCostRouter = require("./routers/iasOMCostRoutes");
const consolidatedReportsRouter = require("./routers/consolidatedReportsRoutes");
const consolidatedCapitalOutlayRouter = require("./routers/consolidatedCapitalOutlayRoutes");
const consolidatedPersonnelServicesRouter = require("./routers/consolidatedPersonnelServicesRoutes");
const comprehensiveReportsRouter = require("./routers/comprehensiveReportsRoutes");
const databaseBackupRouter = require("./routers/databaseBackupRoutes");
const budgetOfficerEditRouter = require("./routers/budgetOfficerEditRoutes");
const checkToken = require("./middleware/checkToken");
const enforceOrgAccess = require("./middleware/enforceOrgAccess");
const { initializeCleanupScheduler } = require("./utils/backupCleanup");
const { initializeBackupSystem } = require("./backup-scripts/initBackupSystem");
const income_categories = require("./routers/income_categories");
const authRouter = require("./routers/AuthRoutes");
const myProposalsRoutes = require("./routes/myProposalsRoutes");
require("./config/mongo_db")();
// Fix database index for region isolation
const mongoose = require("mongoose");
const { initAgenda } = require("./schedulers/agenda");
// Load UserOrganizationalAssignment model to ensure it's registered with mongoose
require("./models/UserOrganizationalAssignment");
mongoose.connection.once("open", async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection("mooeproposals");
    // Check if old problematic index exists
    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some(
      (idx) =>
        idx.key &&
        idx.key.uacsCode === 1 &&
        idx.key.fiscalYear === 1 &&
        !idx.key.region
    );
    if (hasOldIndex) {
      try {
        await collection.dropIndex({ uacsCode: 1, fiscalYear: 1 });
      } catch (error) {}
    }
    // Ensure new index with region exists
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 },
        { unique: true, background: true }
      );
    } catch (error) {
      if (error.code !== 85) {
        // 85 = index already exists
      }
    }
    // Ensure Settings collection has compound unique index (fiscalYear, budgetType) and drop old unique FY index if present
    try {
      const settingsCol = mongoose.connection.db.collection("settings");
      const settingsIndexes = await settingsCol.indexes();
      const hasUniqueFYOnly = settingsIndexes.some(
        (idx) =>
          idx.key &&
          idx.key.fiscalYear === 1 &&
          idx.unique &&
          !idx.key.budgetType
      );
      if (hasUniqueFYOnly) {
        try {
          await settingsCol.dropIndex("fiscalYear_1");
        } catch (e) {}
      }
      try {
        await settingsCol.createIndex(
          { fiscalYear: 1, budgetType: 1 },
          { unique: true, background: true }
        );
      } catch (e) {
        if (e.code !== 85) {
        }
      }
    } catch (e) {}
  } catch (error) {
    // Database index check failed
  }
  // Initialize Agenda scheduler after DB connection
  try {
    await initAgenda({ mongoConnection: mongoose.connection });
    // console.log('Agenda scheduler initialized');
  } catch (e) {
    console.error("Failed to initialize Agenda scheduler:", e.stack || e);
  }
});
const app = express();
// Ensure uploads folder exists for attachments
try {
  const uploadsPath = path.join(__dirname, "uploads", "proposal_attachments");
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log("[Server] Created uploads folder for proposal attachments");
  }
} catch (e) {
  console.error("Failed to create uploads folder", e.message || e);
}
// Startup diagnostics: log which critical env variables are present (redact tokens)
// console.log('[Server] Startup env diagnostics:');
// console.log('  DEBUG_MODE:', process.env.DEBUG_MODE === 'true');
// console.log('  ALLOW_MOCK_AUTH:', process.env.ALLOW_MOCK_AUTH === 'true');
// console.log('  JWT_SECRET_KEY set:', !!process.env.JWT_SECRET_KEY);
// console.log('  MONGODB_URI resolved to:', (!!process.env.MONGODB_URI) ? process.env.MONGODB_URI : '(not set)');
// console.log('  MONGODB_BUDGET_URL:', (!!process.env.MONGODB_BUDGET_URL) ? process.env.MONGODB_BUDGET_URL : '(not set)');
// console.log('  MONGODB_MAIN_URL:', (!!process.env.MONGODB_MAIN_URL) ? process.env.MONGODB_MAIN_URL : '(not set)');
if (
  !process.env.MONGODB_URI &&
  !process.env.MONGODB_BUDGET_URL &&
  !process.env.MONGODB_MAIN_URL
) {
  console.warn(
    "[Server] ⚠️ No MongoDB URI found in .env (MONGODB_URI or MONGODB_BUDGET_URL or MONGODB_MAIN_URL). The server will likely fail to connect."
  );
}
// Attach workflowRef middleware early so body gets populated before routers
const attachWorkflowRef = require("./middleware/attachWorkflowRef");
const server = http.createServer(app);
// Ensure default port uses .env but provide safe default
process.env.APP_PORT = process.env.APP_PORT || process.env.PORT || "5005";
// Socket.IO setup with explicit allowed origins (separate from Express CORS)
const allowedSocketOrigins = [
  process.env.CLIENT1,
  process.env.CLIENT2,
  process.env.CLIENT3,
  "http://localhost:3005",
  "https://localhost:3005",
  "http://localhost:3006",
  "https://localhost:3006",

].filter(Boolean);

const io = socketIo(server, {
  cors: {
    origin: allowedSocketOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const Message = require("./models/Message");

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    // DEVELOPMENT: allow dev-only mock auth using X-Dev-User-Id header
    const allowMockAuth =
      process.env.ALLOW_MOCK_AUTH === "true" ||
      process.env.DEBUG_MODE === "true";
    if (allowMockAuth && process.env.DEBUG_MODE === "true") {
      // console.debug('[SocketAuth] DEBUG_MODE is on; allowMockAuth enabled for local testing');
    }
    const devUserIdHeader =
      socket.handshake.headers["x-dev-user-id"] ||
      socket.handshake.headers["X-Dev-User-Id"];
    const devUserIdAuth =
      socket.handshake.auth &&
      (socket.handshake.auth.devUserId || socket.handshake.auth.xDevUserId);
    const userIdAuth =
      socket.handshake.auth &&
      (socket.handshake.auth.userId || socket.handshake.auth.userid);
    if (allowMockAuth && (devUserIdHeader || devUserIdAuth || userIdAuth)) {
      const uid = String(devUserIdHeader || devUserIdAuth).trim();
      const user = {
        Id: uid,
        id: uid,
        userId: uid,
        Username: [uid],
        Roles: ["DEVELOPER"],
        name: uid,
      };
      const identity = await resolveUserIdentity({
        user,
        headers: socket.handshake.headers,
      });
      socket.user = user;
      socket.identity = identity;
      // console.debug('[SocketAuth] Mock auth via devUserId:', uid);
      return next();
    }
    // Extract token from handshake auth, query params or Authorization header
    const tokenFromAuth = socket.handshake.auth && socket.handshake.auth.token;
    const tokenFromQuery =
      socket.handshake.query &&
      (socket.handshake.query.token || socket.handshake.query.t);
    const authHeader =
      socket.handshake.headers &&
      (socket.handshake.headers.authorization ||
        socket.handshake.headers.Authorization);
    let token =
      tokenFromAuth ||
      tokenFromQuery ||
      (authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null);

    // Fallback: check auth cookie in handshake headers (authToken)
    if (!token && socket.handshake.headers && socket.handshake.headers.cookie) {
      const cookieStr = socket.handshake.headers.cookie;
      const match = cookieStr.match(/(?:^|; )authToken=([^;]+)/);
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
      }
    }
    if (debugMode || process.env.ALLOW_MOCK_AUTH === "true") {
      // console.debug('[SocketAuth] tokenFromAuthPresent:', !!tokenFromAuth, 'authHeaderPresent:', !!authHeader, 'tokenPresent:', !!token);
      if (
        socket.handshake.auth &&
        (socket.handshake.auth.devUserId || socket.handshake.auth.xDevUserId)
      ) {
        // console.debug('[SocketAuth] handshake.auth contains devUserId');
      }
    }

    if (!token) {
      if (allowMockAuth && (devUserIdHeader || devUserIdAuth || userIdAuth)) {
        // Should have taken the mock path earlier, but just in case, allow it here
        const uid = String(
          devUserIdHeader || devUserIdAuth || userIdAuth
        ).trim();
        const user = {
          Id: uid,
          id: uid,
          userId: uid,
          Username: [uid],
          Roles: ["DEVELOPER"],
          name: uid,
        };
        socket.user = user;
        const identity = await resolveUserIdentity({
          user,
          headers: socket.handshake.headers,
        });
        socket.identity = identity;
        // console.debug('[SocketAuth] Fallback: mock auth from devUserId in handshake');
      } else {
        console.warn(
          "[SocketAuth] No token in handshake and no devUserId available, refusing connection"
        );
        return next(new Error("Authenticati
          on error: token missing"));
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (!payload) return next(new Error("Authentication error: token invalid"));

    // Build a minimal user object similar to checkToken middleware
    let userId = null;
    if (
      payload.Username &&
      Array.isArray(payload.Username) &&
      payload.Username[0]
    )
      userId = payload.Username[0];
    else if (payload.Username) userId = payload.Username;
    else if (payload.userId) userId = payload.userId;
    else if (payload.Id) userId = payload.Id;
    else if (payload.id) userId = payload.id;
    else if (payload.sub) userId = payload.sub;
    else if (payload.user_id) userId = payload.user_id;
    else if (payload.username) userId = payload.username;

    if (!userId && payload.accessToken && process.env.ACCOUNT_USER_API_URL) {
      // In production, we might fetch user details from account API. Keep this async call optional and guarded.
      try {
        const res = await fetch(process.env.ACCOUNT_USER_API_URL, {
          headers: { Authorization: `Bearer ${payload.accessToken}` },
        });
        if (res.ok) {
          const u = await res.json();
          userId = u.userId || u.id || u.Username?.[0] || u.username;
        }
      } catch (err) {
        // ignore; proceed to fail if userId still not found
      }
    }

    if (!userId)
      return next(new Error("Authentication error: cannot determine user id"));

    // Normalize roles
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

    // Enrich identity from DB or assignment if available
    const identity = await resolveUserIdentity({
      user,
      headers: socket.handshake.headers,
    });
    socket.user = user;
    socket.identity = identity;
    return next();
  } catch (err) {
    // In debug mode we include the underlying error message to assist with local development
    console.warn("Socket authentication failed", err.message || err);
    const msg = debugMode
      ? `Authentication error: ${err.message || err}`
      : "Authentication error";
    return next(new Error(msg));
  }
});
// MIDDLEWARE
app.use(
  cors({
    origin: [
      process.env.CLIENT1,
      process.env.CLIENT2,
      process.env.CLIENT3,

      // list more allowed origins
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // Include common dev headers used by local development and debugging
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Dev-User-Id",
      "X-Dev-Roles",
      "X-Requested-With",
      "X-User-Object",
      "X-Workflow-Ref",
    ],
  })
);
// Increase payload limits for export functionality
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
// Security headers
app.use(helmet());

// CSRF protection for state-changing requests. For SPAs we expose a
// /csrf-token endpoint so the client can fetch the token and include it in
// the X-CSRF-Token header for POST/PUT/DELETE requests.
const _csrfProtection = csurf({
  cookie: {
    httpOnly: false, // allow client JS to read the generated token if needed
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
  },
});

// Exempt login and other preflight/public endpoints from CSRF for now to avoid
// breaking non-updated clients. Encourage clients to fetch /csrf-token and include
// X-CSRF-Token for POST/PUT/DELETE requests.
app.use((req, res, next) => {
  const exemptPaths = ['/login', '/api/webhook', '/health'];
  if (exemptPaths.includes(req.path)) return next();
  return _csrfProtection(req, res, next);
});

app.get('/csrf-token', (req, res) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (err) {
    res.status(500).json({ error: 'Unable to generate CSRF token' });
  }
});

// Handle CSRF errors uniformly
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }
  return next(err);
});
app.get("/", (req, res) => res.json({ message: "server is UP!" }));

// Temporary public endpoint for compensation settings (for management page)
app.get("/compensation", async (req, res) => {
  try {
    const CompensationSettings = require("./models/CompensationSettings");
    const Settings = require("./models/Settings");

    const compensations = await CompensationSettings.find().sort({
      createdAt: -1,
    });

    // ✅ CRITICAL FIX: Enrich compensation data with linkedFiscalYears and budgetTypes
    // Without this, the frontend always shows "Not linked" even after linking
    const enrichedCompensations = await Promise.all(
      compensations.map(async (compensation) => {
        // Find all fiscal years linked to this compensation
        const linkedSettings = await Settings.find({
          compensationSettingsId: compensation._id,
        }).select("_id fiscalYear budgetType");

        // Extract the IDs for display purposes
        const linkedFiscalYears = linkedSettings.map((setting) => setting._id);

        // Extract budgetTypes from linked fiscal years
        const linkedBudgetTypes = linkedSettings
          .map((setting) => setting.budgetType)
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

        return {
          ...compensation.toObject(),
          linkedFiscalYears,
          linkedBudgetTypes, // ✅ NEW: Include budgetTypes from linked fiscal years
          linkedCount: linkedFiscalYears.length,
        };
      })
    );

    res.status(200).json({
      message: "Compensation settings retrieved successfully",
      count: enrichedCompensations.length,
      compensationSettings: enrichedCompensations,
    });
  } catch (error) {
    console.error("Error in getCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Temporary public template download endpoint (for testing)
app.get("/api/excel-upload/template", checkToken, async (req, res) => {
  try {
    console.log("TEMP: Template download requested by authenticated user");

    // Get user's actual access information from JWT
    const userAccess = req.user?.hierarchicalAccess || {};
    const {
      scope = "REGION",
      accessibleDepartments = [],
      accessibleDivisions = [],
      accessibleSections = [],
    } = userAccess;

    // Get active region from user or query params
    const region = req.query.region || req.user?.region || "";

    console.log("User access scope:", scope);
    console.log("User accessible departments:", accessibleDepartments);
    console.log("User accessible divisions:", accessibleDivisions);
    console.log("User accessible sections:", accessibleSections);
    console.log("Region:", region);

    // Generate the template with user's actual hierarchical access
    const {
      generateEmployeeTemplate,
    } = require("./utils/employeeTemplateGenerator");
    const templateBuffer = generateEmployeeTemplate({
      region: region,
      fiscalYear: "",
      scope,
      accessibleDepartments,
      accessibleDivisions,
      accessibleSections,
    });

    console.log(
      "Template generated successfully, size:",
      templateBuffer.length
    );

    // Set headers for file download
    const fileName = `employee_import_template_${
      region || "authenticated"
    }.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Send the file
    res.send(templateBuffer);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({
      error: "Error generating template",
      details: error.message,
    });
  }
});

// Test endpoint without MongoDB
app.get("/test", (req, res) => {
  res.json({
    message: "Server is working without MongoDB!",
    timestamp: new Date(),
    status: "OK",
    note: "MongoDB temporarily disabled due to authentication issues",
  });
});
// Test router removed for production security
// Global organizational enforcement for all mutating routes (non-GET)
app.use((req, res, next) => {
  try {
    if (req.method === "GET") {
      // Allow GET requests to compensation settings for the management page
      if (req.path === "/compensation") return next();
      return next();
    }
    // Skip enforcement for hierarchical assignment management endpoints
    const p = (req.path || "").toLowerCase();
    if (p.startsWith("/api/hierarchical-rbac/assignments")) {
      return next();
    }
    // Ensure user is authenticated before enforcing org access
    return checkToken(req, res, () => enforceOrgAccess(req, res, next));
  } catch (e) {
    // Global org enforcement error
    return res
      .status(500)
      .json({ message: "Server error during access enforcement" });
  }
});

// ✅ Protected /uploads route - requires authentication
app.use("/uploads", checkToken, express.static(path.join(__dirname, "uploads")));

app.use(employeeRouter);
app.use(statusRouter);
app.use(salaryRouter);
// Routes
app.use(authRouter);
app.use(personnelRoutes);
//Position Title Routes
app.use(positionTitleRoutes);
app.use(attachWorkflowRef, mooeRoutes);
app.use(fiscalYearRoutes);
//Department Title Routes
app.use(departmentRouter);
app.use(attachWorkflowRef, personnelServicesRouter);
app.use("/api", excelUploadRouter); // Excel Upload Route
app.use(attachWorkflowRef, capitalOutlayRouter);
app.use("/api", capitalOutlayDetailsRouter);
app.use(categoryRouter);
// app.use(proposalRouter);  // DISABLED - Using RBAC router instead
app.use("/api", proposalRBACRouter); // ✅ RBAC router with role-based visibility control

// Budget Officer Edit Routes
const { comparisonRouter } = require("./routers/budgetOfficerEditRoutes");
app.use("/api/budget-officer-edits", comparisonRouter);
app.use("/api/budget-officer-edits", budgetOfficerEditRouter);
// My Proposals Routes (for role-based proposal listing)
app.use("/api/my-proposals", myProposalsRoutes);
// Workflow-specific endpoints
app.use("/api/workflow", require("./routers/proposalWorkflowRoutes"));
// 🔄 Submission Workflow Routes - Controls data visibility based on submission status
const submissionWorkflowRoutes = require("./routers/submissionWorkflowRoutes");
app.use("/api/submission-workflow", submissionWorkflowRoutes);
// 🔄 Status Workflow Routes - Legacy workflow compatibility
const statusWorkflowRoutes = require("./routers/statusWorkflowRoutes");
app.use("/api/status-workflow", statusWorkflowRoutes);
// In-app notifications
app.use("/api", require("./routers/notificationRoutes"));
// Tier Comparison Routes (Tier 1 vs Tier 2 proposals)
const tierComparisonRoutes = require("./routers/tierComparisonRoutes");
app.use("/api/tier-comparison", tierComparisonRoutes);

// Budget Ceiling Routes (BRD ceiling management for NEP/GAA)
const budgetCeilingRoutes = require("./routers/budgetCeilingRoutes");
app.use("/api/budget-ceiling", budgetCeilingRoutes);
app.use(rataRoutes);
app.use(settings);
app.use("/api/regions", regionRouter);
app.use("/api", todoRouter);
app.use("/api/events", eventsRouter);
app.use(annexRouter);
app.use(personnelServicesAnnexesRoutes);
app.use(setupRouter);
app.use(employeeCourtAppearanceRouter);
app.use(overtimeRouter);
app.use(subsistenceAllowanceRouter);
app.use(iasOMCostRouter);
app.use(subsistenceSTRouter);
app.use(loyaltyPayRouter);
app.use("/reports", reportsRouter); // Mount with /reports prefix
app.use(cosPersonnelRouter);
app.use("/", mooeRoutes);
app.use("/api/proposalSummary", proposalSummaryRoutes);
app.use("/api/allproposal", newProposalWorkflowRoutes);
// MSSQL routes (optional): mount when MSSQL is configured
// Dedicated route for SalaryTable MSSQL table (mount before generic mssql routes)
app.use("/api/mssql/salarytable", mssqlSalaryTableRoutes);
// MSSQL routes (optional): mount when MSSQL is configured
app.use("/api/mssql", mssqlRoutes);
// Only register debug routes in development / when explicitly allowed
if (
  process.env.DEBUG_MODE === "true" ||
  process.env.ALLOW_MOCK_AUTH === "true"
) {
  app.use("/api/debug", debugRoutes);
}
//para sa mga uploader
app.use(chartOfAccountsRouter);
app.use(uploadcategories);
app.use(uploadstatus);
app.use(uploadregions);
app.use(uploaddepartments);
app.use(uploadpositions);
app.use(uploadsalaries);
app.use(uploadstatuses);
app.use(uploadratas);
app.use(mealAllowance);
app.use(incomeCategoryRouter);
app.use(incomeCategoryGroupRouter);
app.use(incomeSubcategoryRouter);
app.use(incomeSubcategoryRoutes);
app.use("/stats", statsRouter);
app.use(childrenAllowance);
app.use("/api/export", exportRoutes);
app.use(medicalAllowanceRouter);
// Income routes also benefit from unified workflowRef injection
app.use(attachWorkflowRef, incomeRouter);
app.use(income_categories);
app.use("/income", incomeExcelUploadRouter); // Mount under /income prefix
app.use("/api/consolidated-reports", consolidatedReportsRouter); // Mount consolidated reports routes
app.use("/api/consolidated-reports", consolidatedCapitalOutlayRouter); // Mount consolidated capital outlay routes
app.use("/api/consolidated-reports", consolidatedPersonnelServicesRouter); // Mount consolidated personnel services routes
app.use("/api/comprehensive-reports", comprehensiveReportsRouter); // Mount comprehensive reports routes
app.use("/api/database-backup", databaseBackupRouter); // Mount database backup routes
// app.use("/api", overtimeRouter);
// Add this line to use the new router
app.use(require("./routers/personnelParamsRoutes"));
// REMOVED: The old personnelServicesRoutes has submission workflow disabled
// This was overriding the correct personnelServices_router loaded earlier at line 274
// app.use(require("./routers/personnelServicesRoutes"));
// app.use(require("./routers/medicalAllowanceRoutes"));
app.use("/api/discount-settings", discountSettingsRouter);
app.use(retireeRouter);
app.use(budgetarySupportRoutes);
app.use("/api/tier", tierRoutes);
app.use(chartOfAccountsCRUDRouter);
app.use(titleMappingRouter);
// Chat router
app.use("/api/chat", require("./routers/chatRoutes"));
// Legacy user-region and organizational assignment routers removed in favor of hierarchical RBAC
// const userRegionAssignmentRouter = require('./routers/UserRegionAssignmentRoutes');
// app.use("/api", userRegionAssignmentRouter);
// const userOrgAssignmentRouter = require('./routers/UserOrganizationalAssignmentRoutes');
// app.use(userOrgAssignmentRouter);
const userProfileRouter = require("./routers/UserProfileRoutes");
app.use("/api", userProfileRouter);
const budgetManagerOrgRoutes = require("./routers/budgetManagerOrgRoutes");
app.use(budgetManagerOrgRoutes);
// 🏢 Hierarchical RBAC Routes - Enhanced organizational access control with Division → Department → Region consolidation
const hierarchicalRBACRoutes = require("./routers/hierarchicalRBACRoutes");
app.use("/api/hierarchical-rbac", hierarchicalRBACRoutes);
// Test routes removed for production security
// Register employee master router
app.use(employeeMasterRouter);
const mooeExcelUploadRouter = require("./routers/mooeExcelUploadRoutes");
app.use("/income", mooeExcelUploadRouter); // Mount under /income prefix

// Presence map for online users: Map<userId, count>
// global.onlineUsers maps userId => { count: number, lastConnectedAt: number }
global.onlineUsers = global.onlineUsers || new Map();

// WebSocket connection handling
io.on("connection", (socket) => {
  // console.log('User connected:', socket.id);
  if (debugMode || process.env.ALLOW_MOCK_AUTH === "true") {
    try {
      // console.debug(
      //   `[Socket] connected: ${socket.id} user=${JSON.stringify(
      //     socket.user
      //   )} onlineCount=${global.onlineUsers?.size || 0}`
      // );
    } catch (e) {}
  }
  const uid =
    socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
  if (uid) {
    const normalizedUid = String(uid);
    const existing = global.onlineUsers.get(normalizedUid) || {
      count: 0,
      lastConnectedAt: null,
    };
    const updated = { count: existing.count + 1, lastConnectedAt: Date.now() };
    global.onlineUsers.set(normalizedUid, updated);
    // Notify all clients about who is online (filtered client-side)
    try {
      io.emit("presence-update", { userId: normalizedUid, status: "online" });
    } catch (e) {}
  }

  // Join user-specific room for targeted updates
  socket.on("join-user-room", (userId) => {
    const authUserId =
      socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
    // Admins may request to join arbitrary user rooms; otherwise default to authenticated user
    const allowAdminJoin =
      socket.user?.Roles?.includes("SUPER_ADMIN") ||
      socket.user?.Roles?.includes("ADMIN");
    const targetUserId = allowAdminJoin && userId ? userId : authUserId;
    if (!targetUserId) return;
    socket.join(`user_${targetUserId}`);
    if (debugMode || process.env.ALLOW_MOCK_AUTH === "true");
      // console.debug(`Socket ${socket.id} joined user_${targetUserId}`);
  });

  // Join admin room for broadcasting permission updates
  socket.on("join-admin-room", () => {
    socket.join("admin_room");
    console.log("User joined admin room");
  });

  // Handle permission updates
  socket.on("permission-updated", (data) => {
    console.log("Permission update received:", data);

    // Broadcast to all connected clients except sender
    // socket.broadcast.emit('permission-changed', {
    //   userId: data.userId,
    //   updatedBy: data.updatedBy,
    //   timestamp: new Date(),
    //   changes: data.changes
    // });

    // Also broadcast to admin room for admin dashboard updates
    // io.to('admin_room').emit('admin-permission-updated', data);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    // console.log("User disconnected:", socket.id);
    if (debugMode || process.env.ALLOW_MOCK_AUTH === "true") {
      try {
        // console.debug(
        //   `[Socket] disconnected: ${socket.id} user=${JSON.stringify(
        //     socket.user
        //   )} onlineCount=${global.onlineUsers?.size || 0}`
        // );
      } catch (e) {}
    }
    const uid =
      socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
    if (uid) {
      const normalizedUid = String(uid);
      const existing = global.onlineUsers.get(normalizedUid) || {
        count: 0,
        lastConnectedAt: null,
      };
      const current = existing.count;
      if (current <= 1) {
        global.onlineUsers.delete(normalizedUid);
        try {
          io.emit("presence-update", {
            userId: normalizedUid,
            status: "offline",
          });
        } catch (e) {}
      } else {
        global.onlineUsers.set(normalizedUid, {
          count: current - 1,
          lastConnectedAt: existing.lastConnectedAt,
        });
      }
    }
  });

  // Chat message sent from a client via socket
  socket.on("chat-send", async (data) => {
    try {
      // Data should contain { to, text, metadata }
      const from =
        socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data.to;
      const text = data.text;
      const metadata = data.metadata || {};
      if (!from || !to || !text) return;
      const saved = await Message.create({ from, to, text, metadata });
      // Enrich message metadata with sender toast-friendly name for client notifications (dev & prod)
      try {
        const HierarchicalUserAssignment = require("./models/HierarchicalUserAssignment");
        const User = require("./models/User");
        let fromName = null;
        const assign = await HierarchicalUserAssignment.findOne({
          userId: String(from),
        }).lean();
        if (assign?.userName) fromName = assign.userName;
        if (!fromName) {
          const u = await User.findOne({ userId: String(from) }).lean();
          fromName = u?.name || null;
        }
        if (fromName) {
          saved.metadata = saved.metadata || {};
          saved.metadata.fromName = fromName;
        }
      } catch (err) {
        // ignore enrich errors
      }
      // Emit to the recipient and sender rooms
      global.io.to(`user_${to}`).emit("chat-message", saved);
      global.io.to(`user_${from}`).emit("chat-message", saved);
    } catch (e) {
      console.error(
        "Error handling chat-send socket event:",
        e.stack || e.message
      );
    }
  });

  // Typing indicator events
  socket.on("typing-start", (data) => {
    try {
      const from =
        socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data?.to;
      if (!from || !to) return;
      global.io.to(`user_${to}`).emit("typing-start", { from, to });
    } catch (e) {
      console.error("typing-start handler error", e.message);
    }
  });

  socket.on("typing-stop", (data) => {
    try {
      const from =
        socket.user && (socket.user.Id || socket.user.id || socket.user.userId);
      const to = data?.to;
      if (!from || !to) return;
      global.io.to(`user_${to}`).emit("typing-stop", { from, to });
    } catch (e) {
      console.error("typing-stop handler error", e.message);
    }
  });
});

// Export io for use in other modules
global.io = io;

if (require.main === module) {
  server.listen(process.env.APP_PORT, () => {
    // Initialize backup system
    initializeBackupSystem();
    // Initialize backup cleanup scheduler
    setTimeout(() => {
      initializeCleanupScheduler();
    }, 5000); // Wait 5 seconds for database connection to be established
    // Always show essential startup message
    console.log("🚀", "FMIS - BUDGET IS UP AND RUNNING :: 5005");
    return null;
  });
}

// Export app & server for programmatic use (tests, utils)
module.exports = { app, server };