import React from "react";
import { Route, Routes } from "react-router-dom";
import UserProvider from "./context/UserContext";
import { RegionProvider } from "./context/RegionContext";
import Dashboard from "./layout/Dashboard";
import HomePage from "./pages/HomePage";
import RegionAssignmentGuard from "./components/guards/RegionAssignmentGuard";
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
import LoyaltyPayPage from "./pages/LoyaltyPayPage";
import AppearancePage from "./pages/AppearancePage";
import AllProposalsPage from "./pages/AllProposalsPage";
import ProtectedRoute from "./middleware/ProtectedRoute";
import NotAuthorized from "./pages/NotAuthorizedPage";
import ProposalSummaryPage from "./pages/ProposalSummaryPage";
import FiscalYearSettingsPage from "./pages/FiscalYearSettingsPage";
import CompensationSettingsPage from "./pages/CompensationSettingsPage";
import UploaderPage from "./pages/TestPage";
import MealAllowancePage from "./pages/MealAllowancePage";
import MedicalAllowancePage from "./pages/MedicalAllowancePage";
import ChildrenAllowancePage from "./pages/ChildrenAllowancePage";
import IncomeManagementPage from "./pages/IncomeManagementPage";
import RetireePage from "./pages/RetireePage";

import SubsidyMonitoringPage from "./pages/SubsidyMonitoringPage";
import CapitalOutlayTitleMappingPage from "./pages/CategoryPage";
import RegionSelectionPage from "./pages/RegionSelectionPage";
import CorporateIncomeUploadPage from "./pages/CorporateIncomeUploadPage";
import ConsolidatedCorporateIncomePage from "./pages/ConsolidatedCorporateIncomePage";
import MooeUploadPage from "./pages/MooeUploadPage";
import EmployeeBenefitsPage from "./pages/EmployeeBenefitsPage";
import ConsolidatedReportsPage from "./pages/ConsolidatedReportsPage";
import ConsolidatedCapitalOutlayReportsPage from "./components/reports/ConsolidatedCapitalOutlayReportsPage";
import ConsolidatedPersonnelServicesReportsPage from "./components/reports/ConsolidatedPersonnelServicesReportsPage";
import ComprehensiveReportsPage from "./components/reports/ComprehensiveReportsPage";
import DatabaseBackupPage from "./pages/DatabaseBackupPage";
import HierarchicalUserAssignmentPage from "./pages/HierarchicalUserAssignmentPage";
const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route
        path="/"
        element={
          <UserProvider>
            <RegionProvider>
              <RegionAssignmentGuard>
                <Dashboard />
              </RegionAssignmentGuard>
            </RegionProvider>
          </UserProvider>
        }
      >
        <Route path="/dashboard" element={<DashBoardHome />} />
        <Route
          path="/proposal"
          element={
            <ProtectedRoute
              requiredPermissions={["canCreateProposals", "canEditOwnProposals"]}
              requiredWorkflowRoles={["divisionCreator", "departmentCreator", "regionCreator"]}
            >
              <Proposals />
            </ProtectedRoute>
          }
        />
        <Route
          path="/myProposals"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditOwnProposals"]}
              requiredWorkflowRoles={["divisionCreator", "departmentCreator", "regionCreator"]}
            >
              <ProposalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditAllProposals"]}
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
              requiredPermissions={["canManageSettings"]}
              requiredWorkflowRoles={["regionCreator"]}
            >
              <Categories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rata"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
              requiredWorkflowRoles={["regionCreator"]}
            >
              <RataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fysettings"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
              requiredWorkflowRoles={["regionCreator"]}
            >
              <FiscalYearSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/compsettings"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
            >
              <CompensationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
            >
              <SettingsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/AllProposals"
          element={
            <ProtectedRoute
              requiredPermissions={["canViewReports"]}
            >
              <AllProposalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/income-management"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditAllProposals"]}
            >
              <IncomeManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
            >
              <CapitalOutlayTitleMappingPage />
            </ProtectedRoute>
          }
        />

        <Route path="/not-authorized" element={<NotAuthorized />} />

        <Route path="/annexis" element={<AnnexPage />} />
        <Route
          path="/employeeBenefits"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditAllProposals"]}
            >
              <EmployeeBenefitsPage />
            </ProtectedRoute>
          }
        />

        {/* Keep these routes for backward compatibility but they will redirect in the future */}
        <Route path="/courtAppearance" element={<EmployeeBenefitsPage />} />
        <Route path="/overTime" element={<EmployeeBenefitsPage />} />
        <Route
          path="/subsistenceAllowanceMDS"
          element={<EmployeeBenefitsPage />}
        />
        <Route
          path="/subsistenceAllowanceST"
          element={<EmployeeBenefitsPage />}
        />
        <Route path="/loyaltyPay" element={<EmployeeBenefitsPage />} />
        <Route path="/Appearance" element={<AppearancePage />} />
        <Route path="/ProposalSummaryPage" element={<ProposalSummaryPage />} />
        <Route path="/uploader" element={<UploaderPage />} />
        <Route path="/mealallowance" element={<EmployeeBenefitsPage />} />
        <Route path="/medicalAllowance" element={<EmployeeBenefitsPage />} />
        <Route path="/childrenAllowance" element={<EmployeeBenefitsPage />} />
        <Route path="/retirees" element={<EmployeeBenefitsPage />} />
        <Route
          path="/hierarchical-user-assignments"
          element={
            <ProtectedRoute requiredPermissions={["canManageUsers"]}>
              <HierarchicalUserAssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subsidy-monitoring"
          element={
            <ProtectedRoute>
              <SubsidyMonitoringPage />
            </ProtectedRoute>
          }
        />

        <Route path="/region-selection" element={<RegionSelectionPage />} />
        <Route
          path="/corporate-income-upload"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditAllProposals"]}
            >
              <CorporateIncomeUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-corporate-income"
          element={
            <ProtectedRoute
              requiredPermissions={["canViewReports"]}
            >
              <ConsolidatedCorporateIncomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mooe-upload"
          element={
            <ProtectedRoute
              requiredPermissions={["canEditAllProposals"]}
            >
              <MooeUploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-reports"
          element={
            <ProtectedRoute
              requiredPermissions={["canViewReports"]}
            >
              <ConsolidatedReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-capital-outlay-reports"
          element={
            <ProtectedRoute
              requiredPermissions={["canViewReports"]}
            >
              <ConsolidatedCapitalOutlayReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consolidated-personnel-services-reports"
          element={
            <ProtectedRoute
              requiredPermissions={["canViewReports"]}
            >
              <ConsolidatedPersonnelServicesReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comprehensive-reports"
          element={
            <ProtectedRoute requiredPermissions={["canViewReports"]}>
              <ComprehensiveReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/database-backup"
          element={
            <ProtectedRoute
              requiredPermissions={["canManageSettings"]}
            >
              <DatabaseBackupPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
};

export default App;
