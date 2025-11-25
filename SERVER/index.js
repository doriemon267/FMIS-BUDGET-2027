require("dotenv").config();
// If DEP0123 or other warnings are listed in SUPPRESS_NODE_DEPRECATION_WARNINGS,
// set process.noDeprecation = true as early as possible to suppress Node deprecation warnings.
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || '').split(',').map(s => s && s.trim()).filter(Boolean);
if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  try {
    // Setting this suppresses Node runtime deprecation warnings globally (same as --no-deprecation)
    process.noDeprecation = true;
    console.log('[Server] process.noDeprecation enabled via SUPPRESS_NODE_DEPRECATION_WARNINGS.');
  } catch (e) {
    // ignore if not settable
  }
}
// Optional: suppress specific Node deprecation warnings (comma-separated list of codes)
const SUPPRESS_NODE_DEPRECATION_WARNINGS = (process.env.SUPPRESS_NODE_DEPRECATION_WARNINGS || '').split(',').map(s => s && s.trim()).filter(Boolean);
if (SUPPRESS_NODE_DEPRECATION_WARNINGS.length > 0) {
  // Listen for 'warning' event and drop matching codes
  process.on('warning', (warning) => {
    try {
      const code = warning.code || warning.name || '';
      if (!SUPPRESS_NODE_DEPRECATION_WARNINGS.includes(code)) {
        // Print other warnings
        console.warn(warning.name + ': ' + warning.message + '\n' + (warning.stack || ''));
      }
      // Otherwise drop the warning entirely
    } catch (e) {
      // If handling fails, print the warning normally
      console.warn(warning);
    }
  });
}
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
  debug: console.debug
};

// Replace console methods with combined redaction + debug filtering
const shouldRedact = process.env.REDACT_LOGS === 'true';
const debugMode = process.env.DEBUG_MODE === 'true';

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
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const personnelRoutes = require("./routers/personnel");
const positionTitleRoutes = require("./routers/PositionTitle");
const departmentRouter = require("./routers/Department");
const employeeRouter = require("./routers/employeeListRoutes");
const statusRouter = require("./routers/Status");
const salaryRouter = require("./routers/salaryRoutes");
const mooeRoutes = require('./routers/mooeRoutes');
const fiscalYearRoutes = require("./routers/fiscalYearRoutes");
const personnelServicesRouter = require("./routers/personnelServices_router");
const excelUploadRouter = require("./routers/excelUpload");
const capitalOutlayRouter = require("./routers/capitalOutlayRouter");
const capitalOutlayDetailsRouter = require("./routers/capitalOutlayDetailsRouter");
const categoryRouter = require("./routers/category");
// const proposalRouter = require("./routers/proposalRoutes");  // DISABLED - Using RBAC router instead
const proposalRBACRouter = require("./routers/proposalRoutesRBAC");  // ✅ RBAC router with role-based visibility control
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
const mssqlRoutes = require('./routers/mssqlRoutes');
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
const mealAllowance = require("./routers/mealAllowanceRoutes")
const incomeCategoryRouter = require("./routers/incomeCategoryRoutes")
const incomeCategoryGroupRouter = require("./routers/incomeCategoryGroupRoutes")
const incomeSubcategoryRouter = require("./routers/incomeSubcategoryRoutes")
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
const checkToken = require('./middleware/checkToken');
const enforceOrgAccess = require('./middleware/enforceOrgAccess');
const { initializeCleanupScheduler } = require("./utils/backupCleanup");
const { initializeBackupSystem } = require("./backup-scripts/initBackupSystem");
const income_categories = require("./routers/income_categories");
const authRouter = require("./routers/AuthRoutes");
const myProposalsRoutes = require("./routes/myProposalsRoutes");
require("./config/mongo_db")();
// Fix database index for region isolation
const mongoose = require('mongoose');
// Load UserOrganizationalAssignment model to ensure it's registered with mongoose
require('./models/UserOrganizationalAssignment');
mongoose.connection.once('open', async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('mooeproposals');
    // Check if old problematic index exists
    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some(idx =>
      idx.key &&
      idx.key.uacsCode === 1 &&
      idx.key.fiscalYear === 1 &&
      !idx.key.region
    );
    if (hasOldIndex) {
      try {
        await collection.dropIndex({ uacsCode: 1, fiscalYear: 1 });
        } catch (error) {
        }
    }
    // Ensure new index with region exists
    try {
      await collection.createIndex(
        { uacsCode: 1, fiscalYear: 1, region: 1 },
        { unique: true, background: true }
      );
      } catch (error) {
      if (error.code !== 85) { // 85 = index already exists
        }
    }
  // Ensure Settings collection has compound unique index (fiscalYear, budgetType) and drop old unique FY index if present
  try {
    const settingsCol = mongoose.connection.db.collection('settings');
    const settingsIndexes = await settingsCol.indexes();
    const hasUniqueFYOnly = settingsIndexes.some(idx => idx.key && idx.key.fiscalYear === 1 && idx.unique && !idx.key.budgetType);
    if (hasUniqueFYOnly) {
      try {
        await settingsCol.dropIndex('fiscalYear_1');
        } catch (e) {
        }
    }
    try {
      await settingsCol.createIndex({ fiscalYear: 1, budgetType: 1 }, { unique: true, background: true });
    } catch (e) {
      if (e.code !== 85) {
        }
    }
  } catch (e) {
    }
  } catch (error) {
    // Database index check failed
  }
});
const app = express();
// Attach workflowRef middleware early so body gets populated before routers
const attachWorkflowRef = require('./middleware/attachWorkflowRef');
const server = http.createServer(app);
// Socket.IO setup with explicit allowed origins (separate from Express CORS)
const allowedSocketOrigins = [
  process.env.CLIENT1,
  process.env.CLIENT2,
  process.env.CLIENT3,
  'http://localhost:3005',
  'https://localhost:3005',
  'http://localhost:3006',
  'https://localhost:3006'
].filter(Boolean);

