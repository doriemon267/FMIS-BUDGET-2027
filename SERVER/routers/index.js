const express = require('express');
const masterRouter = express.Router();

const attachWorkflowRef = require("../middleware/attachWorkflowRef");
const { logWorkflowAction } = require("../middleware/auditLogger");

// ROUTE IMPORTS
const personnelRoutes = require("./personnel");
const positionTitleRoutes = require("./positionTitleRoutes");
const departmentRouter = require("./departmentRoutes");
const employeeRouter = require("./employeeListRoutes");
const statusRouter = require("./statusRoutes");
const salaryRouter = require("./salaryRoutes");
const cpcsSalaryRoutes = require("./cpcsSalaryRoutes");
const cosSalaryRoutes = require("./cosSalaryRoutes");
const mooeRoutes = require("./mooeRoutes");
const fiscalYearRoutes = require("./fiscalYearRoutes");
const personnelServicesRouter = require("./personnelServicesRouter");
const excelUploadRouter = require("./excelUpload");
const capitalOutlayRouter = require("./capitalOutlayRouter");
const capitalOutlayDetailsRouter = require("./capitalOutlayDetailsRouter");
const categoryRouter = require("./category");
const proposalRBACRouter = require("./proposalRoutesRBAC"); 
const rataRoutes = require("./rataRoutes");
const regionRouter = require("./regionRoutes");
const settings = require("./settingsRoutes");
const annexRouter = require("./annex");
const personnelServicesAnnexesRoutes = require("./psAnnexes");
const setupRouter = require("./setupRoutes");
const organizationStructureRouter = require("./organizationStructureRoutes");
const employeeCourtAppearanceRouter = require("./employeeCourtAppearanceRoutes");
const subsistenceSTRouter = require("./subsistenceAllowanceSTRoutes");
const overtimeRouter = require("./overtimeRoutes");
const subsistenceAllowanceRouter = require("./subsistenceAllowanceMDSRoutes");
const subsistenceAllowanceGeneralRouter = require("./subsistenceAllowanceRoutes");
const loyaltyPayRouter = require("./loyaltyPayRoutes");
const reportsRouter = require("./reportsRoutes");
const cosPersonnelRouter = require("./cosPersonnelRoutes");
const proposalSummaryRoutes = require("./proposalSummary");
const newProposalWorkflowRoutes = require("../routes/newProposalWorkflowRoutes");
const debugRoutes = require("./debugRoutes");
const todoRouter = require("./todoRouter");
const eventsRouter = require("./eventsRouter");
const compensationRoutes = require("./compensationRoutes");
const employeeTemplateRoutes = require("./employeeTemplateRoutes");

// UPLOADER ROUTERS
const chartOfAccountsRouter = require("./uploader/chartOfAccounts");
const uploadcategories = require("./uploader/categories");
const uploadstatus = require("./uploader/statuses"); 
const uploadregions = require("./uploader/regions");
const uploaddepartments = require("./uploader/departments");
const uploadpositions = require("./uploader/positionTitles");
const uploadsalaries = require("./uploader/salaryGrades");
const uploadratas = require("./uploader/ratas");

