require("dotenv").config({ path: ".env.local", override: true }); // Load .env.local first (overrides .env)
require("dotenv").config(); // Load .env for fallback variables

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

// Global suppression of Node runtime deprecation warnings if configured
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (
  process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || ""
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
  if (err && typeof err === 'object') {
    console.error('   Error keys:', Object.keys(err));
    console.error('   Error details:', JSON.stringify(err, null, 2));
  }
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
const proposalRBACRouter = require("./routers/proposalRoutesRBAC"); 
const rataRoutes = require("./routers/RATARoutes");
const regionRouter = require("./routers/RegionRoutes");
const settings = require("./routers/settingsRoutes");
const annexRouter = require("./routers/annex");
const personnelServicesAnnexesRoutes = require("./routers/ps_annexes");
const setupRouter = require("./routers/setupRoutes");
const organizationStructureRouter = require("./routers/OrganizationStructureRoutes");
const employeeCourtAppearanceRouter = require("./routers/employeeCourtAppearanceRoutes");
const subsistenceSTRouter = require("./routers/subsistenceAllowanceSTRoutes");
const overtimeRouter = require("./routers/overtimeRoutes");
const subsistenceAllowanceRouter = require("./routers/subsistenceAllowanceMDSRoutes");
const subsistenceAllowanceGeneralRouter = require("./routers/subsistenceAllowanceRoutes");
const loyaltyPayRouter = require("./routers/loyaltyPayRoutes");
const reportsRouter = require("./routers/reports.routes");
const cosPersonnelRouter = require("./routers/cosPersonnelRoutes");
const proposalSummaryRoutes = require("./routers/proposalSummary");
const newProposalWorkflowRoutes = require("./routes/newProposalWorkflowRoutes");
const debugRoutes = require("./routers/debugRoutes");
const todoRouter = require("./routers/todo_router");
const eventsRouter = require("./routers/eventsRouter");

// UPLOADER ROUTERS
const chartOfAccountsRouter = require("./routers/uploader/chartOfAccounts");
const uploadcategories = require("./routers/uploader/categories");
const uploadstatus = require("./routers/uploader/statuses"); // Unified duplicate
const uploadregions = require("./routers/uploader/regions");
const uploaddepartments = require("./routers/uploader/departments");
const uploadpositions = require("./routers/uploader/positionTitles");
const uploadsalaries = require("./routers/uploader/salaryGrades");
const uploadratas = require("./routers/uploader/ratas");

// ADDITIONAL ROUTERS
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
const isAuth = require("./middleware/is_auth");
const authRouter = require("./routers/auth_router");
const enforceOrgAccess = require("./middleware/enforceOrgAccess");
const income_categories = require("./routers/income_categories");
const myProposalsRoutes = require("./routes/myProposalsRoutes");
const budgetManagerOrgRoutes = require("./routers/BudgetManagerOrgRoutes");
const hierarchicalRBACRoutes = require("./routers/hierarchicalRBACRoutes");

// Database Trigger Connection
connectMongo();
require("./models/UserOrganizationalAssignment");

mongoose.connection.once("open", async () => {
  await ensureDatabaseIndexes(mongoose, logger);
  try {
    await initAgenda({ mongoConnection: mongoose.connection });
    initializeCleanupScheduler();
    await initializeScheduledJobs();
  } catch (e) {
    console.error("Failed to initialize schedulers:", e.stack || e);
  }
});

const app = express();
app.set('trust proxy', 1); // Trust Nginx / Load Balancer proxy

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

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
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

      console.warn("CORS: Origin blocked:", origin);
      return callback(new Error('Not allowed by CORS'), false); // Properly throw a CORS error
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", "Authorization", "X-CSRF-Token", "X-Workflow-Ref",
      "X-Dev-User-Id", "X-Dev-Roles", "X-Requested-With", "X-User-Object",
      "X-Reauth-Password", "X-Reauth-User",
    ],
    optionsSuccessStatus: 204,
    exposedHeaders: ["X-Auth-Token"],
  }),
);

// Express Standard Parsers & Security Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize()); // Prevent NoSQL Injections

const { securityHeaders, permissionsPolicy } = require('./middleware/security');
app.use(securityHeaders);
app.use(permissionsPolicy);

// Gzip Compression
try {
  const compression = require('compression');
  app.use(compression({ threshold: 1024 }));
} catch (e) {
  console.warn("[Server] Optional compression package is missing.");
}

// Rate Limiting & Audit Logging
const { apiLimiter, authLimiter, uploadLimiter, proposalLimiter } = require('./middleware/rateLimiter');
app.use(`${apiPrefix}/`, apiLimiter);

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