const io = socketIo(server, {
  cors: {
    origin: allowedSocketOrigins,
    methods: ["GET", "POST"],
    credentials: true
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
  })
);
// Increase payload limits for export functionality
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
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
    console.log('TEMP: Template download requested by authenticated user');

    // Get user's actual access information from JWT
    const userAccess = req.user?.hierarchicalAccess || {};
    const {
      scope = 'REGION',
      accessibleDepartments = [],
      accessibleDivisions = [],
      accessibleSections = []
    } = userAccess;

    // Get active region from user or query params
    const region = req.query.region || req.user?.region || '';

    console.log('User access scope:', scope);
    console.log('User accessible departments:', accessibleDepartments);
    console.log('User accessible divisions:', accessibleDivisions);
    console.log('User accessible sections:', accessibleSections);
    console.log('Region:', region);

    // Generate the template with user's actual hierarchical access
    const { generateEmployeeTemplate } = require('./utils/employeeTemplateGenerator');
    const templateBuffer = generateEmployeeTemplate({
      region: region,
      fiscalYear: '',
      scope,
      accessibleDepartments,
      accessibleDivisions,
      accessibleSections
    });

    console.log('Template generated successfully, size:', templateBuffer.length);

    // Set headers for file download
    const fileName = `employee_import_template_${region || 'authenticated'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send the file
    res.send(templateBuffer);

  } catch (error) {
    console.error("Error generating template:", error);
    res.status(500).json({
      error: "Error generating template",
      details: error.message
    });
  }
});

// Test endpoint without MongoDB
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is working without MongoDB!',
    timestamp: new Date(),
    status: 'OK',
    note: 'MongoDB temporarily disabled due to authentication issues'
  });
});
// Test router removed for production security
// Global organizational enforcement for all mutating routes (non-GET)
app.use((req, res, next) => {
  try {
    if (req.method === 'GET') {
      // Allow GET requests to compensation settings for the management page
      if (req.path === '/compensation') return next();
      return next();
    }
    // Skip enforcement for hierarchical assignment management endpoints
    const p = (req.path || '').toLowerCase();
    if (p.startsWith('/api/hierarchical-rbac/assignments')) {
      return next();
    }
    // Ensure user is authenticated before enforcing org access
    return checkToken(req, res, () => enforceOrgAccess(req, res, next));
  } catch (e) {
    // Global org enforcement error
    return res.status(500).json({ message: 'Server error during access enforcement' });
  }
});
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
app.use('/api', proposalRBACRouter);  // ✅ RBAC router with role-based visibility control
// Budget Officer Edit Routes
const { comparisonRouter } = require("./routers/budgetOfficerEditRoutes");
app.use('/api/budget-officer-edits', comparisonRouter);
app.use('/api/budget-officer-edits', budgetOfficerEditRouter);
// My Proposals Routes (for role-based proposal listing)
app.use('/api/my-proposals', myProposalsRoutes);
// Workflow-specific endpoints
app.use('/api/workflow', require('./routers/proposalWorkflowRoutes'));
// 🔄 Submission Workflow Routes - Controls data visibility based on submission status
const submissionWorkflowRoutes = require('./routers/submissionWorkflowRoutes');
app.use('/api/submission-workflow', submissionWorkflowRoutes);
// 🔄 Status Workflow Routes - Legacy workflow compatibility
const statusWorkflowRoutes = require('./routers/statusWorkflowRoutes');
app.use('/api/status-workflow', statusWorkflowRoutes);
// In-app notifications
app.use('/api', require('./routers/notificationRoutes'));
app.use(rataRoutes);
app.use(settings);
app.use("/api", regionRouter);
app.use(annexRouter);
app.use(personnelServicesAnnexesRoutes);
app.use(setupRouter);
app.use(employeeCourtAppearanceRouter);
app.use(overtimeRouter);
app.use(subsistenceAllowanceRouter);
app.use(iasOMCostRouter);
app.use(subsistenceSTRouter);
app.use(loyaltyPayRouter);
app.use('/reports', reportsRouter); // Mount with /reports prefix
app.use(cosPersonnelRouter);
app.use('/', mooeRoutes);
app.use('/api/proposalSummary', proposalSummaryRoutes);
app.use('/api/allproposal', newProposalWorkflowRoutes);
// MSSQL routes (optional): mount when MSSQL is configured
app.use('/api/mssql', mssqlRoutes);
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
app.use(chartOfAccountsCRUDRouter);
app.use(titleMappingRouter);
// Legacy user-region and organizational assignment routers removed in favor of hierarchical RBAC
// const userRegionAssignmentRouter = require('./routers/UserRegionAssignmentRoutes');
// app.use("/api", userRegionAssignmentRouter);
// const userOrgAssignmentRouter = require('./routers/UserOrganizationalAssignmentRoutes');
// app.use(userOrgAssignmentRouter);
const userProfileRouter = require('./routers/UserProfileRoutes');
app.use("/api", userProfileRouter);
const budgetManagerOrgRoutes = require('./routers/budgetManagerOrgRoutes');
app.use(budgetManagerOrgRoutes);
// 🏢 Hierarchical RBAC Routes - Enhanced organizational access control with Division → Department → Region consolidation
const hierarchicalRBACRoutes = require('./routers/hierarchicalRBACRoutes');
app.use("/api/hierarchical-rbac", hierarchicalRBACRoutes);
// Test routes removed for production security
// Register employee master router
app.use(employeeMasterRouter);
const mooeExcelUploadRouter = require("./routers/mooeExcelUploadRoutes");
app.use("/income", mooeExcelUploadRouter); // Mount under /income prefix for MOOE upload

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user-specific room for targeted updates
  socket.on('join-user-room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  });

  // Join admin room for broadcasting permission updates
  socket.on('join-admin-room', () => {
    socket.join('admin_room');
    console.log('User joined admin room');
  });

  // Handle permission updates
  socket.on('permission-updated', (data) => {
    console.log('Permission update received:', data);
    
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
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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

