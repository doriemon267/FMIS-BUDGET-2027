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

// Global error handlers to prevent crashes from unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception thrown:');
  console.error('   Message:', err?.message || '(no message)');
  console.error('   Stack:', err?.stack || '(no stack trace)');
  console.error('   Error object:', err);
  // Log full error details for debugging
  if (err && typeof err === 'object') {
    console.error('   Error keys:', Object.keys(err));
    console.error('   Error details:', JSON.stringify(err, null, 2));
  }
  gracefulShutdown('uncaughtException', err, 1);
});
// Note: No re-declaration of SUPPRESS_NODE_DEPRECATION_WARNINGS here; handled above
// Removed console silencing - we want essential startup messages to show

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
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const csurf = require('csurf');
const http = require("http");
const { initializeSocket } = require("./socket");
const personnelRoutes = require("./routers/personnel");
const positionTitleRoutes = require("./routers/PositionTitle");
const departmentRouter = require("./routers/Department");
const employeeRouter = require("./routers/employeeListRoutes");
const statusRouter = require("./routers/Status");
const salaryRouter = require("./routers/salaryRoutes");
const cpcsSalaryRoutes = require("./routers/cpcsSalaryRoutes");
const cosSalaryRoutes = require("./routers/cosSalaryRoutes");
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
const organizationStructureRouter = require("./routers/OrganizationStructureRoutes");
const employeeCourtAppearanceRouter = require("./routers/employeeCourtAppearanceRoutes");
const subsistenceSTRouter = require("./routers/subsistenceAllowanceSTRoutes");
// const overtimeRouter = require("./routers/overtimeRoutes");
const overtimeRouter = require("./routers/overtimeRoutes");
const subsistenceAllowanceRouter = require("./routers/subsistenceAllowanceMDSRoutes");
const subsistenceAllowanceGeneralRouter = require("./routers/subsistenceAllowanceRoutes");
const loyaltyPayRouter = require("./routers/loyaltyPayRoutes");
const reportsRouter = require("./routers/reports.routes");
const cosPersonnelRouter = require("./routers/cosPersonnelRoutes");
const proposalSummaryRoutes = require("./routers/proposalSummary");
// New Proposal Workflow Routes
const newProposalWorkflowRoutes = require("./routes/newProposalWorkflowRoutes");
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
const capitalOutlayExcelUploadRoutes = require("./routers/capitalOutlayExcelUploadRoutes");
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
const personnelServicesPDFRouter = require("./routers/personnelServicesPDFRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const checkToken = authMiddleware;
const authRouter = require("./routers/auth_router");

const enforceOrgAccess = require("./middleware/enforceOrgAccess");
const {
  initializeCleanupScheduler,
  stopCleanupScheduler,
} = require("./utils/backupCleanup");
const { initializeBackupSystem } = require("./backup-scripts/initBackupSystem");
const {
  initializeScheduledJobs,
  stopScheduledJobs,
} = require("./controllers/databaseBackupController");
const income_categories = require("./routers/income_categories");

const myProposalsRoutes = require("./routes/myProposalsRoutes");
const connectMongo = require("./config/mongo_db");
const { mainConnection } = connectMongo;
const mongoose = require("mongoose");
const { initAgenda, stopAgenda } = require("./schedulers/agenda");
const { ensureDatabaseIndexes } = require("./config/dbIndexes");
connectMongo();
// Load UserOrganizationalAssignment model to ensure it's registered with mongoose
require("./models/UserOrganizationalAssignment");
mongoose.connection.once("open", async () => {
  await ensureDatabaseIndexes(mongoose, logger);

  // Initialize Agenda scheduler after DB connection
  try {
    await initAgenda({ mongoConnection: mongoose.connection });

    // Initialize backup system and scheduled jobs
    initializeCleanupScheduler();
    await initializeScheduledJobs();
  } catch (e) {
    console.error("Failed to initialize schedulers:", e.stack || e);
  }
});
const app = express();

// Trust first proxy (nginx, load balancer, etc.) so express-rate-limit can use
// X-Forwarded-For correctly and avoid ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);

const apiPrefix = "/api";
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

const isProductionRuntime =
  String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
  String(process.env.PRODUCTION_MODE || '').trim().length > 0;
const hasESignatureEncryptionKey =
  !!process.env.ESIGNATURE_IMAGE_ENCRYPTION_KEY &&
  String(process.env.ESIGNATURE_IMAGE_ENCRYPTION_KEY).trim().length > 0;

if (!hasESignatureEncryptionKey) {
  const eSignatureKeyMessage =
    '[Server] ESIGNATURE_IMAGE_ENCRYPTION_KEY is required to protect workflow e-signature images at rest.';
  if (isProductionRuntime) {
    throw new Error(eSignatureKeyMessage);
  }
  console.warn(`${eSignatureKeyMessage} Running without key in non-production will store e-signatures unencrypted.`);
}
// Attach workflowRef middleware early so body gets populated before routers
const attachWorkflowRef = require("./middleware/attachWorkflowRef");
const server = http.createServer(app);
// Ensure default port uses .env but provide safe default
process.env.APP_PORT = process.env.APP_PORT || process.env.PORT || "5005";
const io = initializeSocket(server, { debugMode });
// MIDDLEWARE
// app.use(
//   cors({
//     origin: [
//       process.env.CLIENT1,
//       process.env.CLIENT2,
//       process.env.CLIENT3,

//       // list more allowed origins
//     ],
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     // Include common dev headers used by local development and debugging
//     allowedHeaders: [
//       "Content-Type",
//       "Authorization",
//       "X-CSRF-Token",
//       "X-Dev-User-Id",
//       "X-Dev-Roles",
//       "X-Requested-With",
//       "X-User-Object",
//       "X-Workflow-Ref",
//     ],
//   })
// );


app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin, server, or tool (Postman/curl) — allow
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.CLIENT1,
        process.env.CLIENT2,
        process.env.CLIENT3,
        "https://budget.nia.gov.ph",
        "https://budget-server.nia.gov.ph"
      ].filter(Boolean);

      const isAllowed = allowedOrigins.includes(origin);
      const isNia = origin.endsWith(".nia.gov.ph") || origin === "https://nia.gov.ph";
      const isLocal = origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
      const isFmisLocal = origin && origin.includes("fmis.local");

      if (isAllowed || isNia || isLocal || isFmisLocal) return callback(null, true);

      // Log only when blocking (useful for debugging unauthorized origins)
      console.warn("CORS: Origin blocked:", origin);
      return callback(null, false); // Return false instead of Error to avoid 500s in some configurations
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Workflow-Ref",
      "X-Dev-User-Id",
      "X-Dev-Roles",
      "X-Requested-With",
      "X-User-Object",
      "X-Reauth-Password",
      "X-Reauth-User",
    ],
    optionsSuccessStatus: 204,
    // Expose custom headers so browser JS can read them cross-origin
    exposedHeaders: ["X-Auth-Token"],
  }),
);