// CSRF Handling Layer
const csurf = require('csurf');
const csrfCookieOptions = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
};
if (process.env.COOKIE_DOMAIN) csrfCookieOptions.domain = process.env.COOKIE_DOMAIN;
const _csrfProtection = csurf({ cookie: csrfCookieOptions });

app.use((req, res, next) => {
  if (req.path.startsWith(apiPrefix)) return next();
  const exemptPaths = ["/login", "/webhook", "/health"];
  if (exemptPaths.includes(req.path)) return next();
  return _csrfProtection(req, res, next);
});

app.get(`${apiPrefix}/csrf-token`, (_req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
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

app.get(`${apiPrefix}/compensation`, async (req, res) => {
  try {
    const CompensationSettings = require("./models/CompensationSettings");
    const Settings = require("./models/Settings");
    const compensations = await CompensationSettings.find().sort({ createdAt: -1 });

    const enrichedCompensations = await Promise.all(
      compensations.map(async (compensation) => {
        const linkedSettings = await Settings.find({ compensationSettingsId: compensation._id }).select("_id fiscalYear budgetType");
        const linkedFiscalYears = linkedSettings.map((setting) => setting._id);
        const linkedBudgetTypes = linkedSettings.map((setting) => setting.budgetType).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

        return {
          ...compensation.toObject(),
          linkedFiscalYears,
          linkedBudgetTypes,
          linkedCount: linkedFiscalYears.length,
        };
      })
    );
    res.status(200).json({ message: "Compensation settings retrieved successfully", count: enrichedCompensations.length, compensationSettings: enrichedCompensations });
  } catch (error) {
    console.error("Error in getCompensationSettings:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get(`${apiPrefix}/excel-upload/template`, isAuth, async (req, res) => {
  try {
    const userAccess = req.user?.hierarchicalAccess || {};
    const { scope = "REGION", accessibleDepartments = [], accessibleDivisions = [], accessibleSections = [] } = userAccess;
    const region = req.query.region || req.user?.region || "";
    const { generateEmployeeTemplate } = require("./utils/employeeTemplateGenerator");

    const templateBuffer = generateEmployeeTemplate({
      region, fiscalYear: "", scope, accessibleDepartments, accessibleDivisions, accessibleSections
    });

    const fileName = `employee_import_template_${region || "authenticated"}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(templateBuffer);
  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({ error: "Error generating template", details: error.message });
  }
});

app.get(`${apiPrefix}/test`, (req, res) => {
  res.json({ message: "Server is working without MongoDB!", timestamp: new Date(), status: "OK" });
});

// GLOBAL ORGANIZATIONAL ENFORCEMENT INTERCEPTOR
app.use((req, res, next) => {
  try {
    if (req.method === "GET" || req.method === "OPTIONS") {
      if (req.path === `${apiPrefix}/compensation`) return next();
      return next();
    }
    const p = (req.path || "").toLowerCase();
    if (p.startsWith(`${apiPrefix}/hierarchical-rbac/assignments`)) return next();
    return isAuth(req, res, () => enforceOrgAccess(req, res, next));
  } catch (e) {
    return res.status(500).json({ message: "Server error during access enforcement" });
  }
});

// PROTECTED STATIC FILE SERVING
app.use("/uploads", isAuth, express.static(path.join(__dirname, "uploads")));

// ENDPOINT / ROUTER MOUNTING
app.use(apiPrefix, authRouter);
app.use(apiPrefix, employeeRouter);
app.use(apiPrefix, statusRouter);
app.use(apiPrefix, salaryRouter);
app.use(`${apiPrefix}/cpcs-salary`, cpcsSalaryRoutes);
app.use(`${apiPrefix}/cos-salary`, cosSalaryRoutes);
app.use(apiPrefix, personnelRoutes);
app.use(apiPrefix, positionTitleRoutes);
app.use(apiPrefix, attachWorkflowRef, mooeRoutes);
app.use(apiPrefix, fiscalYearRoutes);
app.use(apiPrefix, departmentRouter);
app.use(apiPrefix, require("./routers/personnelParamsRoutes")); // Mounted BEFORE personnelServicesRouter
app.use(apiPrefix, attachWorkflowRef, personnelServicesRouter);
app.use(apiPrefix, excelUploadRouter);
app.use(`${apiPrefix}/capitaloutlay`, capitalOutlayExcelUploadRoutes);
app.use(apiPrefix, attachWorkflowRef, capitalOutlayRouter);
app.use(apiPrefix, capitalOutlayDetailsRouter);
app.use(apiPrefix, categoryRouter);
app.use(apiPrefix, proposalRBACRouter);

const { comparisonRouter } = require("./routers/budgetOfficerEditRoutes");
app.use(`${apiPrefix}/budget-officer-edits`, comparisonRouter);
app.use(`${apiPrefix}/budget-officer-edits`, budgetOfficerEditRouter);
app.use(`${apiPrefix}/my-proposals`, myProposalsRoutes);
app.use(`${apiPrefix}/workflow`, require("./routers/proposalWorkflowRoutes"));
app.use(`${apiPrefix}/workflow-templates`, require("./routers/workflowTemplateRoutes"));
app.use(`${apiPrefix}/submission-workflow`, require("./routers/submissionWorkflowRoutes"));
app.use(`${apiPrefix}/status-workflow`, require("./routers/statusWorkflowRoutes"));
app.use(apiPrefix, require("./routers/notificationRoutes"));
app.use(`${apiPrefix}/tier-comparison`, require("./routers/tierComparisonRoutes"));
app.use(`${apiPrefix}/budget-ceiling`, require("./routers/budgetCeilingRoutes"));
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
app.use(`${apiPrefix}/reports`, reportsRouter);
app.use(apiPrefix, cosPersonnelRouter);
app.use(`${apiPrefix}/proposalSummary`, proposalSummaryRoutes);
app.use(`${apiPrefix}/allproposal`, logWorkflowAction, newProposalWorkflowRoutes);
app.use(`${apiPrefix}`, require('./routers/commentRoutes'));

if (process.env.DEBUG_MODE === "true" || process.env.ALLOW_MOCK_AUTH === "true") {
  app.use(`${apiPrefix}/debug`, debugRoutes);
}

// Uploader Mounted Endpoints
app.use(apiPrefix, chartOfAccountsRouter);
app.use(apiPrefix, uploadcategories);
app.use(apiPrefix, uploadstatus);
app.use(apiPrefix, uploadregions);
app.use(apiPrefix, uploaddepartments);
app.use(apiPrefix, uploadpositions);
app.use(apiPrefix, uploadsalaries);
app.use(apiPrefix, uploadratas);
app.use(apiPrefix, mealAllowance);
app.use(apiPrefix, incomeCategoryRouter);
app.use(apiPrefix, incomeCategoryGroupRouter);
app.use(apiPrefix, incomeSubcategoryRouter);
app.use(apiPrefix, incomeSubcategoryRoutes);
app.use(`${apiPrefix}/stats`, statsRouter);
app.use(apiPrefix, childrenAllowance);
app.use(`${apiPrefix}/export`, exportRoutes);
app.use(`${apiPrefix}/personnel-services-pdf`, personnelServicesPDFRouter);
app.use(apiPrefix, medicalAllowanceRouter);

// CRITICAL FIX: Fixed namespace collision for endpoints using /income prefix
app.use(apiPrefix, attachWorkflowRef, incomeRouter);
app.use(apiPrefix, income_categories);
app.use(`${apiPrefix}/income-upload`, incomeExcelUploadRouter); // Remapped endpoint wrapper prefix
app.use(`${apiPrefix}/mooe-upload`, excelUploadRouter); // Remapped endpoint wrapper prefix

app.use(`${apiPrefix}/consolidated-reports`, consolidatedReportsRouter);
app.use(`${apiPrefix}/consolidated-reports`, consolidatedCapitalOutlayRouter);
app.use(`${apiPrefix}/consolidated-reports`, consolidatedPersonnelServicesRouter);
app.use(`${apiPrefix}/comprehensive-reports`, comprehensiveReportsRouter);
app.use(`${apiPrefix}/database-backup`, databaseBackupRouter);
app.use(`${apiPrefix}/discount-settings`, discountSettingsRouter);
app.use(apiPrefix, retireeRouter);
app.use(apiPrefix, budgetarySupportRoutes);
app.use(`${apiPrefix}/tier`, tierRoutes);
app.use(apiPrefix, chartOfAccountsCRUDRouter);
app.use(apiPrefix, titleMappingRouter);
app.use(`${apiPrefix}/chat`, require("./routers/chatRoutes"));
app.use(apiPrefix, require("./routers/UserProfileRoutes"));
app.use(`${apiPrefix}/user`, require("./routers/userPreferencesRoutes"));
app.use(`${apiPrefix}/user-activity-logs`, require("./routers/userActivityLogRoutes"));
app.use(apiPrefix, budgetManagerOrgRoutes);
app.use(`${apiPrefix}/hierarchical-rbac`, hierarchicalRBACRoutes);
app.use(apiPrefix, employeeMasterRouter);

let isShuttingDown = false;

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

// Server Execution Setup
const PORT = process.env.APP_PORT || process.env.PORT || 5005;

if (require.main === module) {
  server.listen(PORT, () => {
    initializeBackupSystem();
    console.log(`🚀 FMIS - BUDGET IS UP AND RUNNING :: ${PORT}`);
  });
}

module.exports = { app, server };