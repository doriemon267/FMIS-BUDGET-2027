require("dotenv").config();
// Silence server console output by default. Opt-in logs via ALLOW_SERVER_LOGS=true
(() => {
  try {
    const allow = process.env.ALLOW_SERVER_LOGS === 'true';
    if (allow) return;
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
  } catch (_) {}
})();
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
const personnelServicesRouter = require("./routers/personnelServicesRoutes");
const excelUploadRouter = require("./routers/excelUpload");
const capitalOutlayRouter = require("./routers/capitalOutlayRouter");
const capitalOutlayDetailsRouter = require("./routers/capitalOutlayDetailsRouter");
const categoryRouter = require("./routers/category");
const proposalRouter = require("./routers/proposalRoutes");
const proposalRBACRouter = require("./routers/proposalRoutesRBAC");
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
const checkToken = require('./middleware/checkToken');
const enforceOrgAccess = require('./middleware/enforceOrgAccess');
const { initializeCleanupScheduler } = require("./utils/backupCleanup");
const { initializeBackupSystem } = require("./backup-scripts/initBackupSystem");
const income_categories = require("./routers/income_categories");
require("./config/mongo_db")();
// Fix database index for region isolation
const mongoose = require('mongoose');
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
    if (req.method === 'GET') return next();
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
app.use(personnelRoutes);
//Position Title Routes
app.use(positionTitleRoutes);
app.use(mooeRoutes);
app.use(fiscalYearRoutes);
//Department Title Routes
app.use(departmentRouter);
app.use(personnelServicesRouter);
app.use("/api", excelUploadRouter); // Excel Upload Route
app.use(capitalOutlayRouter);
app.use("/api", capitalOutlayDetailsRouter);
app.use(categoryRouter);
app.use(proposalRouter);
app.use(proposalRBACRouter);
// Workflow-specific endpoints
app.use('/api/workflow', require('./routers/proposalWorkflowRoutes'));
// 🔄 Submission Workflow Routes - Controls data visibility based on submission status
const submissionWorkflowRoutes = require('./routers/submissionWorkflowRoutes');
app.use('/api/submission-workflow', submissionWorkflowRoutes);
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
app.use(proposalSummaryRoutes);
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
app.use(incomeSubcategoryRouter);
app.use(incomeSubcategoryRoutes);
app.use("/stats", statsRouter);
app.use(childrenAllowance);
app.use("/api/export", exportRoutes);
app.use(medicalAllowanceRouter);
app.use(incomeRouter);
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
// Keep the original routers
app.use(require("./routers/personnelServicesRoutes"));
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

server.listen(process.env.APP_PORT, () => {
  // Initialize backup system
  initializeBackupSystem();
  // Initialize backup cleanup scheduler
  setTimeout(() => {
    initializeCleanupScheduler();
    }, 5000); // Wait 5 seconds for database connection to be established
  // Only log if logs are allowed
  if (process.env.ALLOW_SERVER_LOGS === 'true') {
    console.log("🚀", "FMIS - BUDGET IS UP AND RUNNING :: 5005");
  }
  return null;
});

