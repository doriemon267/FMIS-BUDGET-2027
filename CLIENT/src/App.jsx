import React from "react";
import { Route, Routes } from "react-router-dom";
import UserProvider from "./context/UserContext";
import { RegionProvider } from "./context/RegionContext";
import { RoutePermissionProvider } from "./context/RoutePermissionContext";
import Dashboard from "./layout/Dashboard";
import RootRedirect from "./components/RootRedirect";
import AccessGuard from "./components/guards/AccessGuard";
import DashBoardHome from "./pages/DashBoard";
import Proposals from "./pages/Proposals";
import ProposalPage from "./pages/MyProposalPage";
import EmployeeList from "./pages/EmployeeList";
import FiscalYear from "./pages/FiscalPage";
import Categories from "./pages/CategoryPage";
import RataPage from "./pages/RataPage";
import SettingsManagement from "./pages/SettingsPage";
import AnnexPage from "./pages/PS_AnnexesPage";
import SetupPage from "./pages/SetupPage";
import EmployeeCourtAppearancePage from "./pages/CourtAppearancePage";
import OvertimePayDialog from "./pages/EmployeeOvertimePayPage";
import SubsistenceAllowanceMDSPage from "./pages/SubsistenceAllowanceMDSPage";
import SubsistenceAllowanceSTPage from "./pages/SubsistenceAllowanceSTPage";
import SubsistenceAllowancePage from "./pages/SubsistenceAllowancePage";
import LoyaltyPayPage from "./pages/LoyaltyPayPage";
import AppearancePage from "./pages/AppearancePage";
import AllProposalsPage from "./pages/AllProposalsPage";
import ProtectedRoute from "./middleware/ProtectedRoute";
import NotAuthorized from "./pages/NotAuthorizedPage";
import ProposalSummaryPage from "./pages/ProposalSummaryPage";
import FiscalYearSettingsPage from "./pages/FiscalYearSettingsPage";
import CompensationManagementPage from "./pages/CompensationManagementPage";
//import UploaderPage from "./pages/TestPage";
import MealAllowancePage from "./pages/MealAllowancePage";
import MedicalAllowancePage from "./pages/MedicalAllowancePage";
import ChildrenAllowancePage from "./pages/ChildrenAllowancePage";
import IncomeManagementPage from "./pages/IncomeManagementPage";
import SalaryManagement from "./components/management/SalaryManagement";
import SalaryTablePage from "./pages/SalaryTablePage";
import EmployeeSalaryTablePage from "./pages/EmployeeSalaryTablePage";
import CosSalaryTablePage from "./pages/CosSalaryTablePage";
import GroupedIncomeCategoryPage from "./pages/GroupedIncomeCategoryPage";
import RetireePage from "./pages/RetireePage";

