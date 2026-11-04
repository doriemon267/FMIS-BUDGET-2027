import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Navigate } from "react-router-dom";
import api from "../../config/api";

import PropTypes from "prop-types";
import { useRegion } from "../../context/RegionContext";
import { useRoutePermissions } from "../../context/RoutePermissionContext";
import { IoPersonCircleOutline } from "react-icons/io5";
import { GrHostMaintenance } from "react-icons/gr";
import { FaFileContract, FaPesoSign } from "react-icons/fa6";
import { 
  FiTrendingUp, 
  FiUserCheck, 
  FiUsers, 
  FiCreditCard, 
  FiBriefcase, 
  FiFileText, 
  FiCpu, 
  FiAward 
} from "react-icons/fi";
import StyledBox from "../../global/components/StyledBox";
import PSPermanentServiceTable from "../pspermanent/PersonnelServicesPage";
import PSCasualServiceTable from "../pscasual/PersonnelServicesPage";
import PSChargedToIncomeTable from "../pschargedtoincome/PersonnelChargedToIncomePage";
import Mooe from "../mooe/MooeTable";
// import CapitalOutlayTable from "../capitaloutlay/CapitalOutlayTable";
import CapitalOutlayTable from "../capitaloutlay/CapitalOutlayTableEnhanced";
import CapitalOutlayDataGrid from "../capitaloutlay/CapitalOutlayDataGrid";
import PSCOSCustomPageTable from "../jocos/PersonnelServicesPage";
import IncomeTable from "../corporateincome/IncomeTable";
import "./Tabs.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  MenuItem,
  CircularProgress,
  LinearProgress,
  Paper,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Switch,
  FormControlLabel,
  Menu,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ButtonBase,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useUser } from "../../context/UserContext";
import CustomSnackbar from "../../global/components/CustomSnackbar";
import { FaProjectDiagram } from "react-icons/fa";
import BudgetarySupportTable from "../budgetarysupport/BudgetarySupportTable";
import { toast } from "react-toastify";
import logger from "../../utils/logger";
import { handleApiError } from "../../utils/errorHandler";
import { useDebouncedCallback } from "../../hooks/useDebounce";
import { TableSkeleton } from "../common/LoadingSkeleton";
import ErrorAlert from "../common/ErrorAlert";
import LockIcon from "@mui/icons-material/Lock";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
// New icons for enhancements
import GetAppIcon from "@mui/icons-material/GetApp";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hasPermission, PERMISSIONS } from "../../utils/permissions";
import { useUserRestrictions } from "../../hooks/useUserRestrictions";
import { useProposalLock } from "../../hooks/useProposalLock";
import { styled } from "@mui/material/styles";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";

const CAPITAL_OUTLAY_VIEW_PREFERENCE_KEY = "capitalOutlayViewPreference";