// Increase payload limits for export functionality
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
// NoSQL injection prevention: strip $ and . from req.body, req.query, req.params
app.use(mongoSanitize());
// Security headers (use configured securityHeaders from security.js, not bare helmet())
const { securityHeaders, permissionsPolicy } = require('./middleware/security');
app.use(securityHeaders);
app.use(permissionsPolicy);

// Gzip compression (optional — graceful fallback if package not installed)
try {
  const compression = require('compression');
  app.use(compression({ threshold: 1024 })); // Only compress responses > 1KB
} catch (e) {
  // compression not installed; serving uncompressed (run: npm install compression --save)
}

// Rate limiting
const { apiLimiter, authLimiter, uploadLimiter, proposalLimiter } = require('./middleware/rateLimiter');
app.use(`${apiPrefix}/`, apiLimiter); // Apply to all API routes

// Audit logging middleware
const { logWorkflowAction } = require('./middleware/auditLogger');

// ── Serve built frontend from /public (same pattern as FMIS-MAIN) ──────────
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '7d',        // Cache hashed assets (JS/CSS) for 7 days
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // index.html must never be cached — it references hashed assets
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// SPA navigation intercept: browser requests for frontend routes (e.g. /dashboard)
// must NOT be rewritten to /api/dashboard. Detect them early and serve index.html.
app.use((req, res, next) => {
  // Only intercept GET requests that accept HTML, have no file extension, and aren't API/socket/upload paths
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

// Legacy URL compatibility: rewrite non-/api requests to /api
// Exclusions include static uploads, socket.io, and root path.
app.use((req, res, next) => {
  try {
    if (req.path.startsWith(apiPrefix)) return next();
    if (req.path === "/") return next();
    const excludedPrefixes = ["/uploads", "/socket.io", "/favicon.ico"];
    if (excludedPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }
    req.url = `${apiPrefix}${req.url}`;
    return next();
  } catch (e) {
    return next();
  }
});

// CSRF protection for state-changing requests. For SPAs we expose a
// /csrf-token endpoint so the client can fetch the token and include it in
// the X-CSRF-Token header for POST/PUT/DELETE requests.
const csrfCookieOptions = {
  httpOnly: false, // allow client JS to read the generated token if needed
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};
if (process.env.COOKIE_DOMAIN) csrfCookieOptions.domain = process.env.COOKIE_DOMAIN;
const _csrfProtection = csurf({ cookie: csrfCookieOptions });

// CSRF: Exempt all /api routes (incl. csrf-token). API routes are protected by tokenMiddleware.
// csurf cookie fails with cross-origin (budget.nia.gov.ph vs budget-server); use simple token instead.
app.use((req, res, next) => {
  if (req.path.startsWith(apiPrefix)) return next();
  const exemptPaths = ["/login", "/webhook", "/health"];
  if (exemptPaths.includes(req.path)) return next();
  return _csrfProtection(req, res, next);
});

// Simple token - no csurf cookie (avoids cross-origin/cookie issues). API routes don't validate CSRF.
// CSRF token endpoint (if CSRF protection is enabled)
// Uncomment and configure if needed:
// const { getCsrfToken } = require('./middleware/csrfProtection');
// app.get(`${apiPrefix}/csrf-token`, getCsrfToken, (_req, res) => {
app.get(`${apiPrefix}/csrf-token`, (_req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    res.json({ csrfToken: token });
  } catch (err) {
    console.warn('[csrf-token]', err?.message || err);
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
app.get(`${apiPrefix}/compensation`, async (req, res) => {
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
app.get(`${apiPrefix}/excel-upload/template`, checkToken, async (req, res) => {
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
app.get(`${apiPrefix}/test`, (req, res) => {
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
    if (req.method === "GET" || req.method === "OPTIONS") {
      // Allow GET and OPTIONS requests to bypass global organizational enforcement
      if (req.path === `${apiPrefix}/compensation`) return next();
      return next();
    }
    // Skip enforcement for hierarchical assignment management endpoints
    const p = (req.path || "").toLowerCase();
    if (p.startsWith(`${apiPrefix}/hierarchical-rbac/assignments`)) {
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

app.use(apiPrefix, employeeRouter);
app.use(apiPrefix, statusRouter);
app.use(apiPrefix, salaryRouter);
app.use(`${apiPrefix}/cpcs-salary`, cpcsSalaryRoutes);
app.use(`${apiPrefix}/cos-salary`, cosSalaryRoutes);
// Routes
app.use(apiPrefix, authRouter);
app.use(apiPrefix, personnelRoutes);
//Position Title Routes
app.use(apiPrefix, positionTitleRoutes);
app.use(apiPrefix, attachWorkflowRef, mooeRoutes);
app.use(apiPrefix, fiscalYearRoutes);
//Department Title Routes
app.use(apiPrefix, departmentRouter);
// Mount personnelParamsRoutes BEFORE personnelServices_router so /personnel/getByParams (with proposalId) is handled correctly
app.use(apiPrefix, require("./routers/personnelParamsRoutes"));
app.use(apiPrefix, attachWorkflowRef, personnelServicesRouter);
app.use(apiPrefix, excelUploadRouter); // Excel Upload Route
app.use(`${apiPrefix}/capitaloutlay`, capitalOutlayExcelUploadRoutes); // Capital Outlay Excel Upload Route
app.use(apiPrefix, attachWorkflowRef, capitalOutlayRouter);
app.use(apiPrefix, capitalOutlayDetailsRouter);
app.use(apiPrefix, categoryRouter);
// app.use(proposalRouter);  // DISABLED - Using RBAC router instead
app.use(apiPrefix, proposalRBACRouter); // ✅ RBAC router with role-based visibility control

// Budget Officer Edit Routes
const { comparisonRouter } = require("./routers/budgetOfficerEditRoutes");
app.use(`${apiPrefix}/budget-officer-edits`, comparisonRouter);
app.use(`${apiPrefix}/budget-officer-edits`, budgetOfficerEditRouter);
// My Proposals Routes (for role-based proposal listing)
app.use(`${apiPrefix}/my-proposals`, myProposalsRoutes);
// Workflow-specific endpoints
app.use(`${apiPrefix}/workflow`, require("./routers/proposalWorkflowRoutes"));
// Workflow Templates Routes
app.use(`${apiPrefix}/workflow-templates`, require("./routers/workflowTemplateRoutes"));
// 🔄 Submission Workflow Routes - Controls data visibility based on submission status
const submissionWorkflowRoutes = require("./routers/submissionWorkflowRoutes");
app.use(`${apiPrefix}/submission-workflow`, submissionWorkflowRoutes);
// 🔄 Status Workflow Routes - Legacy workflow compatibility
const statusWorkflowRoutes = require("./routers/statusWorkflowRoutes");
app.use(`${apiPrefix}/status-workflow`, statusWorkflowRoutes);
// In-app notifications
app.use(apiPrefix, require("./routers/notificationRoutes"));
// Tier Comparison Routes (Tier 1 vs Tier 2 proposals)
const tierComparisonRoutes = require("./routers/tierComparisonRoutes");
app.use(`${apiPrefix}/tier-comparison`, tierComparisonRoutes);

// Budget Ceiling Routes (BRD ceiling management for NEP/GAA)
const budgetCeilingRoutes = require("./routers/budgetCeilingRoutes");
app.use(`${apiPrefix}/budget-ceiling`, budgetCeilingRoutes);
app.use(apiPrefix, rataRoutes);
app.use(apiPrefix, settings);
app.use(`${apiPrefix}/regions`, regionRouter);
app.use(apiPrefix, todoRouter);
app.use(`${apiPrefix}/events`, eventsRouter);
app.use(apiPrefix, annexRouter);
app.use(apiPrefix, personnelServicesAnnexesRoutes);
app.use(apiPrefix, setupRouter);
app.use(`${apiPrefix}/organization-structure`, organizationStructureRouter);
app.use(apiPrefix, employeeCourtAppearanceRouter);
app.use(apiPrefix, overtimeRouter);
app.use(apiPrefix, subsistenceAllowanceRouter);
app.use(apiPrefix, subsistenceAllowanceGeneralRouter);
app.use(apiPrefix, iasOMCostRouter);
app.use(apiPrefix, subsistenceSTRouter);
app.use(apiPrefix, loyaltyPayRouter);
app.use(`${apiPrefix}/reports`, reportsRouter); // Mount with /reports prefix
app.use(apiPrefix, cosPersonnelRouter);
app.use(`${apiPrefix}/proposalSummary`, proposalSummaryRoutes);
app.use(`${apiPrefix}/allproposal`, logWorkflowAction, newProposalWorkflowRoutes);

// Comment/Annotation routes
const commentRoutes = require('./routers/commentRoutes');
app.use(`${apiPrefix}`, commentRoutes);
// Only register debug routes in development / when explicitly allowed
if (
  process.env.DEBUG_MODE === "true" ||
  process.env.ALLOW_MOCK_AUTH === "true"
) {
  app.use(`${apiPrefix}/debug`, debugRoutes);
}
//para sa mga uploader
app.use(apiPrefix, chartOfAccountsRouter);
app.use(apiPrefix, uploadcategories);
app.use(apiPrefix, uploadstatus);
app.use(apiPrefix, uploadregions);
app.use(apiPrefix, uploaddepartments);
app.use(apiPrefix, uploadpositions);
app.use(apiPrefix, uploadsalaries);
app.use(apiPrefix, uploadstatuses);
app.use(apiPrefix, uploadratas);
app.use(apiPrefix, mealAllowance);
app.use(apiPrefix, incomeCategoryRouter);
app.use(apiPrefix, incomeCategoryGroupRouter);
app.use(apiPrefix, incomeSubcategoryRouter);
app.use(apiPrefix, incomeSubcategoryRoutes);
app.use(`${apiPrefix}/stats`, statsRouter);
app.use(apiPrefix, childrenAllowance);
app.use(`${apiPrefix}/export`, exportRoutes);
app.use(`${apiPrefix}/personnel-services-pdf`, personnelServicesPDFRouter); // Mount personnel services PDF routes
app.use(apiPrefix, medicalAllowanceRouter);
// Income routes also benefit from unified workflowRef injection
app.use(apiPrefix, attachWorkflowRef, incomeRouter);
app.use(apiPrefix, income_categories);
app.use(`${apiPrefix}/income`, incomeExcelUploadRouter); // Mount under /income prefix
app.use(`${apiPrefix}/consolidated-reports`, consolidatedReportsRouter); // Mount consolidated reports routes
app.use(`${apiPrefix}/consolidated-reports`, consolidatedCapitalOutlayRouter); // Mount consolidated capital outlay routes
app.use(`${apiPrefix}/consolidated-reports`, consolidatedPersonnelServicesRouter); // Mount consolidated personnel services routes
app.use(`${apiPrefix}/comprehensive-reports`, comprehensiveReportsRouter); // Mount comprehensive reports routes
app.use(`${apiPrefix}/database-backup`, databaseBackupRouter); // Mount database backup routes
// app.use("/api", overtimeRouter);
// REMOVED: personnelParamsRoutes moved earlier (before personnelServices_router) for /personnel/getByParams
// REMOVED: The old personnelServicesRoutes has submission workflow disabled
// This was overriding the correct personnelServices_router loaded earlier at line 274
// app.use(require("./routers/personnelServicesRoutes"));
// app.use(require("./routers/medicalAllowanceRoutes"));
app.use(`${apiPrefix}/discount-settings`, discountSettingsRouter);
app.use(apiPrefix, retireeRouter);
app.use(apiPrefix, budgetarySupportRoutes);
app.use(`${apiPrefix}/tier`, tierRoutes);
app.use(apiPrefix, chartOfAccountsCRUDRouter);
app.use(apiPrefix, titleMappingRouter);
// Chat router
app.use(`${apiPrefix}/chat`, require("./routers/chatRoutes"));
// Legacy user-region and organizational assignment routers removed in favor of hierarchical RBAC
// const userRegionAssignmentRouter = require('./routers/UserRegionAssignmentRoutes');
// app.use("/api", userRegionAssignmentRouter);
// const userOrgAssignmentRouter = require('./routers/UserOrganizationalAssignmentRoutes');
// app.use(userOrgAssignmentRouter);
const userProfileRouter = require("./routers/UserProfileRoutes");
app.use(apiPrefix, userProfileRouter);
// User Preferences Routes
const userPreferencesRoutes = require("./routers/userPreferencesRoutes");
app.use(`${apiPrefix}/user`, userPreferencesRoutes);
// User Activity Logs (immutable, snapshot support) – read-only API
const userActivityLogRoutes = require("./routers/userActivityLogRoutes");
app.use(`${apiPrefix}/user-activity-logs`, userActivityLogRoutes);
const budgetManagerOrgRoutes = require("./routers/budgetManagerOrgRoutes");
app.use(apiPrefix, budgetManagerOrgRoutes);
// 🏢 Hierarchical RBAC Routes - Enhanced organizational access control with Division → Department → Region consolidation
const hierarchicalRBACRoutes = require("./routers/hierarchicalRBACRoutes");
app.use(`${apiPrefix}/hierarchical-rbac`, hierarchicalRBACRoutes);
// Test routes removed for production security
// Register employee master router
app.use(apiPrefix, employeeMasterRouter);
const mooeExcelUploadRouter = require("./routers/mooeExcelUploadRoutes");
app.use(`${apiPrefix}/income`, mooeExcelUploadRouter); // Mount under /income prefix

let isShuttingDown = false;

async function gracefulShutdown(signal = 'unknown', error = null, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    logger.warn(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    if (error) {
      logger.error('[Shutdown] Error context', { error: error?.message || String(error) });
    }

    // Stop cron-based backup schedules first to avoid new jobs during shutdown.
    try {
      stopCleanupScheduler();
      stopScheduledJobs();
    } catch (stopError) {
      logger.warn('[Shutdown] Failed stopping cron schedulers', { error: stopError?.message || stopError });
    }

    // Stop agenda workers.
    try {
      await stopAgenda();
    } catch (agendaError) {
      logger.warn('[Shutdown] Failed stopping agenda', { error: agendaError?.message || agendaError });
    }

    // Stop accepting HTTP/socket traffic.
    await new Promise((resolve) => {
      try {
        io.close(() => resolve());
      } catch (_) {
        resolve();
      }
    });

    await new Promise((resolve) => {
      try {
        server.close(() => resolve());
      } catch (_) {
        resolve();
      }
    });

    // Close database connections last.
    try {
      await mongoose.connection.close(false);
    } catch (mongoError) {
      logger.warn('[Shutdown] Failed closing mongoose default connection', {
        error: mongoError?.message || mongoError,
      });
    }

    try {
      if (mainConnection && mainConnection.readyState === 1) {
        await mainConnection.close(false);
      }
    } catch (mainMongoError) {
      logger.warn('[Shutdown] Failed closing main Mongo connection', {
        error: mainMongoError?.message || mainMongoError,
      });
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

if (require.main === module) {
  server.listen(process.env.APP_PORT, () => {
    // Initialize backup system
    initializeBackupSystem();
    // Always show essential startup message
    console.log("🚀", "FMIS - BUDGET IS UP AND RUNNING :: 5005");
    return null;
  });
}

// Export app & server for programmatic use (tests, utils)
module.exports = { app, server };