import SubsidyMonitoringPage from "./pages/SubsidyMonitoringPage";
import CapitalOutlayTitleMappingPage from "./pages/CategoryPage";
import RegionSelectionPage from "./pages/RegionSelectionPage";
import CorporateIncomeUploadPage from "./pages/CorporateIncomeUploadPage";
import BulkUploadManagementPage from "./pages/BulkUploadManagementPage";
import ConsolidatedCorporateIncomePage from "./pages/ConsolidatedCorporateIncomePage";
import MooeUploadPage from "./pages/MooeUploadPage";
import EmployeeBenefitsPage from "./pages/EmployeeBenefitsPage";
import ConsolidatedReportsPage from "./pages/ConsolidatedReportsPage";
import ConsolidatedCapitalOutlayReportsPage from "./components/reports/ConsolidatedCapitalOutlayReportsPage";
import ConsolidatedPersonnelServicesReportsPage from "./components/reports/ConsolidatedPersonnelServicesReportsPage";
import ComprehensiveReportsPage from "./components/reports/ComprehensiveReportsPage";
import DatabaseBackupPage from "./pages/DatabaseBackupPage";
import HierarchicalUserAssignmentPage from "./pages/HierarchicalUserAssignmentPage";
import OrganizationSetupPage from "./pages/OrganizationSetupPage";
import ProposalOperationsHub from "./pages/ProposalOperationsHub/ProposalOperationsHub";
import ProposalDetailsPage from "./components/workflow/ProposalDetailsPage";
import BRDConsolidationPage from "./pages/BRDConsolidationPage";
import TierComparisonPage from "./pages/TierComparisonPage";
import ComparativeReportPage from "./pages/ComparativeReportPage";
import NEPCeilingPage from "./pages/NEPCeilingPage";
import TierPage from "./pages/TierPage";
import UserActivityLogsPage from "./pages/UserActivityLogsPage";
import RoutePermissionManagementPage from "./pages/RoutePermissionManagementPage";
import NotFoundPage from "./pages/NotFoundPage";
import VerifyDocumentPage from "./pages/VerifyDocumentPage";
const App = () => {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/verify-document" element={<VerifyDocumentPage />} />
     

      <Route
        path="/"
        element={
          <UserProvider>
            <RoutePermissionProvider>
              <RegionProvider>
                <AccessGuard>
                  <Dashboard />
                </AccessGuard>
              </RegionProvider>
            </RoutePermissionProvider>
          </UserProvider>
        }
      >
        <Route path="/dashboard" element={<DashBoardHome />} />
        <Route
          path="/tier"
          element={
            <ProtectedRoute
              routeKey="/tier"
              requiredWorkflowRoles={["superAdmin"]}
            >
              <TierPage />
            </ProtectedRoute>
          }
        />
        <Route path="/proposal" element={<Proposals />} />
        {/* <Route
          path="/myProposals"
          element={
            <ProtectedRoute
              requiredPermissions={["EditOwnProposals"]}
              requiredWorkflowRoles={["divisionCreator", "departmentCreator", "regionCreator", "superAdmin"]}
            >
              <ProposalPage />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute
              routeKey="/employee"
              requiredPermissions={[]}
              requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}
            >
              <EmployeeList />
            </ProtectedRoute>
          }
        />
        <Route path="/fiscalYear" element={<FiscalYear />} />

        {/* Protected Routes */}
        <Route
          path="/categories"
          element={
            <ProtectedRoute
              routeKey="/categories"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rata"
          element={
            <ProtectedRoute
              routeKey="/rata"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <RataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fysettings"
          element={
            <ProtectedRoute
              routeKey="/fysettings"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <FiscalYearSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/compensation-management"
          element={
            <ProtectedRoute
              routeKey="/compensation-management"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <CompensationManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/route-permissions"
          element={
            <ProtectedRoute
              routeKey="/route-permissions"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["superAdmin"]}
            >
              <RoutePermissionManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute
              routeKey="/settings"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <SettingsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute 
              routeKey="/audit-logs"
              requiredWorkflowRoles={["superAdmin"]}
            >
              <UserActivityLogsPage />
            </ProtectedRoute>
          }
        />

        {/* <Route
          path="/AllProposals"
          element={
            <ProtectedRoute
              routeKey="/AllProposals"
              requiredPermissions={[]}
              requiredWorkflowRoles={["superAdmin", "preparer", "reviewer", "approver", "overallBudgetApprover", "budgetAnalyst"]}
            >
              <AllProposalsPage />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="/proposal-details/:proposalId"
          element={
            <ProtectedRoute
              routeKey="/proposal-details"
              requiredPermissions={[]}
              requiredWorkflowRoles={["superAdmin", "preparer", "reviewer", "approver", "overallBudgetApprover", "budgetAnalyst"]}
            >
              <ProposalDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/income-management"
          element={
            <ProtectedRoute
              routeKey="/income-management"
              requiredPermissions={["EditAllProposals"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <IncomeManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/salary-management"
          element={
            <ProtectedRoute
              routeKey="/salary-management"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <SalaryManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salary-table"
          element={
            <ProtectedRoute
              routeKey="/salary-table"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <EmployeeSalaryTablePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee-salary-table"
          element={
            <ProtectedRoute
              routeKey="/employee-salary-table"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <SalaryTablePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cos-salary-table"
          element={
            <ProtectedRoute
              routeKey="/cos-salary-table"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <CosSalaryTablePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/grouped-income-categories"
          element={
            <ProtectedRoute
              routeKey="/grouped-income-categories"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <GroupedIncomeCategoryPage />
            </ProtectedRoute>
          }
        />

        <Route path="/not-authorized" element={<NotAuthorized />} />

        {/* <Route path="/annexis" element={<AnnexPage />} /> */}
        <Route
          path="/employeeBenefits"
          element={
            <ProtectedRoute
              routeKey="/employeeBenefits"
              requiredPermissions={[]}
              requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}
            >
              <EmployeeBenefitsPage />
            </ProtectedRoute>
          }
        />

        {/* Sub-routes for Employee Benefits tabs — same access as /employeeBenefits */}
        <Route path="/courtAppearance" element={
          <ProtectedRoute routeKey="/courtAppearance" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/overTime" element={
          <ProtectedRoute routeKey="/overTime" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/subsistenceAllowanceMDS" element={
          <ProtectedRoute routeKey="/subsistenceAllowanceMDS" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/subsistenceAllowanceST" element={
          <ProtectedRoute routeKey="/subsistenceAllowanceST" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/subsistenceAllowance" element={
          <ProtectedRoute routeKey="/subsistenceAllowance" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/loyaltyPay" element={
          <ProtectedRoute routeKey="/loyaltyPay" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/mealallowance" element={
          <ProtectedRoute routeKey="/mealallowance" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/medicalAllowance" element={
          <ProtectedRoute routeKey="/medicalAllowance" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/childrenAllowance" element={
          <ProtectedRoute routeKey="/childrenAllowance" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        <Route path="/retirees" element={
          <ProtectedRoute routeKey="/retirees" requiredPermissions={[]} requiredWorkflowRoles={["superAdmin", "preparer", "overallBudgetApprover"]}>
            <EmployeeBenefitsPage />
          </ProtectedRoute>
        } />
        {/* <Route path="/Appearance" element={<AppearancePage />} />
        <Route path="/ProposalSummaryPage" element={<ProposalSummaryPage />} /> */}
        <Route
          path="/allproposal"
          element={
            <ProtectedRoute routeKey="/allproposal">
              <ProposalOperationsHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brd-consolidation"
          element={
            <ProtectedRoute
              routeKey="/brd-consolidation"
              requiredWorkflowRoles={["BUDGET_PLANNING_ANALYST", "budgetAnalyst", "BUDGET_OFFICER", "BUDGET_MANAGER", "overallBudgetApprover", "superAdmin"]}
            >
              <BRDConsolidationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tier-comparison"
          element={
            <ProtectedRoute
              routeKey="/tier-comparison"
              requiredWorkflowRoles={["BUDGET_PLANNING_ANALYST", "budgetAnalyst", "BUDGET_OFFICER", "BUDGET_MANAGER", "overallBudgetApprover", "superAdmin"]}
            >
              <TierComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comparative-report"
          element={
            <ProtectedRoute
              routeKey="/comparative-report"
              requiredWorkflowRoles={["superAdmin", "budgetAnalyst"]}
            >
              <ComparativeReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nep-ceiling"
          element={
            <ProtectedRoute
              requiredWorkflowRoles={["BUDGET_OFFICER", "BUDGET_MANAGER", "overallBudgetApprover", "superAdmin"]}
            >
              <NEPCeilingPage />
            </ProtectedRoute>
          }
        />
        {/* Note: /mealallowance, /medicalAllowance, /childrenAllowance, /retirees are defined above with ProtectedRoute */}
        <Route
          path="/hierarchical-user-assignments"
          element={
            <ProtectedRoute 
              routeKey="/hierarchical-user-assignments"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <HierarchicalUserAssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup/organization"
          element={
            <ProtectedRoute 
              routeKey="/setup/organization"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["preparer", "reviewer", "approver", "superAdmin", "budgetAnalyst"]}
            >
              <OrganizationSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subsidy-monitoring"
          element={
            <ProtectedRoute routeKey="/subsidy-monitoring" requiredWorkflowRoles={["superAdmin"]}>
              <SubsidyMonitoringPage />
            </ProtectedRoute>
          }
        />

        <Route path="/region-selection" element={<RegionSelectionPage />} />
        <Route
          path="/corporate-income-upload"
          element={
            <ProtectedRoute routeKey="/corporate-income-upload">
              <CorporateIncomeUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-corporate-income"
          element={
            <ProtectedRoute
              routeKey="/consolidated-corporate-income"
              requiredPermissions={["ViewReports"]}
              requiredWorkflowRoles={["preparer","reviewer","approver","superAdmin", "budgetAnalyst"]}
            >
              <ConsolidatedCorporateIncomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mooe-upload"
          element={
            <ProtectedRoute
              routeKey="/mooe-upload"
              requiredPermissions={["EditAllProposals"]}
              requiredWorkflowRoles={["superAdmin"]}
            >
              <MooeUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-reports"
          element={
            <ProtectedRoute
              routeKey="/consolidated-reports"
              requiredPermissions={["ViewReports"]}
              requiredWorkflowRoles={["preparer","reviewer","approver","superAdmin", "budgetAnalyst"]}
            >
              <ConsolidatedReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-capital-outlay-reports"
          element={
            <ProtectedRoute
              routeKey="/consolidated-capital-outlay-reports"
              requiredPermissions={["ViewReports"]}
              requiredWorkflowRoles={["preparer","reviewer","approver","superAdmin", "budgetAnalyst"]}
            >
              <ConsolidatedCapitalOutlayReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-personnel-services-reports"
          element={
            <ProtectedRoute
              routeKey="/consolidated-personnel-services-reports"
              requiredPermissions={["ViewReports"]}
              requiredWorkflowRoles={["preparer","reviewer","approver","superAdmin", "budgetAnalyst"]}
            >
              <ConsolidatedPersonnelServicesReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comprehensive-reports"
          element={
            <ProtectedRoute 
              routeKey="/comprehensive-reports"
              requiredPermissions={["ViewReports"]} 
              requiredWorkflowRoles={["superAdmin", "budgetAnalyst", "preparer", "approver", "reviewer"]}
            >
              <ComprehensiveReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/database-backup"
          element={
            <ProtectedRoute
              routeKey="/database-backup"
              requiredPermissions={["ManageSettings"]}
              requiredWorkflowRoles={["superAdmin"]}
            >
              <DatabaseBackupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-activity-logs"
          element={
            <ProtectedRoute 
              routeKey="/user-activity-logs"
              requiredWorkflowRoles={["superAdmin"]}
            >
              <UserActivityLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-upload-management"
          element={
            <ProtectedRoute 
              routeKey="/bulk-upload-management"
              requiredWorkflowRoles={["superAdmin"]}
            >
              <BulkUploadManagementPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