const ProposalCustomPage = ({
  dataListName,
  schema,
  title = "Budget Proposal Entry",
  description = "",
}) => {
  const { currentUser } = useUser();
  const { getRoutePermission } = useRoutePermissions();
  const { activeRegion, loading: isRegionLoading } = useRegion();
  const { readOnly, canCreate } = useUserRestrictions();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const hoverBg = theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.15)' : 'rgba(46, 125, 50, 0.06)';
  const hoverBorder = theme.palette.mode === 'dark' ? '#4e7d4f' : '#2d5016';
  const showUploadButton = String(import.meta.env.VITE_SHOW_UPLOAD_BUTTON || "true").toLowerCase() === "true";
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const activeRegionKey =
    activeRegion?.name ||
    activeRegion?.regionName ||
    activeRegion?.Region ||
    activeRegion?.id ||
    "";
  const activeRegionName =
    activeRegion?.name ||
    activeRegion?.regionName ||
    activeRegion?.Region ||
    null;
  const primaryAccessibleDivision =
    currentUser?.hierarchicalAccess?.accessibleDivisions?.[0]?.name || null;
  const primaryAccessibleDepartment =
    currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.name || null;
  const [regionFilter, setRegionFilter] = useState("");
  const [personnelData, setPersonnelData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [budgetarySupportData, setBudgetarySupportData] = useState([]);
  const [iasOMCostData, setIasOMCostData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [activeTab, setActiveTab] = useState("Income");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFiscalYear, setActiveFiscalYear] = useState("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [activeBudgetType, setActiveBudgetType] = useState("");
  const proposalRoutePermission = getRoutePermission("/proposal");
  const isActiveBudgetTypeAllowed =
    !Array.isArray(proposalRoutePermission?.applicableProposalTypes) ||
    proposalRoutePermission.applicableProposalTypes.includes(activeBudgetType);
  const [activeDueDate, setActiveDueDate] = useState(null);
  const [isDueDatePassed, setIsDueDatePassed] = useState(true); // Conservative: block until API confirms due date is valid
  const [regionCeilingAmount, setRegionCeilingAmount] = useState(null);
  const [divisionCeilingAmount, setDivisionCeilingAmount] = useState(null);
  const [divisionCeilingInfo, setDivisionCeilingInfo] = useState(null); // { division, department, ceilingAmount }
  const [budgetDeficit, setBudgetDeficit] = useState(null);
  const [currentProposalId, setCurrentProposalId] = useState(null);
  const [isResumingDraft, setIsResumingDraft] = useState(true);

  // Bulk Upload state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState("Income"); // "Income", "MOOE", "Capital Outlay"
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ================= CONCURRENCY CONTROL =================
  const { lockStatus, acquireLock, releaseLock, hasLock } = useProposalLock(currentProposalId);

  useEffect(() => {
    if (currentProposalId) {
      acquireLock();
    }
    return () => {
      releaseLock();
    };
  }, [currentProposalId, acquireLock, releaseLock]);

  // If locked by someone else, make the page strictly read-only
  const isEffectivelyReadOnly = readOnly || (lockStatus.isLocked && !hasLock);
  // ========================================================

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  function getBudgetParams() {
    const region = activeRegion?.name || activeRegion?.regionName || activeRegion?.Region;
    const fiscalYear = selectedFiscalYear || activeFiscalYear;
    const budgetType = activeBudgetType || "Initial";

    return {
      region,
      fiscalYear,
      budgetType,
    };
  }

  // Fetch NEP ceiling for current region/fiscal year (for display/validation)
  // Also fetch division/department-specific ceiling if proposal exists
  const fetchRegionCeiling = useCallback(async () => {
    try {
      const regionName = activeRegionName;
      const fy = selectedFiscalYear || activeFiscalYear;
      // Only relevant when budget type is NEP and region/fiscalYear are known
      if (!regionName || !fy || (activeBudgetType || "").toUpperCase() !== "NEP") {
        setRegionCeilingAmount(null);
        setDivisionCeilingAmount(null);
        setDivisionCeilingInfo(null);
        return;
      }
      const res = await api.get(
        `/api/budget-ceiling/${Number(fy)}/${encodeURIComponent(regionName)}`,
        { params: { budgetPhase: "NEP" } }
      );
      if (res.data?.success && res.data?.data) {
        const ceilingDoc = res.data.data;
        // Region-level total ceiling (for reference)
        const totalCeiling =
          typeof ceilingDoc.totalBudgetPool === "number"
            ? ceilingDoc.totalBudgetPool
            : Array.isArray(ceilingDoc.allocations)
            ? ceilingDoc.allocations.reduce(
                (sum, a) => sum + (Number(a.ceilingAmount) || 0),
                0
              )
            : null;
        setRegionCeilingAmount(totalCeiling);

        // Try to find division/department-specific ceiling
        // First, try to get division/department from current proposal
        let proposalDivision = null;
        let proposalDepartment = null;
        if (currentProposalId) {
          try {
            const proposalRes = await api.get(`/api/allproposal/proposals/${currentProposalId}`);
            if (proposalRes.data?.success && proposalRes.data?.data) {
              proposalDivision = proposalRes.data.data.division || null;
              proposalDepartment = proposalRes.data.data.department || null;
            }
          } catch (proposalErr) {
            logger.warn("Could not fetch proposal details for ceiling matching", proposalErr);
          }
        }
        // Fallback: use user's hierarchical access division/department
        if (!proposalDivision && primaryAccessibleDivision) {
          proposalDivision = primaryAccessibleDivision;
        }
        if (!proposalDepartment && primaryAccessibleDepartment) {
          proposalDepartment = primaryAccessibleDepartment;
        }

        // Match allocation by division (preferred) or department
        if (Array.isArray(ceilingDoc.allocations) && ceilingDoc.allocations.length > 0) {
          let matchedAllocation = null;
          if (proposalDivision) {
            matchedAllocation = ceilingDoc.allocations.find(
              (a) => String(a.division || "").trim() === String(proposalDivision).trim()
            );
          }
          if (!matchedAllocation && proposalDepartment) {
            matchedAllocation = ceilingDoc.allocations.find(
              (a) => String(a.department || "").trim() === String(proposalDepartment).trim()
            );
          }
          if (matchedAllocation && typeof matchedAllocation.ceilingAmount === "number") {
            setDivisionCeilingAmount(matchedAllocation.ceilingAmount);
            setDivisionCeilingInfo({
              division: matchedAllocation.division || proposalDivision,
              department: matchedAllocation.department || proposalDepartment,
              ceilingAmount: matchedAllocation.ceilingAmount,
            });
          } else {
            setDivisionCeilingAmount(null);
            setDivisionCeilingInfo(null);
          }
        } else {
          setDivisionCeilingAmount(null);
          setDivisionCeilingInfo(null);
        }
      } else {
        setRegionCeilingAmount(null);
        setDivisionCeilingAmount(null);
        setDivisionCeilingInfo(null);
      }
    } catch (err) {
      logger.error("Failed to fetch region ceiling", err);
      setRegionCeilingAmount(null);
      setDivisionCeilingAmount(null);
      setDivisionCeilingInfo(null);
    }
  }, [
    activeRegionName,
    activeFiscalYear,
    selectedFiscalYear,
    activeBudgetType,
    currentProposalId,
    primaryAccessibleDivision,
    primaryAccessibleDepartment,
  ]);

  // Fetch all budget data for the active/selected filters
  async function fetchAllData() {
    setLoading(true);
    try {
      const params = getBudgetParams();

      const [personnelRes, mooeRes, coRes, incomeRes, bsRes, iasOMRes] = await Promise.all([
        api.get("/getpersonnels/byParams", { params }),
        api.get("/mooe-data", { params }),
        api.get("/capital-outlay/getByParams", { params }),
        api.get("/income/getByParams", { params }),
        api.get("/budgetary-support", { params }),
        api.get("/ias-om-cost", { params })
      ]);

      setPersonnelData(personnelRes.data || []);
      setMooeData(mooeRes.data?.entries || []);
      setCapitalOutlayData(coRes.data || []);
      setIncomeData(incomeRes.data || []);
      setBudgetarySupportData(bsRes.data || []);
      setIasOMCostData(iasOMRes.data || null);

    } catch (error) {
      logger.error("Error fetching all data", error);
      // Only show error if it's not a 404 for ias-om-cost which is expected for new regions
      if (error.response?.status !== 404) {
        toast.error("Failed to fetch budget data");
      }
    } finally {
      setLoading(false);
    }
  }

  // Refresh data when active region changes
  useEffect(() => {
    if (activeRegionKey) {
      fetchAllData();
    }
  }, [activeRegionKey, activeFiscalYear, selectedFiscalYear, activeBudgetType]);

  // Refresh data when selected fiscal year changes
  useEffect(() => {
    if (selectedFiscalYear) {
      fetchAllData();
    }
  }, [selectedFiscalYear, activeFiscalYear, activeBudgetType, activeRegionKey]);

  // Keep region-level NEP ceiling in sync when filters change
  useEffect(() => {
    fetchRegionCeiling();
  }, [fetchRegionCeiling]);

  // Fetch calculated budgetary support for aligned totals (same source as Budgetary Support Table)
  const fiscalYearForCalc = selectedFiscalYear || activeFiscalYear;
  const hasValidParams = !!(fiscalYearForCalc && activeBudgetType);
  const { data: calculatedBudgetarySupport } = useQuery({
    queryKey: [
      'calculated-budgetary-support',
      fiscalYearForCalc,
      activeBudgetType,
      activeRegionKey,
      primaryAccessibleDepartment,
      primaryAccessibleDivision,
      currentUser?.id || currentUser?._id,
    ],
    queryFn: () => api.get('/budgetary-support/calculate', {
      params: {
        fiscalYear: Number(fiscalYearForCalc),
        budgetType: activeBudgetType,
        ...(activeRegionKey ? { region: activeRegionKey } : {}),
      },
      timeout: 12000
    }).then(r => r.data),
    enabled: hasValidParams,
  });

  // State for the new proposal form
  const [newProposalData, setNewProposalData] = useState({
    title: "",
    description: "",
    projectedCorporateIncome: "",
    projectedSubsidy: "",
    modelType: "Initial", // Will be auto-overridden by active settings
    carryForwardPreviousYear: true,
  });
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const allowedFiscalYears = useMemo(() => {
    const fromHierarchy = currentUser?.hierarchicalAccess?.restrictions?.allowedFiscalYears;
    const fromRoot = currentUser?.restrictions?.allowedFiscalYears;
    const years = Array.isArray(fromHierarchy) && fromHierarchy.length > 0
      ? fromHierarchy
      : (Array.isArray(fromRoot) ? fromRoot : []);
    return years.map((year) => String(year));
  }, [currentUser]);

  const allowedBudgetTypes = useMemo(() => {
    const fromHierarchy = currentUser?.hierarchicalAccess?.restrictions?.allowedBudgetTypes;
    const fromRoot = currentUser?.restrictions?.allowedBudgetTypes;
    const types = Array.isArray(fromHierarchy) && fromHierarchy.length > 0
      ? fromHierarchy
      : (Array.isArray(fromRoot) ? fromRoot : []);
    return types;
  }, [currentUser]);

  const resolvedFiscalYear = useMemo(() => {
    const candidate = String(selectedFiscalYear || activeFiscalYear || "");
    if (allowedFiscalYears.length === 0) return candidate;
    if (candidate && allowedFiscalYears.includes(candidate)) return candidate;
    return allowedFiscalYears[0];
  }, [selectedFiscalYear, activeFiscalYear, allowedFiscalYears]);

  const resolvedBudgetType = useMemo(() => {
    const candidate = activeBudgetType || "Initial";
    if (allowedBudgetTypes.length === 0) return candidate;
    if (candidate && allowedBudgetTypes.includes(candidate)) return candidate;
    return allowedBudgetTypes[0] || candidate;
  }, [activeBudgetType, allowedBudgetTypes]);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);

  // Helper functions for role checking
  const userRoles = currentUser?.Roles || [];
  const isSuperAdmin = userRoles.some((r) =>
    ["SUPER_ADMIN", "SUPER ADMIN"].includes(r?.toUpperCase?.() || r)
  );
  const isBudgetPreparer = userRoles.some((r) =>
    ["BUDGET_PREPARER", "BUDGET PREPARER"].includes(r?.toUpperCase?.() || r)
  );

  const createProposalMutation = useMutation({
    mutationFn: (newProposal) => {
      // Use new workflow endpoint so proposals appear in /allproposal page
      return api.post("/api/allproposal/proposals", newProposal);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      // Capture the created proposal ID
      // New workflow controller returns { success, message, data: <proposal> }
      const proposalId = response.data?.data?._id;
      setCurrentProposalId(proposalId);
      try {
        if (proposalId) {
          sessionStorage.setItem("activeWorkflowRef", proposalId);
          localStorage.setItem("activeWorkflowRef", proposalId);
        }
      } catch (_) {}
      toast.success(response.data?.message || "Proposal created successfully!");
      setCreateDialogOpen(false);
      setPrivacyNoticeAccepted(false);
      setNewProposalData({
        title: "",
        description: "",
        projectedCorporateIncome: "",
        projectedSubsidy: "",
        modelType: "Initial",
        carryForwardPreviousYear: true,
      });
    },
    onError: (error) => {
      toast.error(
        `Error creating proposal: ${
          error.response?.data?.message || error.message
        }`
      );
      if (error.response?.status === 409) {
        // A duplicate proposal exists, auto-refresh the page to load it
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
  });

  // Delete proposal mutation - deletes the proposal from database when unlinking
  const deleteProposalMutation = useMutation({
    mutationFn: (proposalId) => {
      return api.delete(`/api/allproposal/proposals/${proposalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["allProposals"] });
      setCurrentProposalId(null);
      sessionStorage.removeItem("activeWorkflowRef");
      localStorage.removeItem("activeWorkflowRef");
      toast.success("Proposal deleted and unlinked successfully!");
    },
    onError: (error) => {
      toast.error(
        `Error deleting proposal: ${
          error.response?.data?.message || error.message
        }`
      );
    },
  });

  // Normalize modelType coming from active settings to the enum accepted by backend
  const normalizeModelType = (value) => {
    if (!value) return "Initial";
    const v = String(value).trim().toUpperCase();
    if (v.includes("NEP")) return "NEP";
    if (v.includes("GAA")) return "GAA";
    // Default bucket for anything like "INITIAL", "BUDGET: INITIAL", etc.
    return "Initial";
  };

  const handleCreateProposal = () => {
    const {
      title,
      description,
      projectedCorporateIncome,
      projectedSubsidy,
      modelType,
      carryForwardPreviousYear,
    } = newProposalData;
    if (!title) {
      toast.error("Title is required.");
      return;
    }
    // Prefer sending region NAME to satisfy legacy/middleware validators
    const regionPayload =
      typeof activeRegion === "object"
        ? activeRegion.name ||
          activeRegion.regionName ||
          activeRegion.Region ||
          "CENTRAL OFFICE"
        : activeRegion || "CENTRAL OFFICE";

    const modelTypeNormalized = normalizeModelType(
      activeBudgetType || modelType || "Initial"
    );

    createProposalMutation.mutate({
      title,
      description,
      projectedCorporateIncome:
        (Number(projectedCorporateIncome) || 0) +
        (Number(chargedToIncomeAmount) || 0),
      projectedSubsidy:
        (Number(projectedSubsidy) || 0) +
        (Number(nonChargedPersonnelServices) || 0),
      modelType: modelTypeNormalized,
      fiscalYear: Number(activeFiscalYear) || new Date().getFullYear(),
      region: regionPayload,
      carryForwardPreviousYear:
        modelTypeNormalized === "Initial" ? carryForwardPreviousYear !== false : false,
    });
  };

  // Enhancement states
  const [bulkSelection, setBulkSelection] = useState({
    personnel: [],
    mooe: [],
    capitalOutlay: [],
    income: [],
    budgetarySupport: [],
  });
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionsAnchor, setBulkActionsAnchor] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // Capital Outlay view toggle (true = new DataGrid, false = old table)
  const [useDataGridView, setUseDataGridView] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    source: null, // 'chip' or 'dialog' - to know where the delete was triggered
  });

  // Use canCreate from the hook, but keep canEditOwn from permissions
  const canEditOwn = hasPermission(currentUser, PERMISSIONS.EDIT_OWN);
  // Add a state to track the income grand total from IncomeTable
  const [incomeGrandTotal, setIncomeGrandTotal] = useState(0);
  // Add state for tracking if income fields should be disabled
  const [disableIncomeInputs, setDisableIncomeInputs] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [groupedItems, setGroupedItems] = useState({});
  const [chargedToIncomeAmount, setChargedToIncomeAmount] = useState(0);
  const [nonChargedPersonnelServices, setNonChargedPersonnelServices] =
    useState(0);

  const handleIncomeGrandTotalUpdate = useCallback((grandTotal) => {
    setIncomeGrandTotal((prev) => {
      const next = grandTotal || 0;
      return prev === next ? prev : next;
    });
  }, []);

  const handleGroupedItemsUpdate = useCallback((items) => {
    const nextItems = items || {};
    setGroupedItems((prev) => (prev === nextItems ? prev : nextItems));
  }, []);

  const handleDownloadTemplate = async () => {
    let endpoint = "";
    if (uploadType === "Income") {
      endpoint = "/api/income/corporate-income/template";
    } else if (uploadType === "MOOE") {
      endpoint = "/api/income/mooe/template";
    } else if (uploadType === "Capital Outlay") {
      endpoint = "/api/capitaloutlay/template";
    }

    try {
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${uploadType.toLowerCase()}-template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Template download error:", error);
      toast.error("Failed to download template. Please try again.");
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (currentProposalId) {
      formData.append("proposalId", currentProposalId);
    }

    // Add necessary context for the upload
    formData.append("fiscalYear", activeFiscalYear);
    formData.append("budgetType", activeBudgetType || "Initial");
    formData.append("region", activeRegionName || "CENTRAL OFFICE");

    let endpoint = "";
    if (uploadType === "Income") {
      endpoint = "/api/income/corporate-income/upload";
    } else if (uploadType === "MOOE") {
      endpoint = "/api/income/mooe/upload";
    } else if (uploadType === "Capital Outlay") {
      endpoint = "/api/capitaloutlay/upload";
    }

    try {
      const response = await api.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
        },
      });

      setUploadResult({
        success: true,
        message: response.data.message || "Upload completed successfully",
        details: response.data,
      });
      
      toast.success("Bulk upload successful!");
      
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries(["income-items"]);
      queryClient.invalidateQueries(["income-categories"]);
      queryClient.invalidateQueries(["mooeData"]);
      queryClient.invalidateQueries(["mooe"]);
      queryClient.invalidateQueries(["capital-outlays"]);
      queryClient.invalidateQueries(["capital-outlay"]);
      queryClient.invalidateQueries(["allProposals"]);
      queryClient.invalidateQueries(["proposals"]);
      queryClient.invalidateQueries(["workflowProposals"]);
      fetchAllData(); // Manually trigger data refresh
      
    } catch (error) {
      console.error("Upload error:", error);
      setUploadResult({
        success: false,
        message: error.response?.data?.message || "Error uploading file",
        error: error.response?.data?.error || error.message,
      });
      toast.error("Upload failed. Please check the file and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Enhanced UX state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved', 'saving', 'error'
  const [validationErrors, setValidationErrors] = useState({});

  // Load a proposal only when it belongs to the currently selected region and fiscal year.
  useEffect(() => {
    if (typeof window === "undefined" || isRegionLoading) return;

    const fiscalYearToUse = String(selectedFiscalYear || activeFiscalYear || "").trim();
    const clearStoredWorkflowRef = () => {
      try {
        sessionStorage.removeItem("activeWorkflowRef");
        localStorage.removeItem("activeWorkflowRef");
      } catch (_) {}
    };

    // Clear the previous context immediately so child tables cannot reuse its ID.
    const storedWorkflowRef =
      sessionStorage.getItem("activeWorkflowRef") ||
      localStorage.getItem("activeWorkflowRef");
    setCurrentProposalId(null);
    setIsResumingDraft(true);
    clearStoredWorkflowRef();

    // Proposals are scoped to both a region and fiscal year.
    if (!activeRegionName) {
      console.log("[loadProposalContext] No active region. Clearing active proposal.");
      setIsResumingDraft(false);
      return;
    }

    // Wait for fiscal-year and budget-type settings before resolving a draft.
    if (!fiscalYearToUse || !activeBudgetType) return;

    let cancelled = false;
    const loadProposalContext = async () => {
      try {
        // Reuse a stored proposal only if its region and fiscal year still match.
        if (storedWorkflowRef) {
          try {
            const verifyRes = await api.get(`/api/allproposal/proposals/${storedWorkflowRef}`);
            if (verifyRes.data?.success && verifyRes.data?.data) {
              const proposal = verifyRes.data.data;
              const proposalRegion = proposal.regionName || proposal.region || proposal.Region || proposal.RegionName || "CENTRAL OFFICE";
              const proposalFiscalYear = String(proposal.fiscalYear ?? proposal.FiscalYear ?? "").trim();
              const matchesRegion = String(proposalRegion).toUpperCase() === String(activeRegionName).toUpperCase();
              const matchesFiscalYear = proposalFiscalYear === fiscalYearToUse;
              const matchesBudgetType = String(proposal.modelType || proposal.budgetType || "").toUpperCase() === String(activeBudgetType).toUpperCase();

              if (!cancelled && matchesRegion && matchesFiscalYear && matchesBudgetType) {
                setCurrentProposalId(storedWorkflowRef);
                sessionStorage.setItem("activeWorkflowRef", storedWorkflowRef);
                localStorage.setItem("activeWorkflowRef", storedWorkflowRef);
                setIsResumingDraft(false);
                return;
              }
            }
          } catch (error) {
            console.warn("[loadProposalContext] Could not verify stored proposal:", error);
          }
        }

        // Search only in the selected fiscal year so a draft from another year is never linked.
        const fetchRes = await api.get("/api/allproposal/proposals", {
          params: {
            view: "my-proposals",
            limit: 1,
            region: activeRegionName,
            fiscalYear: fiscalYearToUse,
            modelType: activeBudgetType,
          },
        });

        if (cancelled) return;
        if (fetchRes.data?.success && Array.isArray(fetchRes.data?.proposals) && fetchRes.data.proposals.length > 0) {
          const latest = fetchRes.data.proposals[0];
          const status = String(latest.status || "").toUpperCase();
          const latestFiscalYear = String(latest.fiscalYear ?? latest.FiscalYear ?? "").trim();
          const latestBudgetType = String(latest.modelType || latest.budgetType || "").toUpperCase();
          if (
            latest._id &&
            latestFiscalYear === fiscalYearToUse &&
            latestBudgetType === String(activeBudgetType).toUpperCase() &&
            (status === "DRAFT" || status === "RETURNED_TO_PREPARER" || status.includes("RETURNED"))
          ) {
            setCurrentProposalId(latest._id);
            sessionStorage.setItem("activeWorkflowRef", latest._id);
            localStorage.setItem("activeWorkflowRef", latest._id);
            setIsResumingDraft(false);
            return;
          }
        }

      } catch (error) {
        if (!cancelled) {
          console.error("[loadProposalContext] Failed to load proposal:", error);
        }
      } finally {
        if (!cancelled) setIsResumingDraft(false);
      }
    };

    loadProposalContext();
    return () => {
      cancelled = true;
    };
  }, [activeRegionName, activeBudgetType, isRegionLoading, selectedFiscalYear, activeFiscalYear]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPreference = window.localStorage.getItem(
      CAPITAL_OUTLAY_VIEW_PREFERENCE_KEY
    );
    if (storedPreference === "datagrid") {
      setUseDataGridView(true);
    }
  }, []);

  // Auto-sync modelType with active settings budget type
  useEffect(() => {
    if (activeBudgetType) {
      setNewProposalData((prev) => ({ ...prev, modelType: activeBudgetType }));
    }
  }, [activeBudgetType]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CAPITAL_OUTLAY_VIEW_PREFERENCE_KEY,
      useDataGridView ? "datagrid" : "table"
    );
  }, [useDataGridView]);

  // Add a useEffect to store the incomeGrandTotal in localStorage when it changes
  useEffect(() => {
    if (incomeGrandTotal > 0) {
      localStorage.setItem("incomeGrandTotal", incomeGrandTotal.toString());
    }
  }, [incomeGrandTotal]);

  // Add a useEffect to load the incomeGrandTotal from localStorage on component mount
  useEffect(() => {
    const savedTotal = localStorage.getItem("incomeGrandTotal");
    if (savedTotal && !isNaN(Number(savedTotal))) {
      setIncomeGrandTotal(Number(savedTotal));
    }
  }, []);

  // Track changes to mark as unsaved
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
  ]);

  // Helper function - must be defined before enhancement functions
  const isEligibleForSubmission = useCallback(
    (status) =>
      status === "Not Submitted" || status === "Returned" || status === "Draft",
    []
  );

  const anyNotSubmitted = useMemo(() => {
    const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;
    const matchesFilters = (item) => {
      const matchesRegion = !regionFilter || item.region === regionFilter;
      const matchesFiscalYear =
        !fiscalYearToUse || item.fiscalYear === fiscalYearToUse;
      return matchesRegion && matchesFiscalYear;
    };
    const isEligible = (item) =>
      isEligibleForSubmission(item.status || "Not Submitted");

    return [
      personnelData,
      mooeData,
      capitalOutlayData,
      incomeData,
      budgetarySupportData,
    ].some((list) => list.some((item) => matchesFilters(item) && isEligible(item)));
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
    regionFilter,
    selectedFiscalYear,
    activeFiscalYear,
    isEligibleForSubmission,
  ]);

  const calculateTotalBudget = useMemo(() => {
    try {
      const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;
      const filteredPersonnelData = personnelData.filter((p) => {
        const matchesRegion = !regionFilter || p.region === regionFilter;
        const matchesFiscalYear = p.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      // Use calculated-budgetary-support breakdown when available (guarantees alignment with Budgetary Support Table)
      const breakdown = calculatedBudgetarySupport?.breakdown || [];
      const psBreakdown = breakdown.find(b => (b.source || '').includes('Personnel Services') || (b.source || '').includes('B.1.1'));
      const capitalBreakdown = breakdown.find(b => (b.source || '').includes('Capital Outlay') || (b.source || '').includes('B.2'));
      const mooeBreakdown = breakdown.find(b => (b.source || '').includes('MOOE') || (b.source || '').includes('B.1.2'));
      const iasBreakdown = breakdown.find(b => (b.source || '').includes('IAs O&M'));

      const personnelTotal = (psBreakdown?.amount != null && psBreakdown?.amount > 0)
        ? Number(psBreakdown.amount)
        : filteredPersonnelData.reduce((sum, p) => {
            if (p.chargedToIncomeEligible === true) return sum;
            return sum + (Number(p.Total) || 0);
          }, 0);

      // Filter MOOE data by region and fiscal year
      const filteredMooeData = mooeData.filter((item) => {
        const matchesRegion = !regionFilter || item.region === regionFilter;
        const matchesFiscalYear = item.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      const mooeBreakdownAmount = (mooeBreakdown?.amount || 0) + (iasBreakdown?.amount || 0);
      const mooeRegularTotal = filteredMooeData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const iasOMCostTotal = iasOMCostData
        ? (Number(iasOMCostData.nis) || 0) + (Number(iasOMCostData.cis) || 0) +
          (Number(iasOMCostData.nisSubsidy) || 0) + (Number(iasOMCostData.cisSubsidy) || 0)
        : 0;

      const mooeTotal = mooeBreakdownAmount > 0
        ? mooeBreakdownAmount
        : mooeRegularTotal + iasOMCostTotal;

      // Filter Capital Outlay data by region and fiscal year
      const filteredCapitalOutlayData = capitalOutlayData.filter((item) => {
        const matchesRegion = !regionFilter || item.region === regionFilter;
        const matchesFiscalYear = item.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      const capitalOutlayTotal = (capitalBreakdown?.amount != null && capitalBreakdown?.amount > 0)
        ? Number(capitalBreakdown.amount)
        : filteredCapitalOutlayData.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

      const mooeSubsidyTotal = filteredMooeData.reduce((sum, item) => sum + (Number(item.subsidy) || 0), 0);
      const capitalOutlaySubsidyTotal = filteredCapitalOutlayData.reduce((sum, item) => sum + (Number(item.subsidy) || 0), 0);
      const breakdownSubsidySum = (mooeBreakdown?.amount || 0) + (capitalBreakdown?.amount || 0) + (iasBreakdown?.amount || 0);
      const budgetarySupportTotal = (breakdown.length > 0 && breakdownSubsidySum > 0)
        ? breakdownSubsidySum
        : mooeSubsidyTotal + capitalOutlaySubsidyTotal;

      // If NEP with a known division/department ceiling, enforce that grand total cannot exceed the ceiling
      // Prefer division-specific ceiling over region-level ceiling
      // (used for display/validation only; backend should also enforce separately if needed)
      const rawGrandTotal =
        personnelTotal + mooeTotal + capitalOutlayTotal + budgetarySupportTotal;
      let grandTotal = rawGrandTotal;
      if ((activeBudgetType || "").toUpperCase() === "NEP") {
        if (divisionCeilingAmount != null && typeof divisionCeilingAmount === "number") {
          grandTotal = Math.min(rawGrandTotal, Number(divisionCeilingAmount));
        } else if (regionCeilingAmount != null && typeof regionCeilingAmount === "number") {
          grandTotal = Math.min(rawGrandTotal, Number(regionCeilingAmount));
        }
      }

      return {
        personnelTotal,
        mooeTotal, // <-- now always includes IAs O&M
        capitalOutlayTotal,
        budgetarySupportTotal,
        grandTotal,
      };
    } catch (error) {
      logger.error("Error calculating total budget", error);
      return {
        personnelTotal: 0,
        mooeTotal: 0,
        capitalOutlayTotal: 0,
        grandTotal: 0,
        budgetarySupportTotal: 0,
      };
    }
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    budgetarySupportData,
    calculatedBudgetarySupport,
    selectedFiscalYear,
    activeFiscalYear,
    regionFilter,
    iasOMCostData,
    divisionCeilingAmount,
    regionCeilingAmount,
    activeBudgetType,
  ]);

  const budgetSummary = useMemo(() => {
    try {
      const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;

      const parseNumeric = (value) => {
        if (value === undefined || value === null || value === "") {
          return 0;
        }
        if (typeof value === "number") {
          return Number.isFinite(value) ? value : 0;
        }
        const cleaned = String(value).replace(/,/g, "").trim();
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const includeByStatus = (status) => {
        if (!status) return true;
        return isEligibleForSubmission(status) || status === "Submitted";
      };

      const matchesRegion = (entry) =>
        !regionFilter || entry?.region === regionFilter;
      const matchesFiscalYear = (entry) =>
        entry?.fiscalYear === fiscalYearToUse;

      const filterByScope = (dataset) =>
        Array.isArray(dataset)
          ? dataset.filter(
              (entry) => entry && matchesFiscalYear(entry) && matchesRegion(entry)
            )
          : [];

      const collectLeafRecords = (entries) => {
        if (!Array.isArray(entries)) return [];
        const stack = entries.map((entry) => ({
          node: entry,
          status: entry?.status,
        }));
        const leaves = [];

        while (stack.length) {
          const current = stack.pop();
          if (!current?.node) continue;

          const { node, status } = current;

          const childCandidates = [
            ...(Array.isArray(node.children) ? node.children : []),
            ...(Array.isArray(node.items) ? node.items : []),
            ...(Array.isArray(node.entries) ? node.entries : []),
            ...(Array.isArray(node.subItems) ? node.subItems : []),
          ].filter(Boolean);

          if (childCandidates.length > 0) {
            childCandidates.forEach((child) =>
              stack.push({
                node: child,
                status: child?.status ?? status,
              })
            );
            continue;
          }

          leaves.push({
            node,
            status: node?.status ?? status,
          });
        }

        return leaves;
      };

      const pickNumber = (entry, keys) => {
        if (!entry) return 0;
        for (const key of keys) {
          if (entry[key] !== undefined && entry[key] !== null && entry[key] !== "") {
            return parseNumeric(entry[key]);
          }
        }
        return 0;
      };

      // Align with Budgetary Support: count ALL (no status filter)
      const sumFromLeaves = (leaves, keys) =>
        leaves.reduce((sum, leaf) => sum + pickNumber(leaf.node, keys), 0);

      const incomeKeys = [
        "income",
        "corporateIncome",
        "incomeAmount",
        "projectedCorporateIncome",
        "regionalIncome",
      ];
      const subsidyKeys = [
        "subsidy",
        "subsidyAmount",
        "subsidy_amount",
        "totalSubsidy",
        "projectedSubsidy",
        "subsidyValue",
      ];

      const filteredPersonnelData = filterByScope(personnelData);
      const filteredMooeData = filterByScope(mooeData);
      const filteredCapitalOutlayData = filterByScope(capitalOutlayData);

      // Align with Budgetary Support: count ALL personnel (no status filter), exclude charged-to-income
      const personnelTotal = filteredPersonnelData.reduce((sum, p) => {
        if (p.chargedToIncomeEligible === true) return sum;
        return (
          sum +
          parseNumeric(p.annualSalary) +
          parseNumeric(p.RATA) +
          parseNumeric(p.PERA) +
          parseNumeric(p.uniformALLOWANCE) +
          parseNumeric(p.productivityIncentive) +
          parseNumeric(p.medical) +
          parseNumeric(p.childrenAllowance) +
          parseNumeric(p.meal) +
          parseNumeric(p.cashGift) +
          parseNumeric(p.subsistenceAllowanceMDS) +
          parseNumeric(p.subsistenceAllowanceST) +
          parseNumeric(p.midyearBonus) +
          parseNumeric(p.yearEndBonus) +
          parseNumeric(p.gsisPremium) +
          parseNumeric(p.philhealthPremium) +
          parseNumeric(p.pagibigPremium) +
          parseNumeric(p.employeeCompensation) +
          parseNumeric(p.loyaltyAward) +
          parseNumeric(p.overtimePay) +
          parseNumeric(p.earnedLeaves) +
          parseNumeric(p.retirementBenefits) +
          parseNumeric(p.terminalLeave) +
          parseNumeric(p.courtAppearance)
        );
      }, 0);

      // Align with Budgetary Support: count ALL MOOE (no status filter)
      const mooeRegularTotal = filteredMooeData.reduce(
        (sum, item) => sum + parseNumeric(item.amount),
        0
      );

      const iasOMCostTotal = iasOMCostData
        ? parseNumeric(iasOMCostData.nis) +
          parseNumeric(iasOMCostData.cis) +
          parseNumeric(iasOMCostData.nisSubsidy) +
          parseNumeric(iasOMCostData.cisSubsidy)
        : 0;

      const mooeTotal = mooeRegularTotal + iasOMCostTotal;

      // Align with Budgetary Support: count ALL Capital Outlay (no status filter)
      const capitalOutlayTotal = filteredCapitalOutlayData.reduce(
        (sum, item) => sum + parseNumeric(item.cost),
        0
      );

      const mooeLeaves = collectLeafRecords(filteredMooeData);
      const capitalLeaves = collectLeafRecords(filteredCapitalOutlayData);

      const mooeIncomeTotal = sumFromLeaves(mooeLeaves, incomeKeys);
      const mooeSubsidyTotal = sumFromLeaves(mooeLeaves, subsidyKeys);

      const capitalOutlayIncomeTotal = sumFromLeaves(capitalLeaves, incomeKeys);
      const capitalOutlaySubsidyTotal = sumFromLeaves(capitalLeaves, subsidyKeys);

      const combinedIncomeTotal = mooeIncomeTotal + capitalOutlayIncomeTotal;
      const combinedSubsidyTotal = mooeSubsidyTotal + capitalOutlaySubsidyTotal;

      const incomeTotal = parseNumeric(incomeGrandTotal) || 0;
      const bt = calculateTotalBudget;
      const personnelTotalFinal = bt?.personnelTotal ?? personnelTotal;
      const mooeTotalFinal = bt?.mooeTotal ?? mooeTotal;
      const capitalOutlayTotalFinal = bt?.capitalOutlayTotal ?? capitalOutlayTotal;
      const expensesTotal = mooeTotalFinal + capitalOutlayTotalFinal;
      const budgetarySupportTotal = bt?.budgetarySupportTotal || 0;

      const isIncomeBalanced = Math.abs(incomeTotal - combinedIncomeTotal) < 0.01;
      const isSubsidyBalanced = Math.abs(budgetarySupportTotal - combinedSubsidyTotal) < 0.01;
      const isBalanced = Math.abs(expensesTotal - incomeTotal) < 0.01;

      return {
        personnelTotal: personnelTotalFinal,
        mooeTotal: mooeTotalFinal,
        capitalOutlayTotal: capitalOutlayTotalFinal,
        expensesTotal,
        incomeTotal,
        mooeIncomeTotal,
        capitalOutlayIncomeTotal,
        combinedIncomeTotal,
        isIncomeBalanced,
        mooeSubsidyTotal,
        capitalOutlaySubsidyTotal,
        combinedSubsidyTotal,
        isSubsidyBalanced,
        isBalanced,
      };
    } catch (error) {
      logger.error("Error calculating budget summary", error);
      return {
        personnelTotal: 0,
        mooeTotal: 0,
        capitalOutlayTotal: 0,
        expensesTotal: 0,
        incomeTotal: 0,
        mooeIncomeTotal: 0,
        capitalOutlayIncomeTotal: 0,
        combinedIncomeTotal: 0,
        isIncomeBalanced: false,
        mooeSubsidyTotal: 0,
        capitalOutlaySubsidyTotal: 0,
        combinedSubsidyTotal: 0,
        isSubsidyBalanced: false,
        isBalanced: false,
      };
    }
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeGrandTotal,
    selectedFiscalYear,
    activeFiscalYear,
    iasOMCostData,
    calculateTotalBudget,
    regionFilter,
    isEligibleForSubmission,
  ]);

  // Enhancement Functions (defined after all hooks to ensure proper dependency access)

  // Real-time validation
  const validateBudgetData = useCallback(() => {
    const errors = {};

    // Validate fiscal year and budget type
    if (!activeFiscalYear) errors.fiscalYear = "Fiscal year is required";
    if (!activeBudgetType) errors.budgetType = "Budget type is required";

    // Validate user information
    if (!currentUser?.Region) errors.region = "User region is missing";
    if (!currentUser?.FirstName || !currentUser?.LastName) {
      errors.user = "User name information is incomplete";
    }

    // Validate budget balance
    if (
      budgetSummary.incomeTotal > 0 &&
      budgetSummary.combinedIncomeTotal > 0
    ) {
      const imbalance = Math.abs(
        budgetSummary.incomeTotal - budgetSummary.combinedIncomeTotal
      );
      if (imbalance > 0.01) {
        errors.balance = `Budget is not balance. Difference: ₱${imbalance.toLocaleString()}`;
      }
    }

    // Validate minimum proposals
    const totalProposals =
      personnelData.length +
      mooeData.length +
      capitalOutlayData.length +
      incomeData.length +
      budgetarySupportData.length;
    if (totalProposals === 0) {
      errors.proposals = "At least one proposal is required";
    }

    setValidationErrors(errors);

    return Object.keys(errors).length === 0;
  }, [
    activeFiscalYear,
    activeBudgetType,
    currentUser,
    budgetSummary,
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
  ]);

  // Bulk Selection Functions
  const handleBulkSelect = useCallback((type, ids) => {
    setBulkSelection((prev) => ({
      ...prev,
      [type]: ids,
    }));
    setShowBulkActions(ids.length > 0);
  }, []);

  const handleSelectAll = useCallback(
    (type) => {
      let data = [];
      switch (type) {
        case "personnel":
          data = personnelData || [];
          break;
        case "mooe":
          data = mooeData || [];
          break;
        case "capitalOutlay":
          data = capitalOutlayData || [];
          break;
        case "income":
          data = incomeData || [];
          break;
        case "budgetarySupport":
          data = budgetarySupportData || [];
          break;
      }
      const eligibleIds = data
        .filter((item) =>
          isEligibleForSubmission(item.status || "Not Submitted")
        )
        .map((item) => item._id);
      handleBulkSelect(type, eligibleIds);
    },
    [
      personnelData,
      mooeData,
      capitalOutlayData,
      incomeData,
      budgetarySupportData,
      handleBulkSelect,
      isEligibleForSubmission,
    ]
  );

  const handleDeselectAll = useCallback(
    (type) => {
      handleBulkSelect(type, []);
    },
    [handleBulkSelect]
  );

  // Bulk Actions
  const handleBulkStatusChange = useCallback(
    async (newStatus) => {
      setLoading(true);
      try {
        const allSelectedIds = [
          ...bulkSelection.personnel,
          ...bulkSelection.mooe,
          ...bulkSelection.capitalOutlay,
          ...bulkSelection.income,
          ...bulkSelection.budgetarySupport,
        ];

        const payload = {
          personnelIds: bulkSelection.personnel,
          mooeIds: bulkSelection.mooe,
          capitalOutlayIds: bulkSelection.capitalOutlay,
          incomeIds: bulkSelection.income,
          budgetarySupportIds: bulkSelection.budgetarySupport,
          fiscalYear: activeFiscalYear,
          budgetType: activeBudgetType,
          processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
          region: activeRegion?.name || activeRegion?.regionName,
          userId: currentUser._id,
        };

        if (newStatus === "Submitted") {
          await api.post("/updateProposalStatus", payload);
        } else if (newStatus === "Draft") {
          await api.post("/saveAsDraft", payload);
        }

        // Log activity
        const activityEntry = {
          timestamp: new Date(),
          action: `Bulk ${newStatus}`,
          itemCount: allSelectedIds.length,
          user: `${currentUser.FirstName} ${currentUser.LastName}`,
          details: `${newStatus} ${allSelectedIds.length} proposals`,
        };
        setActivityLog((prev) => [activityEntry, ...prev.slice(0, 49)]); // Keep last 50 activities

        await fetchAllData();
        setBulkSelection({
          personnel: [],
          mooe: [],
          capitalOutlay: [],
          income: [],
          budgetarySupport: [],
        });
        setShowBulkActions(false);
        setBulkActionsAnchor(null);

        setSnackbar({
          open: true,
          message: `Successfully updated ${allSelectedIds.length} proposals to ${newStatus}`,
          severity: "success",
        });
      } catch (error) {
        handleApiError(error, toast, 'Bulk action');
        setSnackbar({
          open: true,
          message: "Failed to update selected proposals",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      bulkSelection,
      activeFiscalYear,
      activeBudgetType,
      currentUser,
      activeRegion,
    ]
  );

  // Export Functions
  const generatePDFReport = useCallback(async () => {
    try {
      setLoading(true);

      // Send only essential parameters, let server fetch data
      const exportParams = {
        fiscalYear: selectedFiscalYear || activeFiscalYear,
        budgetType: activeBudgetType,
        region: activeRegion?.name || activeRegion?.regionName,
        // Send only counts and totals, not full data arrays
        dataCounts: {
          personnel: personnelData?.length || 0,
          mooe: mooeData?.length || 0,
          capitalOutlay: capitalOutlayData?.length || 0,
          income: incomeData?.length || 0,
          budgetarySupport: budgetarySupportData?.length || 0,
        },
        budgetSummary: {
          grandTotal: budgetSummary?.grandTotal || 0,
          personnelTotal: budgetSummary?.personnelTotal || 0,
          mooeTotal: budgetSummary?.mooeTotal || 0,
          capitalOutlayTotal: budgetSummary?.capitalOutlayTotal || 0,
          budgetarySupportTotal: budgetSummary?.budgetarySupportTotal || 0,
          incomeTotal: budgetSummary?.incomeTotal || 0,
          isIncomeBalanced: budgetSummary?.isIncomeBalanced || false,
        },
      };

      const response = await api.post(
        "/api/export/budget-summary-pdf",
        exportParams,
        {
          responseType: "blob",
          timeout: 30000, // 30 second timeout
        }
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Budget_Summary_${
        selectedFiscalYear || activeFiscalYear
      }_${activeRegion?.name || "Region"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Log activity
      const activityEntry = {
        timestamp: new Date(),
        action: "Export PDF",
        user: `${currentUser.FirstName} ${currentUser.LastName}`,
        details: `Exported budget summary as PDF for FY ${
          selectedFiscalYear || activeFiscalYear
        }`,
      };
      setActivityLog((prev) => [activityEntry, ...prev.slice(0, 49)]);

      setSnackbar({
        open: true,
        message: "PDF report generated successfully",
        severity: "success",
      });
    } catch (error) {
      handleApiError(error, toast, 'PDF export');
      setSnackbar({
        open: true,
        message: "Failed to generate PDF report",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setExportMenuAnchor(null);
    }
  }, [
    selectedFiscalYear,
    activeFiscalYear,
    activeBudgetType,
    activeRegion,
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
    budgetSummary,
    currentUser,
  ]);

  const generateExcelReport = useCallback(async () => {
    try {
      setLoading(true);

      // Send only essential parameters, let server fetch data
      const exportParams = {
        fiscalYear: selectedFiscalYear || activeFiscalYear,
        budgetType: activeBudgetType,
        region: activeRegion?.name || activeRegion?.regionName,
        // Send only counts and totals, not full data arrays
        dataCounts: {
          personnel: personnelData?.length || 0,
          mooe: mooeData?.length || 0,
          capitalOutlay: capitalOutlayData?.length || 0,
          income: incomeData?.length || 0,
          budgetarySupport: budgetarySupportData?.length || 0,
        },
        budgetSummary: {
          grandTotal: budgetSummary?.grandTotal || 0,
          personnelTotal: budgetSummary?.personnelTotal || 0,
          mooeTotal: budgetSummary?.mooeTotal || 0,
          capitalOutlayTotal: budgetSummary?.capitalOutlayTotal || 0,
          budgetarySupportTotal: budgetSummary?.budgetarySupportTotal || 0,
          incomeTotal: budgetSummary?.incomeTotal || 0,
          isIncomeBalanced: budgetSummary?.isIncomeBalanced || false,
        },
      };

      const response = await api.post(
        "/api/export/budget-summary-excel",
        exportParams,
        {
          responseType: "blob",
          timeout: 30000, // 30 second timeout
        }
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Budget_Summary_${
        selectedFiscalYear || activeFiscalYear
      }_${activeRegion?.name || "Region"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Log activity
      const activityEntry = {
        timestamp: new Date(),
        action: "Export Excel",
        user: `${currentUser.FirstName} ${currentUser.LastName}`,
        details: `Exported budget summary as Excel for FY ${
          selectedFiscalYear || activeFiscalYear
        }`,
      };
      setActivityLog((prev) => [activityEntry, ...prev.slice(0, 49)]);

      setSnackbar({
        open: true,
        message: "Excel report generated successfully",
        severity: "success",
      });
    } catch (error) {
      handleApiError(error, toast, 'Excel export');
      setSnackbar({
        open: true,
        message: "Failed to generate Excel report",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setExportMenuAnchor(null);
    }
  }, [
    selectedFiscalYear,
    activeFiscalYear,
    activeBudgetType,
    activeRegion,
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
    budgetSummary,
    currentUser,
  ]);

  // Mobile Tab Component
  const MobileTabNavigation = () => (
    <Box sx={{ display: { xs: "block", md: "none" }, mb: 2 }}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab
          label="Income"
          value="Income"
          icon={<FaPesoSign size={16} />}
        />
        <Tab
          label="PS-Perm"
          value="PSPermanent"
          icon={<IoPersonCircleOutline size={16} />}
        />
        <Tab
          label="PS-Casual"
          value="PSCasual"
          icon={<IoPersonCircleOutline size={16} />}
        />
        <Tab
          label="PS-Charged"
          value="PSChargedToIncome"
          icon={<IoPersonCircleOutline size={16} />}
        />
        <Tab
          label="COS/JO"
          value="COS/JO"
          icon={<FaFileContract size={16} />}
        />
        <Tab label="MOOE" value="MOOE" icon={<GrHostMaintenance size={16} />} />
        <Tab
          label="Capital"
          value="Capital Outlay"
          icon={<FaPesoSign size={16} />}
        />
        <Tab
          label="Budget"
          value="Budgetary Support"
          icon={<FaProjectDiagram size={16} />}
        />
      </Tabs>
    </Box>
  );

  // Activity Log Component
  const ActivityLogDialog = () => (
    <Dialog
      open={showActivityLog}
      onClose={() => setShowActivityLog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <HistoryIcon />
        Activity Log
      </DialogTitle>
      <DialogContent>
        <List sx={{ maxHeight: 400, overflow: "auto" }}>
          {activityLog.length === 0 ? (
            <ListItem>
              <ListItemText primary="No activities recorded yet" />
            </ListItem>
          ) : (
            activityLog.map((activity, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    {activity.action.includes("Export") ? (
                      <GetAppIcon />
                    ) : activity.action.includes("Bulk") ? (
                      <SelectAllIcon />
                    ) : (
                      <EditIcon />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.action}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {activity.details}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          by {activity.user} •{" "}
                          {activity.timestamp.toLocaleString()}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < activityLog.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowActivityLog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  // Add this useEffect to fetch the active fiscal year and budget type
  useEffect(() => {
    const fetchActiveSettings = async () => {
      // Region identifier for effective due date (considers region-specific extensions)
      const regionId = activeRegion?.id || activeRegion?._id || activeRegion?.name || activeRegion?.regionName || activeRegion?.Region;
      const params = regionId ? { region: regionId } : {};

      try {
        const activeResponse = await api.get("/settings/active", { params });
        if (activeResponse.data) {
          const fiscalYear = activeResponse.data.fiscalYear || "";
          setActiveFiscalYear(fiscalYear);
          setSelectedFiscalYear(fiscalYear); // Set selected fiscal year to active by default
          setActiveBudgetType(activeResponse.data.budgetType || "");

          // Prefer effectiveDueDate (region-aware) when region has extension; else main due date
          let dueDate = null;
          if (activeResponse.data.effectiveDueDate) {
            dueDate = new Date(activeResponse.data.effectiveDueDate);
          } else {
            const budgetPeriods = activeResponse.data.budgetPeriods;
            if (budgetPeriods && budgetPeriods.length > 0) {
              const activePeriod = budgetPeriods.find(p => p.isActive);
              if (activePeriod?.dueDate) dueDate = new Date(activePeriod.dueDate);
            }
            if (!dueDate && activeResponse.data.dueDate) {
              dueDate = new Date(activeResponse.data.dueDate);
            }
          }

          if (dueDate) {
            setActiveDueDate(dueDate);
            setIsDueDatePassed(new Date() > dueDate);
          } else {
            setActiveDueDate(null);
            setIsDueDatePassed(false);
          }
        } else {
          logger.warn("No active settings data returned from API");
        }
      } catch (activeError) {
        logger.error("Error fetching active settings", activeError);
        toast.error("Failed to fetch active fiscal year settings");
      }

      // Fetch all available fiscal years (in a separate try/catch to avoid one failure affecting the other)
      try {
        const fiscalYearsResponse = await api.get("/settings/fiscal-years");
        const yearsData =
          fiscalYearsResponse.data?.data || fiscalYearsResponse.data || [];
        if (Array.isArray(yearsData)) {
          // Make sure we have at least the active fiscal year in the list
          setAvailableFiscalYears(yearsData);
        } else {
          logger.warn("No fiscal years data returned or data is not an array");
          // If we don't get a valid response, at least include the active fiscal year
          if (activeFiscalYear) {
            setAvailableFiscalYears([activeFiscalYear]);
          }
        }
      } catch (fiscalYearsError) {
        logger.error("Error fetching fiscal years", fiscalYearsError);
        // Don't show a toast for this error since we already have the active fiscal year
        // Just make sure we have the active fiscal year in the list
        if (activeFiscalYear) {
          setAvailableFiscalYears([activeFiscalYear]);
        }
      }
    };

    fetchActiveSettings();
  }, [activeRegion?.id, activeRegion?._id, activeRegion?.name, activeRegion?.Region]);

  // Add event listener for capital outlay data changes
  useEffect(() => {
    const handleCapitalOutlayDataChanged = () => {
      // Refresh capital outlay data specifically
      queryClient.invalidateQueries([QUERY_KEYS.capitalOutlay]);
      queryClient.refetchQueries([QUERY_KEYS.capitalOutlay]);
    };

    window.addEventListener(
      "capitalOutlayDataChanged",
      handleCapitalOutlayDataChanged
    );

    return () => {
      window.removeEventListener(
        "capitalOutLayDataChanged",
        handleCapitalOutlayDataChanged
      );
    };
  }, [queryClient]);

  // Add this helper function near the top of your component
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(value || 0)
      .replace("PHP", "₱");
  };

  // Enhanced status indicator component
  const StatusChip = ({ status, count }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case "Draft":
          return "default";
        case "Division Submitted":
          return "primary";
        case "Forwarded to Reviewer":
          return "primary";
        case "Forwarded to Officer":
          return "info";
        case "Officer Approved":
          return "warning";
        case "Forwarded to Manager":
          return "warning";
        case "Finalized":
          return "success";
        case "Returned":
          return "error";
        case "Not Submitted":
          return "default";
        default:
          return "default";
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case "Draft":
          return <EditIcon fontSize="small" />;
        case "Division Submitted":
          return <CheckCircleIcon fontSize="small" />;
        case "Forwarded to Officer":
          return <CheckCircleIcon fontSize="small" />;
        case "Officer Approved":
          return <CheckCircleIcon fontSize="small" />;
        case "Forwarded to Manager":
          return <CheckCircleIcon fontSize="small" />;
        case "Finalized":
          return <CheckCircleIcon fontSize="small" />;
        case "Returned":
          return <ErrorIcon fontSize="small" />;
        case "Not Submitted":
          return <PendingIcon fontSize="small" />;
        default:
          return null;
      }
    };

    return (
      <Chip
        label={`${status} (${count})`}
        color={getStatusColor(status)}
        size="small"
        variant="outlined"
        icon={getStatusIcon(status)}
        sx={{ mr: 1, mb: 1 }}
      />
    );
  };

  // Calculate status counts
  const getStatusCounts = () => {
    // Get the active region
    const userRegion = activeRegion?.name || activeRegion?.regionName;

    // Use the selected fiscal year for filtering (fall back to active fiscal year if not set)
    const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;
    // Debug fiscal year distribution
    const fiscalYearDistribution = {
      personnel: {},
      mooe: {},
      capitalOutlay: {},
      budgetarySupport: {},
    };

    personnelData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearDistribution.personnel[fy] =
        (fiscalYearDistribution.personnel[fy] || 0) + 1;
    });

    mooeData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearDistribution.mooe[fy] =
        (fiscalYearDistribution.mooe[fy] || 0) + 1;
    });

    capitalOutlayData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearDistribution.capitalOutlay[fy] =
        (fiscalYearDistribution.capitalOutlay[fy] || 0) + 1;
    });

    budgetarySupportData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearDistribution.budgetarySupport[fy] =
        (fiscalYearDistribution.budgetarySupport[fy] || 0) + 1;
    });
    // Filter proposals by selected fiscal year AND active region
    // Only show items from the user's region
    const filteredPersonnelData = personnelData.filter((p) => {
      const matches =
        p.fiscalYear === fiscalYearToUse && p.region === userRegion;
      if (!matches && p.region === userRegion) {
      }
      return matches;
    });

    const filteredMooeData = mooeData.filter((p) => {
      const matches =
        p.fiscalYear === fiscalYearToUse && p.region === userRegion;
      if (!matches && p.region === userRegion) {
      }
      return matches;
    });

    const filteredCapitalOutlayData = capitalOutlayData.filter((p) => {
      const matches =
        p.fiscalYear === fiscalYearToUse && p.region === userRegion;
      if (!matches && p.region === userRegion) {
      }
      return matches;
    });

    const filteredBudgetarySupportData = budgetarySupportData.filter((p) => {
      const matches =
        p.fiscalYear === fiscalYearToUse && p.region === userRegion;
      if (!matches && p.region === userRegion) {
      }
      return matches;
    });

    // Exclude incomeData since it's projection/target data, not actual proposals
    // Only count proposals from active fiscal year and region (for drafts) to match Dashboard
    const allProposals = [
      ...filteredPersonnelData,
      ...filteredMooeData,
      ...filteredCapitalOutlayData,
      ...filteredBudgetarySupportData,
    ];
    const statusCounts = {};

    // Debug logging to see what statuses we're getting
    // Check fiscal year distribution to find discrepancy
    const fiscalYearBreakdown = {
      personnel: Object.create(null),
      mooe: Object.create(null),
      capitalOutlay: Object.create(null),
      budgetarySupport: Object.create(null),
    };

    personnelData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearBreakdown.personnel[fy] =
        (fiscalYearBreakdown.personnel[fy] || 0) + 1;
    });

    mooeData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearBreakdown.mooe[fy] = (fiscalYearBreakdown.mooe[fy] || 0) + 1;
    });

    capitalOutlayData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearBreakdown.capitalOutlay[fy] =
        (fiscalYearBreakdown.capitalOutlay[fy] || 0) + 1;
    });

    budgetarySupportData.forEach((p) => {
      const fy = p.fiscalYear || "undefined";
      fiscalYearBreakdown.budgetarySupport[fy] =
        (fiscalYearBreakdown.budgetarySupport[fy] || 0) + 1;
    });

    // Detailed count breakdown for comparison with Dashboard
    // Detailed breakdown of "Not Submitted" items (using filtered data)
    const notSubmittedItems = allProposals.filter(
      (p) => (p.status || "Not Submitted") === "Not Submitted"
    );
    // console.log("Not Submitted Items Breakdown (Region: " + userRegion + "):", {
    //   count: notSubmittedItems.length,
    //   personnel: filteredPersonnelData
    //     .filter((p) => (p.status || "Not Submitted") === "Not Submitted")
    //     .map((p) => ({
    //       id: p._id,
    //       name: p.employeeName || p.name,
    //       region: p.region,
    //       type: "Personnel",
    //     })),
    //   mooe: filteredMooeData
    //     .filter((p) => (p.status || "Not Submitted") === "Not Submitted")
    //     .map((p) => ({
    //       id: p._id,
    //       name: p.accountingTitle || p.sublineItem,
    //       region: p.region,
    //       type: "MOOE",
    //     })),
    //   capitalOutlay: filteredCapitalOutlayData
    //     .filter((p) => (p.status || "Not Submitted") === "Not Submitted")
    //     .map((p) => ({
    //       id: p._id,
    //       name: p.accountingTitle,
    //       region: p.region,
    //       type: "Capital Outlay",
    //     })),
    //   budgetarySupport: filteredBudgetarySupportData
    //     .filter((p) => (p.status || "Not Submitted") === "Not Submitted")
    //     .map((p) => ({
    //       id: p._id,
    //       name: p.accountingTitle || p.description,
    //       region: p.region,
    //       type: "Budgetary Support",
    //     })),
    // });

    allProposals.forEach((proposal) => {
      const status = proposal.status || "Not Submitted";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // console.log("Final status counts:", statusCounts);
    return statusCounts;
  };

  // Auto-save status indicator
  const AutoSaveIndicator = () => {
    const getStatusText = () => {
      if (saveStatus === "saving") return "Saving...";
      if (saveStatus === "error") return "Save failed";
      if (lastSaved) return `Last saved: ${lastSaved.toLocaleTimeString()}`;
      return "All changes saved";
    };

    const getStatusColor = () => {
      if (saveStatus === "saving") return "info";
      if (saveStatus === "error") return "error";
      if (hasUnsavedChanges) return "warning";
      return "success";
    };

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {saveStatus === "saving" && <CircularProgress size={16} />}
        <Typography
          variant="caption"
          color={`${getStatusColor()}.main`}
          sx={{ fontWeight: "medium" }}
        >
          {getStatusText()}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveEnabled}
              onChange={(e) => setAutoSaveEnabled(e.target.checked)}
              size="small"
            />
          }
          label="Auto-save"
          sx={{ ml: 2 }}
        />
      </Box>
    );
  };

  if (activeBudgetType && !isActiveBudgetTypeAllowed) {
    return <Navigate to="/not-authorized" replace />;
  }

  return (
    <Box sx={{ p: 0, bgcolor: "white", minHeight: "100vh" }}>
      {/* Modern Header Section */}
      <Paper
        elevation={0}
        className="db-welcome-grid"
        sx={{
          p: 3,
          borderRadius: 0,
          background: theme.palette.mode === "dark" 
            ? "linear-gradient(135deg, #1b4332 0%, #2d5016 50%, #375e38 100%)"
            : "linear-gradient(135deg, #1e3d22 0%, #375e38 50%, #4e7d4f 100%)",
          color: "white",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
          borderBottom: "1px solid rgba(167, 201, 87, 0.2)",
          transition: "all 0.3s ease",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Box
            sx={{
              background: "linear-gradient(135deg, rgba(52, 211, 153, 0.2) 0%, rgba(52, 211, 153, 0.05) 100%)",
              p: 1.5,
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(52, 211, 153, 0.25)",
              boxShadow: "0 8px 24px -4px rgba(52, 211, 153, 0.2)",
              backdropFilter: "blur(4px)",
            }}
          >
            <BusinessCenterIcon sx={{ fontSize: "2rem", color: "#34d399" }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h1"
              gutterBottom
              sx={{ 
                fontWeight: 900, 
                fontSize: "2.8rem",
                m: 0,
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                letterSpacing: "-0.5px"
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body1"
              component="h2"
              sx={{ 
                opacity: 0.8, 
                fontSize: "0.85rem",
                mt: 0.5,
                fontWeight: 500,
                letterSpacing: "0.2px"
              }}
            >
              {description || "Submit and manage your budget proposals"}
            </Typography>
          </Box>
        </Box>
 
        {/* Premium Metadata Chips */}
        <Box className="db-welcome-chips" sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          {/* Active Region Chip */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              bgcolor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "999px",
              py: 0.8,
              px: 2.2,
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              transition: "all 0.25s ease",
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(52, 211, 153, 0.4)",
                transform: "translateY(-1.5px)",
              }
            }}
          >
            <LocationOnIcon sx={{ fontSize: "1.1rem", color: "#34d399" }} />
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.05em", color: "rgba(255,255,255,0.9)" }}>
              REGION: {String(activeRegionName || "ALL REGIONS").toUpperCase()}
            </Typography>
          </Box>
 
          {/* Active FY Chip */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.2,
              bgcolor: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "999px",
              py: 0.8,
              px: 2.2,
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              transition: "all 0.25s ease",
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(56, 189, 248, 0.4)",
                transform: "translateY(-1.5px)",
              }
            }}
          >
            <CalendarTodayIcon sx={{ fontSize: "1.05rem", color: "#38bdf8" }} />
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.05em", color: "rgba(255,255,255,0.9)" }}>
              FY {resolvedFiscalYear || "N/A"} - {String(resolvedBudgetType || "Initial").toUpperCase()}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <StyledBox>
        {/* Concurrency Lock Banner */}
        {!hasLock && lockStatus.isLocked && lockStatus.lockedBy && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              🔒 Locked by {lockStatus.lockedBy.userName && lockStatus.lockedBy.userName !== 'undefined' ? lockStatus.lockedBy.userName : 'Another User'} {lockStatus.lockedBy.userRole && lockStatus.lockedBy.userRole !== 'undefined' ? `(${lockStatus.lockedBy.userRole})` : ''}
            </Typography>
            <Typography variant="caption" display="block">
              This proposal is currently being edited by another user. You can view the data, but saving is disabled to prevent conflicts.
            </Typography>
          </Alert>
        )}

        {/* Create Proposal Dialog */}
        <Dialog
          open={isCreateDialogOpen}
          onClose={() => {
            setCreateDialogOpen(false);
            setPrivacyNoticeAccepted(false);
          }}
        >
          <DialogTitle>Create New Budget Proposal</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Title"
              type="text"
              fullWidth
              variant="standard"
              value={newProposalData.title}
              onChange={(e) =>
                setNewProposalData({
                  ...newProposalData,
                  title: e.target.value,
                })
              }
            />
            <TextField
              margin="dense"
              label="Description"
              type="text"
              fullWidth
              multiline
              rows={4}
              variant="standard"
              value={newProposalData.description}
              onChange={(e) =>
                setNewProposalData({
                  ...newProposalData,
                  description: e.target.value,
                })
              }
            />
            {/* <TextField
              margin="dense"
              label="Projected Corporate Income (optional)"
              type="number"
              fullWidth
              variant="standard"
              value={newProposalData.projectedCorporateIncome}
              onChange={(e) =>
                setNewProposalData({
                  ...newProposalData,
                  projectedCorporateIncome: e.target.value,
                })
              }
              placeholder="0.00"
              helperText="Optional: high-level estimate only. You can leave this blank; totals will be computed from line items."
              inputProps={{ step: "0.01", min: "0" }}
            />
            <TextField
              margin="dense"
              label="Projected Subsidy (optional)"
              type="number"
              fullWidth
              variant="standard"
              value={newProposalData.projectedSubsidy}
              onChange={(e) =>
                setNewProposalData({
                  ...newProposalData,
                  projectedSubsidy: e.target.value,
                })
              }
              placeholder="0.00"
              helperText="Optional: estimate of subsidy. You can leave this blank; you may encode details later."
              inputProps={{ step: "0.01", min: "0" }}
            /> */}
            <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                icon={<CalendarTodayIcon />}
                label={`Fiscal Year: ${activeFiscalYear || "N/A"}`}
                color="primary"
                size="small"
              />
              <Chip
                icon={<AccountBalanceIcon />}
                label={`Budget Type: ${
                  activeBudgetType || newProposalData.modelType || "Initial"
                }`}
                color={
                  (activeBudgetType || newProposalData.modelType || "Initial") === "NEP"
                    ? "warning"
                    : (activeBudgetType || newProposalData.modelType || "Initial") === "GAA"
                    ? "success"
                    : "primary"
                }
                size="small"
              />
              {regionCeilingAmount != null && (activeBudgetType || "").toUpperCase() === "NEP" && (
                <Chip
                  label={`Region NEP Ceiling: ₱${Number(regionCeilingAmount || 0).toLocaleString(
                    "en-PH",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )}`}
                  color="secondary"
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 400 }}
                />
              )}
              {divisionCeilingInfo != null && (activeBudgetType || "").toUpperCase() === "NEP" && (
                <Chip
                  label={`${divisionCeilingInfo.division || divisionCeilingInfo.department || "Your"} NEP Ceiling: ₱${Number(divisionCeilingInfo.ceilingAmount || 0).toLocaleString(
                    "en-PH",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )}`}
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>

            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: "#f8fafc",
                border: "1px solid #dbe4f0",
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={newProposalData.carryForwardPreviousYear}
                    disabled={
                      normalizeModelType(
                        activeBudgetType || newProposalData.modelType || "Initial"
                      ) !== "Initial"
                    }
                    onChange={(e) =>
                      setNewProposalData((prev) => ({
                        ...prev,
                        carryForwardPreviousYear: e.target.checked,
                      }))
                    }
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Carry forward previous fiscal year data
                  </Typography>
                }
                sx={{ alignItems: "flex-start", m: 0 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", pl: 4.5 }}>
                For new Initial proposals, this copies linked Income, MOOE, and Capital Outlay rows from your latest matching prior fiscal year proposal.
              </Typography>
            </Box>

            {/* Privacy Notice / Certification */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                backgroundColor: "#f5f5f5",
                borderRadius: 2,
                border: "1px solid #e0e0e0",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, mb: 1, color: headerBg }}
              >
                PRIVACY NOTICE / CERTIFICATION
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={privacyNoticeAccepted}
                    onChange={(e) => setPrivacyNoticeAccepted(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{ textAlign: "justify", lineHeight: 1.6, color: "red"}}
                  >
                    I certify that the attached or uploaded digital document is
                    a true and faithful copy of the original, and that all
                    information provided through the Online Submission of Budget
                    Proposal Information System (OSBPIS) is complete, true, and
                    correct to the best of my knowledge. I confirm that the
                    document has not been altered in any way. I understand that
                    any false certification, misrepresentation, or falsification
                    may subject me to administrative, civil, and/or criminal
                    liability under applicable laws. I further acknowledge that,
                    upon certification, my electronic signature will be
                    automatically affixed to this submission as proof of this
                    certification within the system.
                  </Typography>
                }
                sx={{ alignItems: "flex-start", mt: 1 }}
              />
            </Box>
          </DialogContent>
          <DialogActions
            sx={{
              flexDirection: "column",
              alignItems: "stretch",
              gap: 1,
              p: 2,
            }}
          >
            {/* Debug: Show what's missing */}
            {(!newProposalData.title ||
              !activeFiscalYear ||
              !activeRegion ||
              !privacyNoticeAccepted) && (
              <Box
                sx={{
                  fontSize: "12px",
                  color: "error.main",
                  textAlign: "center",
                }}
              >
                Missing: {!newProposalData.title && "Title, "}
                {!activeFiscalYear && "Fiscal Year, "}
                {!activeRegion && "Region"}
                {!privacyNoticeAccepted && ", Privacy Notice Acceptance"}
              </Box>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              {currentProposalId && (
                <Button
                  color="error"
                  variant="outlined"
                  disabled={deleteProposalMutation.isLoading}
                  onClick={() => {
                    setDeleteConfirmDialog({ open: true, source: "dialog" });
                  }}
                >
                  {deleteProposalMutation.isLoading
                    ? "Deleting..."
                    : "Delete & Create New"}
                </Button>
              )}
              <Button
                onClick={handleCreateProposal}
                variant="contained"
                color="primary"
                disabled={
                  createProposalMutation.isLoading ||
                  !newProposalData.title ||
                  !activeFiscalYear ||
                  !activeRegion ||
                  !privacyNoticeAccepted ||
                  (isDueDatePassed && !isSuperAdmin)
                }
              >
                {createProposalMutation.isLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  "Create"
                )}
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
            p: 2.5,
            background: "linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)",
            borderRadius: 2,
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Chip
              icon={<CalendarTodayIcon />}
              label={`Active FY: ${activeFiscalYear || "N/A"}`}
              color="primary"
              variant="filled"
              size="small"
              sx={{
                backgroundColor: headerBg,
                fontWeight: 600,
                letterSpacing: "0.3px",
                "& .MuiChip-icon": {
                  color: "white !important",
                },
              }}
            />
            {selectedFiscalYear && selectedFiscalYear !== activeFiscalYear && (
              <Chip
                icon={<CalendarTodayIcon />}
                label={`Selected FY: ${selectedFiscalYear}`}
                color="secondary"
                variant="filled"
                size="small"
                sx={{
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  "& .MuiChip-icon": {
                    color: "white !important",
                  },
                }}
              />
            )}
            <Chip
              icon={<AccountBalanceIcon />}
              label={`Budget: ${activeBudgetType || "N/A"}`}
              color="primary"
              variant="filled"
              size="small"
              sx={{
                backgroundColor: "#2d5016",
                fontWeight: 600,
                letterSpacing: "0.3px",
                "& .MuiChip-icon": {
                  color: "white !important",
                },
              }}
            />
            {/* Due Date Chip - shows warning when passed */}
            {activeDueDate && (
              <Chip
                icon={<CalendarTodayIcon />}
                label={`Due: ${activeDueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}${isDueDatePassed ? ' (EXPIRED)' : ''}`}
                color={isDueDatePassed ? "error" : "success"}
                variant="filled"
                size="small"
                sx={{
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  "& .MuiChip-icon": {
                    color: "white !important",
                  },
                  animation: isDueDatePassed ? "pulse 1.5s infinite" : "none",
                  "@keyframes pulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.7 },
                  },
                }}
              />
            )}
            {!currentProposalId && (
              <Tooltip
                title={
                  isDueDatePassed && !isSuperAdmin
                    ? `Submission period ended on ${activeDueDate?.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Contact your administrator to extend the deadline.`
                    : ""
                }
              >
                <span>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setCreateDialogOpen(true)}
                    disabled={isResumingDraft || createProposalMutation.isLoading || (isDueDatePassed && !isSuperAdmin)}
                    startIcon={
                      isResumingDraft || createProposalMutation.isLoading ? (
                        <CircularProgress size={16} />
                      ) : null
                    }
                sx={{
                  ml: 1,
                  backgroundColor: isDueDatePassed && !isSuperAdmin ? "#9e9e9e" : "#4CAF50",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  borderRadius: "6px",
                  padding: "6px 16px",
                  textTransform: "capitalize",
                  boxShadow: isDueDatePassed && !isSuperAdmin ? "none" : "0 2px 6px rgba(76, 175, 80, 0.3)",
                  transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                  "&:hover": {
                    backgroundColor: isDueDatePassed && !isSuperAdmin ? "#9e9e9e" : "#45a049",
                    boxShadow: isDueDatePassed && !isSuperAdmin ? "none" : "0 4px 12px rgba(76, 175, 80, 0.4)",
                    transform: isDueDatePassed && !isSuperAdmin ? "none" : "translateY(-2px)",
                  },
                  "&:active": {
                    transform: "translateY(0px)",
                  },
                }}
                  >
                    {isResumingDraft 
                      ? "Loading..."
                      : createProposalMutation.isLoading
                      ? "Creating..."
                      : isDueDatePassed && !isSuperAdmin
                      ? "Due Date Passed"
                      : "+ Create Proposal"}
                  </Button>
                </span>
              </Tooltip>
            )}

            {currentProposalId && showUploadButton && (
              <Button
                variant="contained"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => {
                  setUploadType(activeTab);
                  setUploadDialogOpen(true);
                  setSelectedFile(null);
                  setUploadResult(null);
                }}
                sx={{
                  ml: 1,
                  backgroundColor: "#2d5016",
                  fontWeight: 600,
                  borderRadius: "6px",
                  "&:hover": { backgroundColor: "#1e3a0f" }
                }}
              >
                Upload Excel
              </Button>
            )}

            {/* Show Proposal Linked chip only for Super Admin, hide for Budget Preparer */}
            {currentProposalId && isSuperAdmin && (
              <Tooltip
                title={`Linked Proposal ID: ${currentProposalId} - Click to DELETE and unlink this proposal`}
              >
                <Chip
                  icon={<CheckCircleIcon />}
                  label={
                    deleteProposalMutation.isLoading
                      ? "Deleting..."
                      : "Proposal Linked"
                  }
                  onDelete={() => {
                    setDeleteConfirmDialog({ open: true, source: "chip" });
                  }}
                  disabled={deleteProposalMutation.isLoading}
                  sx={{
                    backgroundColor: "#4CAF50",
                    color: "white",
                    fontWeight: 600,
                    letterSpacing: "0.3px",
                    cursor: "pointer",
                    "& .MuiChip-icon": {
                      color: "white !important",
                    },
                    "& .MuiChip-deleteIcon": {
                      color: "white !important",
                      "&:hover": {
                        color: "#f0f0f0 !important",
                      },
                    },
                  }}
                />
              </Tooltip>
            )}
          </Box>
          <AutoSaveIndicator />
        </Box>

        {/* Delete Proposal Confirmation Dialog */}
        <Dialog
          open={deleteConfirmDialog.open}
          onClose={() => setDeleteConfirmDialog({ open: false, source: null })}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: "#d32f2f",
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: 1,
              fontWeight: 600,
            }}
          >
            ⚠️ Delete Proposal Confirmation
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body1" fontWeight="bold">
                Are you sure you want to DELETE this proposal?
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              This action will:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>
                <Typography variant="body2">
                  Permanently remove the proposal from the database
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Remove it from the All Proposals list
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  Delete all associated budget entries (Income, MOOE, Capital
                  Outlay, Personnel Services)
                </Typography>
              </li>
            </Box>
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                This action cannot be undone!
              </Typography>
            </Alert>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
              onClick={() =>
                setDeleteConfirmDialog({ open: false, source: null })
              }
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                deleteProposalMutation.mutate(currentProposalId);
                setDeleteConfirmDialog({ open: false, source: null });
                if (deleteConfirmDialog.source === "dialog") {
                  setCreateDialogOpen(false);
                }
              }}
              variant="contained"
              color="error"
              disabled={deleteProposalMutation.isLoading}
              sx={{ minWidth: 150 }}
            >
              {deleteProposalMutation.isLoading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1, color: "white" }} />{" "}
                  Deleting...
                </>
              ) : (
                "Yes, Delete Proposal"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Collapsible Budget Summary */}
        {import.meta.env.VITE_HIDE_BUDGET_SUMMARY !== "true" && (
          <Accordion
            expanded={summaryExpanded}
            onChange={() => setSummaryExpanded(!summaryExpanded)}
            sx={{
              mb: 2,
              background: "linear-gradient(135deg, #fafafa 0%, #ffffff 100%)",
              border: "1px solid #e0e0e0",
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              },
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{
                minHeight: "45px",
                background: "linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)",
                "& .MuiAccordionSummary-content": {
                  margin: "8px 0",
                  alignItems: "center",
                },
                "&:hover": {
                  backgroundColor: "rgba(76, 175, 80, 0.04)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  mr: 2,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", fontSize: "0.9rem" }}
                >
                  📊 Budget Summary
                </Typography>
                <Chip
                  label={formatCurrency(calculateTotalBudget.grandTotal)}
                  color="primary"
                  size="small"
                  sx={{ fontSize: "0.7rem", height: "20px" }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1.5 }}>
              {/* NEP Ceiling Warning */}
              {divisionCeilingInfo != null &&
                (activeBudgetType || "").toUpperCase() === "NEP" &&
                calculateTotalBudget.grandTotal > (divisionCeilingInfo.ceilingAmount || 0) && (
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" fontWeight="bold">
                      ⚠️ Budget Exceeds NEP Ceiling
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Your proposal total ({formatCurrency(calculateTotalBudget.grandTotal)}) exceeds the NEP ceiling for{" "}
                      {divisionCeilingInfo.division || divisionCeilingInfo.department || "your division"} (
                      {formatCurrency(divisionCeilingInfo.ceilingAmount)}). Please adjust your budget to stay within the ceiling.
                    </Typography>
                  </Alert>
                )}
              {/* Budget Overview Row */}
              <Box sx={{ mb: 1.5 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: "bold", fontSize: "0.9rem", mb: 1 }}
                >
                  💰 Budget Overview
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 1,
                      background:
                        "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
                      borderRadius: 1,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid rgba(76, 175, 80, 0.2)",
                      transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                      "&:hover": {
                        boxShadow: "0 4px 8px rgba(76, 175, 80, 0.15)",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.7rem", fontWeight: 600 }}
                    >
                      Personnel Services
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                        color: "#1b5e20",
                        mt: 0.5,
                      }}
                    >
                      {formatCurrency(calculateTotalBudget.personnelTotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 1,
                      background:
                        "linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)",
                      borderRadius: 1,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid rgba(0, 150, 136, 0.2)",
                      transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                      "&:hover": {
                        boxShadow: "0 4px 8px rgba(0, 150, 136, 0.15)",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.7rem", fontWeight: 600 }}
                    >
                      MOOE (Regular + IAs O&M)
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                        color: "#004d40",
                        mt: 0.5,
                      }}
                    >
                      {formatCurrency(calculateTotalBudget.mooeTotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 1,
                      background:
                        "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
                      borderRadius: 1,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                      border: "1px solid rgba(255, 152, 0, 0.2)",
                      transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                      "&:hover": {
                        boxShadow: "0 4px 8px rgba(255, 152, 0, 0.15)",
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.7rem", fontWeight: 600 }}
                    >
                      Capital Outlay
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                        color: "#e65100",
                        mt: 0.5,
                      }}
                    >
                      {formatCurrency(calculateTotalBudget.capitalOutlayTotal)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Income Summary Row */}
              <Box sx={{ mb: 1.5 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold", fontSize: "0.9rem" }}
                  >
                    📊 Expenses Under Corporate Income
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CompareArrowsIcon
                      color={
                        budgetSummary.isIncomeBalanced ? "success" : "error"
                      }
                      sx={{ fontSize: "16px" }}
                    />
                    <Typography
                      variant="caption"
                      color={
                        budgetSummary.isIncomeBalanced
                          ? "success.main"
                          : "error.main"
                      }
                      sx={{ fontWeight: "bold", fontSize: "0.7rem" }}
                    >
                      {budgetSummary.isIncomeBalanced
                        ? "Balanced"
                        : "Unbalanced"}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                      MOOE (Regular + IAs O&M)
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatCurrency(budgetSummary.mooeIncomeTotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                      Capital Outlay
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatCurrency(budgetSummary.capitalOutlayIncomeTotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                      Total
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatCurrency(budgetSummary.combinedIncomeTotal)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: budgetSummary.isIncomeBalanced
                        ? "#4caf50"
                        : "#f44336",
                      color: "white",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.7rem", color: "white" }}
                    >
                      Corporate Income
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                        color: "white",
                      }}
                    >
                      {formatCurrency(budgetSummary.incomeTotal)}
                    </Typography>
                  </Box>
                </Box>
                {!budgetSummary.isIncomeBalanced && (
                  <Typography
                    variant="caption"
                    color="error.main"
                    sx={{
                      display: "block",
                      textAlign: "center",
                      mt: 0.5,
                      fontWeight: "bold",
                      fontSize: "0.7rem",
                    }}
                  >
                    Diff: ₱
                    {Math.abs(
                      (budgetSummary.incomeTotal || 0) -
                        (budgetSummary.combinedIncomeTotal || 0)
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                )}
              </Box>

              {/* Subsidy Summary Row */}
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold", fontSize: "0.9rem" }}
                  >
                    🏛️ Budgetary Support Summary
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CompareArrowsIcon
                      color={
                        budgetSummary.isSubsidyBalanced ? "success" : "error"
                      }
                      sx={{ fontSize: "16px" }}
                    />
                    <Typography
                      variant="caption"
                      color={
                        budgetSummary.isSubsidyBalanced
                          ? "success.main"
                          : "error.main"
                      }
                      sx={{ fontWeight: "bold", fontSize: "0.7rem" }}
                    >
                      {budgetSummary.isSubsidyBalanced
                        ? "Balanced"
                        : "Unbalanced"}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                      MOOE Subsidy (Regular + IAs O&M)
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatCurrency(budgetSummary.mooeSubsidyTotal || 0)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: "0.7rem" }}>
                      Capital Subsidy
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatCurrency(
                        budgetSummary.capitalOutlaySubsidyTotal || 0
                      )}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      textAlign: "center",
                      p: 0.5,
                      backgroundColor: budgetSummary.isSubsidyBalanced
                        ? "#4caf50"
                        : "#f44336",
                      color: "white",
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: "0.7rem", color: "white" }}
                    >
                      Budgetary
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        fontWeight: "bold",
                        fontSize: "0.8rem",
                        color: "white",
                      }}
                    >
                      {formatCurrency(
                        calculateTotalBudget.budgetarySupportTotal || 0
                      )}
                    </Typography>
                  </Box>
                </Box>
                {!budgetSummary.isSubsidyBalanced && (
                  <Typography
                    variant="caption"
                    color="error.main"
                    sx={{
                      display: "block",
                      textAlign: "center",
                      mt: 0.5,
                      fontWeight: "bold",
                      fontSize: "0.7rem",
                    }}
                  >
                    Diff: ₱
                    {Math.abs(
                      (budgetSummary.mooeSubsidyTotal || 0) +
                        (budgetSummary.capitalOutlaySubsidyTotal || 0) -
                        (calculateTotalBudget.budgetarySupportTotal || 0)
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Main Content Container */}
        <Box sx={{ mx: 2, mt: 1.5, mb: 3 }}>
          {/* Mobile Navigation */}
          <MobileTabNavigation />

          {/* Desktop Tab Navigation */}
          <Paper
            sx={{
              boxShadow: theme.palette.mode === "dark" 
                ? "0 8px 30px rgba(0,0,0,0.4)" 
                : "0 10px 30px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)",
              borderRadius: "16px",
              overflow: "hidden",
              border: theme.palette.mode === "dark"
                ? "1px solid rgba(167, 201, 87, 0.18)"
                : "1px solid rgba(0, 0, 0, 0.06)",
              transition: "all 0.3s ease",
              bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#ffffff",
              backdropFilter: "blur(12px)",
              display: { xs: "none", md: "block" },
              mb: 3,
            }}
          >
            {/* Tabs Header - Premium Solid Segmented Control */}
            <Box
              sx={{
                background: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016",
                px: 2,
                py: 1.25,
                display: "flex",
                justifyContent: "center",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  bgcolor: "transparent",
                  width: "100%",
                  gap: 0.5,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  "&::-webkit-scrollbar": {
                    height: "4px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: "2px",
                  }
                }}
              >
                {[
                  { label: "INCOME", value: "Income", Icon: FiTrendingUp, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "PS - Permanent", value: "PSPermanent", Icon: FiUserCheck, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "PS - Casual", value: "PSCasual", Icon: FiUsers, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "PS - Charged", value: "PSChargedToIncome", Icon: FiCreditCard, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "COS/JO", value: "COS/JO", Icon: FiBriefcase, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "MOOE", value: "MOOE", Icon: FiFileText, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "CAPITAL OUTLAY", value: "Capital Outlay", Icon: FiCpu, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                  { label: "BSGC", value: "Budgetary Support", Icon: FiAward, color: theme.palette.mode === "dark" ? "#0b2413" : "#2d5016" },
                ].map((tab, index) => {
                  const isActive = activeTab === tab.value;
                  const Icon = tab.Icon;
                  return (
                    <ButtonBase
                      key={index}
                      onClick={() => setActiveTab(tab.value)}
                      sx={{
                        flex: 1,
                        bgcolor: isActive 
                          ? "#ffffff" 
                          : "transparent",
                        color: isActive 
                          ? (theme.palette.mode === "dark" ? "#0b2413" : "#2d5016") 
                          : "rgba(255, 255, 255, 0.75)",
                        fontSize: "0.78rem",
                        fontWeight: isActive ? 800 : 600,
                        py: 1,
                        px: 1.5,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.8,
                        minWidth: 110,
                        whiteSpace: "nowrap",
                        boxShadow: isActive ? "0 2px 6px rgba(0, 0, 0, 0.15)" : "none",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          color: isActive 
                            ? (theme.palette.mode === "dark" ? "#0b2413" : "#2d5016") 
                            : "#ffffff",
                          bgcolor: isActive 
                            ? "#ffffff" 
                            : "rgba(255, 255, 255, 0.08)",
                          "& .tab-icon-wrapper": {
                            transform: "scale(1.1)",
                          }
                        },
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "#ffffff",
                          outlineOffset: "2px",
                        }
                      }}
                    >
                      <Box 
                        className="tab-icon-wrapper"
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          transition: 'transform 0.2s', 
                          color: isActive ? tab.color : 'inherit' 
                        }}
                      >
                        <Icon size={14} />
                      </Box>
                      {tab.label}
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>
          </Paper>

          {/* Tab Content Rendering */}
          <Box sx={{ mt: 3, mb: 3, width: "100%" }} key={refreshKey}>
            {activeTab === "Income" && (
              <IncomeTable
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                budgetType={resolvedBudgetType}
                locked={isEffectivelyReadOnly}
                onGrandTotalUpdate={handleIncomeGrandTotalUpdate}
                onGroupedItemsUpdate={handleGroupedItemsUpdate}
              />
            )}

            {activeTab === "PSPermanent" && (
              <PSPermanentServiceTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                locked={isEffectivelyReadOnly}
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "PSCasual" && (
              <PSCasualServiceTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                locked={isEffectivelyReadOnly}
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "PSChargedToIncome" && (
              <PSChargedToIncomeTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                locked={isEffectivelyReadOnly}
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "COS/JO" && (
              <PSCOSCustomPageTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                locked={isEffectivelyReadOnly}
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "MOOE" && (
              <Mooe
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={resolvedFiscalYear}
                locked={isEffectivelyReadOnly}
                proposalId={
                  currentProposalId ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "Capital Outlay" &&
              (useDataGridView ? (
                <CapitalOutlayDataGrid
                  dataListName={dataListName}
                  schema={schema}
                  region={activeRegion}
                  fiscalYear={resolvedFiscalYear}
                  locked={isEffectivelyReadOnly}
                  proposalId={
                    currentProposalId ||
                    (dataListName !== "tests" ? dataListName : undefined)
                  }
                />
              ) : (
                <CapitalOutlayTable
                  dataListName={dataListName}
                  schema={schema}
                  region={activeRegion}
                  fiscalYear={resolvedFiscalYear}
                  locked={isEffectivelyReadOnly}
                  proposalId={
                    currentProposalId ||
                    (dataListName !== "tests" ? dataListName : undefined)
                  }
                />
              ))}

            {activeTab === "Budgetary Support" && (
              <>
                {!resolvedBudgetType || !resolvedFiscalYear ? (
                  <Box
                    sx={{
                      p: 3,
                      textAlign: "center",
                      backgroundColor: "#f5f5f5",
                      borderRadius: 1,
                    }}
                  >
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body2" color="textSecondary">
                      Loading Budgetary Support data...
                    </Typography>
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ mt: 1 }}
                    >
                      Fiscal Year: {resolvedFiscalYear || "Loading..."}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Budget Type: {resolvedBudgetType || "Loading..."}
                    </Typography>
                  </Box>
                ) : (
                  <BudgetarySupportTable
                    proposalId={currentProposalId}
                    fiscalYear={resolvedFiscalYear}
                    budgetType={resolvedBudgetType}
                    incomeGrandTotal={incomeGrandTotal}
                    groupedItems={groupedItems}
                    onChargedToIncomeChange={setChargedToIncomeAmount}
                    onNonChargedPersonnelServicesChange={
                      setNonChargedPersonnelServices
                    }
                    onBudgetDeficitChange={setBudgetDeficit}
                  />
                )}
              </>
            )}
          </Box>

          {/* Enhanced Button Group with Export and Bulk Actions */}
          {showBulkActions && (
            <div className="button-group">
              {/* Bulk Actions Button */}
              <Button
                variant="outlined"
                color="primary"
                onClick={(e) => setBulkActionsAnchor(e.currentTarget)}
                startIcon={<SelectAllIcon />}
                sx={{ mr: 1 }}
              >
                Bulk Actions (
                {bulkSelection.personnel.length +
                  bulkSelection.mooe.length +
                  bulkSelection.capitalOutlay.length +
                  bulkSelection.income.length +
                  bulkSelection.budgetarySupport.length}
                )
              </Button>

              {/* TEMP: Hide Submit All Proposals and Save as Draft buttons */}
              {(canCreate || canEditOwn) && (
                <>
                  <Tooltip
                    title={
                      readOnly
                        ? "Account is in read-only mode"
                        : !canEditOwn
                        ? "You don't have permission to submit proposals. Please contact your administrator."
                        : !budgetSummary.isIncomeBalanced
                        ? "Combined Income Total must equal Corporate Income before submission"
                        : ""
                    }
                  >
                    <span style={{ display: "inline-block" }}>
                      {/* <Button
                      variant="contained"
                      color="primary"
                      onClick={handleOpenDialog}
                      disabled={
                        readOnly ||
                        !canEditOwn ||
                        !anyNotSubmitted ||
                        isSubmitting
                      }
                      startIcon={<BalanceIcon />}
                      sx={{
                        mr: 1,
                        py: 1,
                        px: { xs: 2, sm: 3 },
                        fontSize: { xs: "0.8rem", sm: "0.9rem" },
                        backgroundColor: "#375e38",
                        "&:hover": {
                          backgroundColor: "#2e4e2f",
                        },
                      }}
                    >
                      Submit All Proposals
                    </Button> */}
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      readOnly
                        ? "Account is in read-only mode"
                        : Object.keys(validationErrors).length > 0
                        ? "Please fix validation errors before saving"
                        : !anyNotSubmitted
                        ? "No eligible proposals to save as draft. All proposals may already be submitted or there are no proposals to save."
                        : isSubmitting
                        ? "Currently processing. Please wait..."
                        : "Save all eligible proposals as draft"
                    }
                    arrow
                  >
                    <span style={{ display: "inline-block" }}>
                      {/* <Button
                      variant="outlined"
                      color="success"
                      onClick={() => handleSaveAsDraft()}
                      disabled={!canEditOwn || !anyNotSubmitted || isSubmitting || Object.keys(validationErrors).length > 0 || readOnly}
                      startIcon={
                        saveStatus === "saving" ? (
                          <CircularProgress size={16} />
                        ) : (
                          <SaveIcon />
                        )
                      }
                      sx={{
                        py: 1,
                        px: { xs: 2, sm: 3 },
                        fontSize: { xs: "0.8rem", sm: "0.9rem" },
                        borderColor:
                          Object.keys(validationErrors).length > 0
                            ? "#f44336"
                            : "#375e38",
                        color:
                          Object.keys(validationErrors).length > 0
                            ? "#f44336"
                            : "#375e38",
                        "&:hover": {
                          borderColor:
                            Object.keys(validationErrors).length > 0
                              ? "#d32f2f"
                              : "#2e4e2f",
                          backgroundColor:
                            Object.keys(validationErrors).length > 0
                              ? "rgba(244, 67, 54, 0.04)"
                              : "rgba(55, 94, 56, 0.04)",
                        },
                      }}
                    >
                      {saveStatus === "saving" ? "Saving..." : "Save as Draft"}
                    </Button> */}
                    </span>
                  </Tooltip>
                </>
              )}
            </div>
          )}
        </Box>

        {/* Mobile Speed Dial for Actions */}
        {isMobile && (
          <SpeedDial
            ariaLabel="Mobile Actions"
            sx={{
              position: "fixed",
              bottom: 16,
              right: 16,
              display: { xs: "block", md: "none" },
            }}
            icon={<SpeedDialIcon />}
            open={speedDialOpen}
            onClose={() => setSpeedDialOpen(false)}
            onOpen={() => setSpeedDialOpen(true)}
          >

            {showBulkActions && (
              <SpeedDialAction
                icon={<SelectAllIcon />}
                tooltipTitle="Bulk Actions"
                onClick={(e) => setBulkActionsAnchor(e.currentTarget)}
              />
            )}
          </SpeedDial>
        )}

        {/* Bulk Actions Menu */}
        <Menu
          anchorEl={bulkActionsAnchor}
          open={Boolean(bulkActionsAnchor)}
          onClose={() => setBulkActionsAnchor(null)}
        >
          <MenuItem onClick={() => handleBulkStatusChange("Draft")}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Save Selected as Draft</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleBulkStatusChange("Submitted")}>
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Submit Selected</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              const currentType =
                activeTab === "PSPermanent" ||
                activeTab === "PSCasual" ||
                activeTab === "PSChargedToIncome" ||
                activeTab === "COS/JO"
                  ? "personnel"
                  : activeTab === "MOOE"
                  ? "mooe"
                  : activeTab === "Capital Outlay"
                  ? "capitalOutlay"
                  : activeTab === "Income"
                  ? "income"
                  : "budgetarySupport";
              handleSelectAll(currentType);
              setBulkActionsAnchor(null);
            }}
          >
            <ListItemIcon>
              <SelectAllIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Select All in Tab</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setBulkSelection({
                personnel: [],
                mooe: [],
                capitalOutlay: [],
                income: [],
                budgetarySupport: [],
              });
              setShowBulkActions(false);
              setBulkActionsAnchor(null);
            }}
          >
            <ListItemIcon>
              <DeselectIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Deselect All</ListItemText>
          </MenuItem>
        </Menu>

        {/* Activity Log Dialog */}
        <ActivityLogDialog />

        {/* Export Menu */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          <MenuItem onClick={generatePDFReport}>
            <ListItemIcon>
              <PictureAsPdfIcon />
            </ListItemIcon>
            <ListItemText primary="Export as PDF" />
          </MenuItem>
          <MenuItem onClick={generateExcelReport}>
            <ListItemIcon>
              <GetAppIcon />
            </ListItemIcon>
            <ListItemText primary="Export as Excel" />
          </MenuItem>
        </Menu>

        {/* Bulk Upload Dialog */}
        <Dialog 
          open={uploadDialogOpen} 
          onClose={() => !isUploading && setUploadDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
            <CloudUploadIcon color="primary" />
            Bulk Upload {uploadType}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Upload an Excel file to bulk create {uploadType} items. These will be automatically linked to the current proposal.
              </Typography>
              
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                sx={{ mb: 3, mt: 1 }}
              >
                Download Excel Template
              </Button>

              <Box 
                sx={{ 
                  p: 3, 
                  border: "2px dashed #e0e0e0", 
                  borderRadius: 2, 
                  textAlign: "center",
                  bgcolor: "#fafafa",
                  mb: 2,
                  cursor: "pointer",
                  "&:hover": { borderColor: hoverBorder, bgcolor: hoverBg }
                }}
                onClick={() => document.getElementById("bulk-upload-input").click()}
              >
                <input
                  type="file"
                  id="bulk-upload-input"
                  hidden
                  accept=".xlsx, .xls"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                <CloudUploadIcon sx={{ fontSize: 48, color: "#bdbdbd", mb: 1 }} />
                <Typography variant="body1" fontWeight={500}>
                  {selectedFile ? selectedFile.name : "Click to select Excel file"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supported formats: .xlsx, .xls
                </Typography>
              </Box>

              {isUploading && (
                <Box sx={{ width: "100%", mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, display: "flex", justifyContent: "space-between" }}>
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}

              {uploadResult && (
                <Box sx={{ mt: 2 }}>
                  <Alert severity={uploadResult.success ? "success" : "error"}>
                    {uploadResult.message}
                  </Alert>
                  
                  {uploadResult.details && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: "#f8fafc", borderRadius: 1, border: "1px solid #e2e8f0" }}>
                      <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                        Upload Summary:
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block" }}>
                        - Total Processed: {uploadResult.details.totalRows || 0}
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "success.main" }}>
                        - Successfully Saved: {uploadResult.details.savedCount ?? uploadResult.details.success ?? 0}
                      </Typography>
                      <Typography variant="caption" sx={{ display: "block", color: "error.main" }}>
                        - Failed/Skipped: {uploadResult.details.failedCount ?? uploadResult.details.failed ?? uploadResult.details.duplicatesCount ?? 0}
                      </Typography>
                    </Box>
                  )}

                  {uploadResult.details && uploadResult.details.errors && uploadResult.details.errors.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: "error.main" }}>
                        ⚠️ Errors Found ({uploadResult.details.errors.length}):
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, overflowY: "auto" }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f8fafc", fontSize: "0.75rem" }}>Row</TableCell>
                              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f8fafc", fontSize: "0.75rem" }}>Category / Item</TableCell>
                              <TableCell sx={{ fontWeight: "bold", bgcolor: "#f8fafc", fontSize: "0.75rem" }}>Error Message</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {uploadResult.details.errors.map((err, idx) => (
                              <TableRow key={idx} sx={{ bgcolor: idx % 2 === 0 ? "#fafafa" : "white" }}>
                                <TableCell sx={{ fontSize: "0.7rem" }}>{err.row}</TableCell>
                                <TableCell sx={{ fontSize: "0.7rem" }}>{err.category || err.sublineItem || err.title || "N/A"}</TableCell>
                                <TableCell sx={{ fontSize: "0.7rem", color: "error.main" }}>{err.error}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                setUploadDialogOpen(false);
                if (uploadResult?.success) {
                  setRefreshKey(prev => prev + 1);
                }
              }} 
              disabled={isUploading}
            >
              {uploadResult ? "Close" : "Cancel"}
            </Button>
            {!uploadResult && (
              <Button 
                onClick={handleFileUpload} 
                variant="contained" 
                disabled={!selectedFile || isUploading}
                startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              >
                Upload Now
              </Button>
            )}
          </DialogActions>
        </Dialog>

        <CustomSnackbar
          open={snackbar.open}
          message={snackbar.message}
          severity={snackbar.severity}
          onClose={handleSnackbarClose}
        />

        {/* Debug Info (visible only for troubleshooting):
      <Box sx={{ mt: 4, p: 2, background: '#f9fbe7', border: '1px dashed #bdb76b', borderRadius: 2 }}>
        <Typography variant="caption" color="#888" fontWeight="bold">
          Debug Info (visible only for troubleshooting):
        </Typography>
        <pre style={{ fontSize: 12, color: '#333', margin: 0 }}>
          {JSON.stringify({
            regularMooeIncome: budgetSummary.mooeBreakdown?.regular?.income,
            iasOMIncome: budgetSummary.mooeBreakdown?.iasOM?.income,
            mooeIncome: budgetSummary.mooeBreakdown?.regular?.income + budgetSummary.mooeBreakdown?.iasOM?.income,
            regularMooeSubsidy: budgetSummary.mooeBreakdown?.regular?.subsidy,
            iasOMSubsidy: budgetSummary.mooeBreakdown?.iasOM?.subsidy,
            mooeSubsidy: budgetSummary.mooeBreakdown?.regular?.subsidy + budgetSummary.mooeBreakdown?.iasOM?.subsidy,
            total: budgetSummary.mooeBreakdown?.total,
            raw: budgetSummary
          }, null, 2)}
        </pre>
      </Box> */}
      </StyledBox>
    </Box>
  );
};

ProposalCustomPage.propTypes = {
  dataListName: PropTypes.string.isRequired,
  schema: PropTypes.object.isRequired,
  title: PropTypes.string,
  description: PropTypes.string,
  searchable: PropTypes.bool,
};

export default ProposalCustomPage;