// ADDITIONAL ROUTERS
const mealAllowance = require("./mealAllowanceRoutes");
const incomeCategoryRouter = require("./incomeCategoryRoutes");
const incomeCategoryGroupRouter = require("./incomeCategoryGroupRoutes");
const incomeSubcategoryRouter = require("./incomeSubcategoryRoutes");
const incomeSubcategoryRoutes = require("./incomeSubcategories");
const statsRouter = require("./statsRoutes");
const childrenAllowance = require("./childrenAllowanceRoutes");
const exportRoutes = require("./exportRoutes");
const medicalAllowanceRouter = require("./medicalAllowanceRoutes");
const incomeRouter = require("./incomeRoutes");
const incomeExcelUploadRouter = require("./incomeExcelUploadRoutes");
const capitalOutlayExcelUploadRoutes = require("./capitalOutlayExcelUploadRoutes");
const mooeExcelUploadRoutes = require("./mooeExcelUploadRoutes");
const discountSettingsRouter = require("../routes/discountSettings");
const retireeRouter = require("./retireeRoutes");
const budgetarySupportRoutes = require("./budgetarySupportRoutes");
const tierRoutes = require("./tierRoutes");
const chartOfAccountsCRUDRouter = require("./chartOfAccountsRoutes");
const titleMappingRouter = require("./titleMappingRoutes");
const employeeMasterRouter = require("./employeeMasterRoutes");
const iasOMCostRouter = require("./iasOMCostRoutes");
const consolidatedReportsRouter = require("./consolidatedReportsRoutes");
const consolidatedCapitalOutlayRouter = require("./consolidatedCapitalOutlayRoutes");
const consolidatedPersonnelServicesRouter = require("./consolidatedPersonnelServicesRoutes");
const comprehensiveReportsRouter = require("./comprehensiveReportsRoutes");
const databaseBackupRouter = require("./databaseBackupRoutes");
const bulkUploadManagementRoutes = require("./bulkUploadManagementRoutes");
const budgetOfficerEditRouter = require("./budgetOfficerEditRoutes");
const personnelServicesPDFRouter = require("./personnelServicesPDFRoutes");
const authRouter = require("./authRouter");
const income_categories = require("./incomeCategories");
const myProposalsRoutes = require("../routes/myProposalsRoutes");
const budgetManagerOrgRoutes = require("./budgetManagerOrgRoutes");
const hierarchicalRBACRoutes = require("./hierarchicalRBACRoutes");
const proposalLockingRouter = require("./proposalLockingRouter");
const routePermissionRouter = require("./routePermissionRouter");
const personnelParamsRoutes = require("./personnelParamsRoutes");
const proposalWorkflowRoutes = require("./proposalWorkflowRoutes");
const workflowTemplateRoutes = require("./workflowTemplateRoutes");
const submissionWorkflowRoutes = require("./submissionWorkflowRoutes");
const statusWorkflowRoutes = require("./statusWorkflowRoutes");
const notificationRoutes = require("./notificationRoutes");
const tierComparisonRoutes = require("./tierComparisonRoutes");
const budgetCeilingRoutes = require("./budgetCeilingRoutes");
const commentRoutes = require('./commentRoutes');
const chatRoutes = require("./chatRoutes");
const userProfileRoutes = require("./userProfileRoutes");
const userPreferencesRoutes = require("./userPreferencesRoutes");
const userActivityLogRoutes = require("./userActivityLogRoutes");

// ENDPOINT / ROUTER MOUNTING
masterRouter.use("/", authRouter);
masterRouter.use("/", employeeRouter);
masterRouter.use("/", statusRouter);
masterRouter.use("/", salaryRouter);
masterRouter.use(`/cpcs-salary`, cpcsSalaryRoutes);
masterRouter.use(`/cos-salary`, cosSalaryRoutes);
masterRouter.use("/", personnelRoutes);
masterRouter.use("/", positionTitleRoutes);
masterRouter.use("/", attachWorkflowRef, mooeRoutes);
masterRouter.use("/", fiscalYearRoutes);
masterRouter.use("/", departmentRouter);
masterRouter.use("/", personnelParamsRoutes); // Mounted BEFORE personnelServicesRouter
masterRouter.use("/", attachWorkflowRef, personnelServicesRouter);
masterRouter.use("/", excelUploadRouter);
masterRouter.use(`/capitaloutlay`, capitalOutlayExcelUploadRoutes);
masterRouter.use("/", attachWorkflowRef, capitalOutlayRouter);
masterRouter.use("/", capitalOutlayDetailsRouter);
masterRouter.use("/", categoryRouter);
masterRouter.use("/", proposalRBACRouter);

const { comparisonRouter } = require("./budgetOfficerEditRoutes");
masterRouter.use(`/budget-officer-edits`, comparisonRouter);
masterRouter.use(`/budget-officer-edits`, budgetOfficerEditRouter);
masterRouter.use(`/my-proposals`, myProposalsRoutes);
masterRouter.use(`/workflow`, proposalWorkflowRoutes);
masterRouter.use(`/workflow-templates`, workflowTemplateRoutes);
masterRouter.use(`/submission-workflow`, submissionWorkflowRoutes);
masterRouter.use(`/status-workflow`, statusWorkflowRoutes);
masterRouter.use("/", notificationRoutes);
masterRouter.use(`/tier-comparison`, tierComparisonRoutes);
masterRouter.use(`/budget-ceiling`, budgetCeilingRoutes);
masterRouter.use("/", rataRoutes);
masterRouter.use("/", settings);
masterRouter.use(`/regions`, regionRouter);
masterRouter.use("/", todoRouter);
masterRouter.use(`/events`, eventsRouter);
masterRouter.use("/", annexRouter);
masterRouter.use("/", personnelServicesAnnexesRoutes);
masterRouter.use("/", setupRouter);
masterRouter.use(`/organization-structure`, organizationStructureRouter);
masterRouter.use("/", employeeCourtAppearanceRouter);
masterRouter.use("/", overtimeRouter);
masterRouter.use("/", subsistenceAllowanceRouter);
masterRouter.use("/", subsistenceAllowanceGeneralRouter);
masterRouter.use("/", iasOMCostRouter);
masterRouter.use("/", subsistenceSTRouter);
masterRouter.use("/", loyaltyPayRouter);
masterRouter.use(`/reports`, reportsRouter);
masterRouter.use("/", cosPersonnelRouter);
masterRouter.use(`/proposalSummary`, proposalSummaryRoutes);
masterRouter.use(`/allproposal`, logWorkflowAction, newProposalWorkflowRoutes);
masterRouter.use(`/`, commentRoutes);
masterRouter.use(`/compensation`, compensationRoutes);
masterRouter.use(`/excel-upload/template`, employeeTemplateRoutes);

if (process.env.DEBUG_MODE === "true" || process.env.ALLOW_MOCK_AUTH === "true") {
  masterRouter.use(`/debug`, debugRoutes);
}

// Uploader Mounted Endpoints
masterRouter.use("/", chartOfAccountsRouter);
masterRouter.use("/", uploadcategories);
masterRouter.use("/", uploadstatus);
masterRouter.use("/", uploadregions);
masterRouter.use("/", uploaddepartments);
masterRouter.use("/", uploadpositions);
masterRouter.use("/", uploadsalaries);
masterRouter.use("/", uploadratas);
masterRouter.use("/", mealAllowance);
masterRouter.use("/", incomeCategoryRouter);
masterRouter.use("/", incomeCategoryGroupRouter);
masterRouter.use("/", incomeSubcategoryRouter);
masterRouter.use("/", incomeSubcategoryRoutes);
masterRouter.use(`/stats`, statsRouter);
masterRouter.use("/", childrenAllowance);
masterRouter.use(`/export`, exportRoutes);
masterRouter.use(`/personnel-services-pdf`, personnelServicesPDFRouter);
masterRouter.use("/", medicalAllowanceRouter);

// CRITICAL FIX: Fixed namespace collision for endpoints using /income prefix
masterRouter.use("/", attachWorkflowRef, incomeRouter);
masterRouter.use("/", income_categories);
masterRouter.use(`/income`, attachWorkflowRef, incomeExcelUploadRouter); // Remapped endpoint wrapper prefix
masterRouter.use(`/income`, attachWorkflowRef, mooeExcelUploadRoutes);
masterRouter.use(`/mooe-upload`, excelUploadRouter); // Keep for legacy if any, but re-evaluate later

masterRouter.use(`/consolidated-reports`, consolidatedReportsRouter);
masterRouter.use(`/consolidated-reports`, consolidatedCapitalOutlayRouter);
masterRouter.use(`/consolidated-reports`, consolidatedPersonnelServicesRouter);
masterRouter.use(`/comprehensive-reports`, comprehensiveReportsRouter);
masterRouter.use(`/database-backup`, databaseBackupRouter);
masterRouter.use(`/bulk-upload-management`, bulkUploadManagementRoutes);
masterRouter.use(`/discount-settings`, discountSettingsRouter);
masterRouter.use("/", retireeRouter);
masterRouter.use("/", budgetarySupportRoutes);
masterRouter.use(`/tier`, tierRoutes);
masterRouter.use("/", chartOfAccountsCRUDRouter);
masterRouter.use("/", titleMappingRouter);
masterRouter.use(`/chat`, chatRoutes);
masterRouter.use("/", userProfileRoutes);
masterRouter.use(`/user`, userPreferencesRoutes);
masterRouter.use(`/user-activity-logs`, userActivityLogRoutes);
masterRouter.use("/", budgetManagerOrgRoutes);
masterRouter.use(`/hierarchical-rbac`, hierarchicalRBACRoutes);
masterRouter.use("/", employeeMasterRouter);
masterRouter.use(`/proposals`, proposalLockingRouter);
masterRouter.use("/", routePermissionRouter);

module.exports = masterRouter;
