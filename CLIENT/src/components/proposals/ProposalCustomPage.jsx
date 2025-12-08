import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import api from "../../config/api";

import PropTypes from "prop-types";
import { useRegion } from "../../context/RegionContext";
import { IoPersonCircleOutline } from "react-icons/io5";
import { GrHostMaintenance } from "react-icons/gr";
import { FaMoneyBill } from "react-icons/fa";
import { FaFileContract } from "react-icons/fa6";
import { FaMoneyCheckAlt } from "react-icons/fa";
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
import ErrorBoundary from "../../global/components/ErrorBoundary";
import "./Tabs.css";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Typography,
  Alert,
  Paper,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Switch,
  FormControlLabel,
  Checkbox,
  Menu,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  Drawer,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fab,
  InputAdornment,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useUser } from "../../context/UserContext";
import BalanceIcon from "@mui/icons-material/Balance";
import CustomSnackbar from "../../global/components/CustomSnackbar";
import { FaProjectDiagram } from "react-icons/fa";
import BudgetarySupportTable from "../budgetarysupport/BudgetarySupportTable";
import { toast } from "react-toastify";
import LockIcon from "@mui/icons-material/Lock";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import PendingIcon from "@mui/icons-material/Pending";
// New icons for enhancements
import GetAppIcon from "@mui/icons-material/GetApp";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import DeselectIcon from "@mui/icons-material/Deselect";
import HistoryIcon from "@mui/icons-material/History";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import DraftsIcon from "@mui/icons-material/Drafts";
import SearchIcon from "@mui/icons-material/Search";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BudgetSummary from "./BudgetSummary";
import { hasPermission, PERMISSIONS } from "../../utils/permissions";
import { useUserRestrictions } from "../../hooks/useUserRestrictions";
import { styled } from "@mui/material/styles";

const CAPITAL_OUTLAY_VIEW_PREFERENCE_KEY = "capitalOutlayViewPreference";

const StyledTab = styled((props) => <Tab {...props} />)(({ theme }) => ({
  textTransform: "none",
  minWidth: 0,
  padding: '12px 16px',
  [theme.breakpoints.up("sm")]: {
    minWidth: 0,
  },
  fontWeight: theme.typography.fontWeightRegular,
  marginRight: theme.spacing(1),
  color: "rgba(0, 0, 0, 0.7)",
  borderRadius: '8px 8px 0 0',
  transition: 'all 0.3s ease',
  "&:hover": {
    backgroundColor: "rgba(55, 94, 56, 0.08)",
    color: theme.palette.primary.main,
    "& svg": {
      transform: "scale(1.2)",
      color: theme.palette.primary.main,
    },
  },
  "&.Mui-selected": {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: "rgba(55, 94, 56, 0.12)",
  },
  "& .MuiSvgIcon-root, & svg": {
    marginRight: theme.spacing(1),
    fontSize: "1.2rem",
    transition: 'transform 0.3s ease',
  },
}));

const ProposalCustomPage = ({
  dataListName,
  schema,
  title = "Budget Proposal Entry",
  description = "",
  searchable = true,
}) => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const { readOnly, canCreate, canDelete } = useUserRestrictions();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [regionFilter, setRegionFilter] = useState("");
  const [personnelData, setPersonnelData] = useState([]);
  const [mooeData, setMooeData] = useState([]);
  const [capitalOutlayData, setCapitalOutlayData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [budgetarySupportData, setBudgetarySupportData] = useState([]);
  const [activeTab, setActiveTab] = useState("Income");
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFiscalYear, setActiveFiscalYear] = useState("");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
  const [activeBudgetType, setActiveBudgetType] = useState("");
  const [budgetDeficit, setBudgetDeficit] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // State for the new proposal form
  const [newProposalData, setNewProposalData] = useState({
    title: "",
    description: "",
    projectedCorporateIncome: "",
    projectedSubsidy: "",
    modelType: "Initial", // Will be auto-overridden by active settings
  });
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentProposalId, setCurrentProposalId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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
          sessionStorage.setItem('activeWorkflowRef', proposalId);
          localStorage.setItem('activeWorkflowRef', proposalId);
        }
      } catch (_) {}
      toast.success("Proposal created successfully!");
      setCreateDialogOpen(false);
      setNewProposalData({
        title: "",
        description: "",
        projectedCorporateIncome: "",
        projectedSubsidy: "",
        modelType: "Initial",
      });
    },
    onError: (error) => {
      toast.error(
        `Error creating proposal: ${error.response?.data?.message || error.message}`
      );
    },
  });

  // Normalize modelType coming from active settings to the enum accepted by backend
  const normalizeModelType = (value) => {
    if (!value) return 'Initial';
    const v = String(value).trim().toUpperCase();
    if (v.includes('NEP')) return 'NEP';
    if (v.includes('GAA')) return 'GAA';
    // Default bucket for anything like "INITIAL", "BUDGET: INITIAL", etc.
    return 'Initial';
  };

  const handleCreateProposal = () => {
    const {
      title,
      description,
      projectedCorporateIncome,
      projectedSubsidy,
      modelType,
    } = newProposalData;
    if (!title) {
      toast.error("Title is required.");
      return;
    }
    // Prefer sending region NAME to satisfy legacy/middleware validators
    const regionPayload = typeof activeRegion === 'object'
      ? (activeRegion.name || activeRegion.regionName || activeRegion.Region || 'CENTRAL OFFICE')
      : (activeRegion || 'CENTRAL OFFICE');

    const modelTypeNormalized = normalizeModelType(activeBudgetType || modelType || 'Initial');

    createProposalMutation.mutate({
      title,
      description,
      projectedCorporateIncome: (Number(projectedCorporateIncome) || 0) + (Number(chargedToIncomeAmount) || 0),
      projectedSubsidy: (Number(projectedSubsidy) || 0) + (Number(nonChargedPersonnelServices) || 0),
      modelType: modelTypeNormalized,
      fiscalYear: Number(activeFiscalYear) || new Date().getFullYear(),
      region: regionPayload,
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  
  // Capital Outlay view toggle (true = new DataGrid, false = old table)
  const [useDataGridView, setUseDataGridView] = useState(false);

  // Use canCreate from the hook, but keep canEditOwn from permissions
  const canEditOwn = hasPermission(currentUser, PERMISSIONS.EDIT_OWN);
  // Initialize budgetSummary with default values
  const [budgetSummary, setBudgetSummary] = useState({
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
  });
  // Add a state to track the income grand total from IncomeTable
  const [incomeGrandTotal, setIncomeGrandTotal] = useState(0);
  // Add state for tracking if income fields should be disabled
  const [disableIncomeInputs, setDisableIncomeInputs] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [groupedItems, setGroupedItems] = useState({});
  const [chargedToIncomeAmount, setChargedToIncomeAmount] = useState(0);
  const [nonChargedPersonnelServices, setNonChargedPersonnelServices] = useState(0);

  // Enhanced UX state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved', 'saving', 'error'
  const [validationErrors, setValidationErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  // ADDED: Restore activeWorkflowRef from storage on mount to preserve proposal ID across page refreshes
  useEffect(() => {
    const storedWorkflowRef = sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef');
    if (storedWorkflowRef && !currentProposalId) {
      setCurrentProposalId(storedWorkflowRef);
    }
  }, []);

  // NEW: Check backend for existing proposals for this fiscal year and budget type
  // This ensures the button is disabled even in a different browser session
  useEffect(() => {
    const checkExistingProposals = async () => {
      if (!activeFiscalYear || !activeBudgetType || !currentUser?.UserId) {
        return;
      }

      try {
        // Query for existing proposals: use view='my-proposals' to get DRAFT proposals
        // Then also check for submitted/approved proposals with explicit status queries
        const draftResponse = await api.get('/api/allproposal/proposals', {
          params: {
            view: 'my-proposals', // This filters for createdBy current user and status=DRAFT
            fiscalYear: activeFiscalYear
          }
        });

        const draftProposals = draftResponse.data?.proposals || draftResponse.data?.data || [];
        
        // Also check for submitted/approved proposals
        const allProposalsResponse = await api.get('/api/allproposal/proposals', {
          params: {
            view: 'all-proposals', // Non-DRAFT proposals
            fiscalYear: activeFiscalYear
          }
        });

        const allProposals = allProposalsResponse.data?.proposals || allProposalsResponse.data?.data || [];
        
        // Combine and filter by createdBy
        const allUserProposals = [
          ...draftProposals,
          ...allProposals
        ].filter(p => String(p.createdBy) === String(currentUser.UserId) || p.createdByName === `${currentUser.FirstName} ${currentUser.LastName}`);

        if (allUserProposals.length > 0) {
          // Found existing proposal(s) - set the first one
          const existingProposal = allUserProposals[0];
          setCurrentProposalId(existingProposal.workflowRef || existingProposal._id);
          sessionStorage.setItem('activeWorkflowRef', existingProposal.workflowRef || existingProposal._id);
          console.log('Found existing proposal:', existingProposal);
        } else if (currentProposalId) {
          // No proposals found but currentProposalId is set - proposal was deleted
          // Clear the state and storage
          console.log('Proposal was deleted from database. Clearing currentProposalId.');
          setCurrentProposalId(null);
          sessionStorage.removeItem('activeWorkflowRef');
          localStorage.removeItem('activeWorkflowRef');
        }
      } catch (error) {
        console.error('Error checking existing proposals:', error);
        // Don't disable button on error - allow user to proceed
      }
    };

    checkExistingProposals();
  }, [activeFiscalYear, activeBudgetType, currentUser?.UserId]);

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
      setNewProposalData(prev => ({ ...prev, modelType: activeBudgetType }));
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

  // Real-time validation
  const validateBudgetData = useCallback(() => {
    setIsValidating(true);
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
    setIsValidating(false);

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

  // Helper function - must be defined before enhancement functions
  const isEligibleForSubmission = (status) =>
    status === "Not Submitted" || status === "Returned" || status === "Draft";

  // Define query keys
  const QUERY_KEYS = {
    personnel: "personnelServices",
    mooe: "mooeServices",
    capitalOutlay: "capitalOutlayServices",
    income: "incomeServices",
    budgetarySupport: "budgetarySupportServices",
  };

  // React Query client
  const queryClient = useQueryClient();

  // Enhancement Functions will be defined after useQuery hooks

  // Run validation when data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateBudgetData();
    }, 500); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [validateBudgetData]);

  const hasDrafts =
    personnelData.some((p) => p.status === "Draft") ||
    mooeData.some((p) => p.status === "Draft") ||
    capitalOutlayData.some((p) => p.status === "Draft") ||
    incomeData.some((p) => p.status === "Draft");

  const anyNotSubmitted = useMemo(() => {
    // Temporarily exclude budgetary support from the calculation to isolate the issue
    const result =
      personnelData.some((p) => isEligibleForSubmission(p.status)) ||
      mooeData.some((p) => isEligibleForSubmission(p.status)) ||
      capitalOutlayData.some((p) => isEligibleForSubmission(p.status)) ||
      incomeData.some((p) => isEligibleForSubmission(p.status));
    // TODO: Re-add budgetary support once data loading is confirmed
    // || budgetarySupportData.some((p) => isEligibleForSubmission(p.status));

    // Debug logging to help identify why save as draft might be disabled
    // console.log("Debug - anyNotSubmitted calculation:", {
    //   result,
    //   personnelEligible: personnelData.filter((p) =>
    //     isEligibleForSubmission(p.status)
    //   ).length,
    //   mooeEligible: mooeData.filter((p) => isEligibleForSubmission(p.status))
    //     .length,
    //   capitalOutlayEligible: capitalOutlayData.filter((p) =>
    //     isEligibleForSubmission(p.status)
    //   ).length,
    //   incomeEligible: incomeData.filter((p) =>
    //     isEligibleForSubmission(p.status)
    //   ).length,
    //   budgetarySupportEligible: budgetarySupportData.filter((p) =>
    //     isEligibleForSubmission(p.status)
    //   ).length,
    //   totalPersonnel: personnelData.length,
    //   totalMooe: mooeData.length,
    //   totalCapitalOutlay: capitalOutlayData.length,
    //   totalIncome: incomeData.length,
    //   totalBudgetarySupport: budgetarySupportData.length,
    //   // Show actual data and statuses to debug
    //   personnelStatuses: personnelData.map((item) => ({
    //     id: item._id,
    //     status: item.status,
    //   })),
    //   mooeStatuses: mooeData.map((item) => ({
    //     id: item._id,
    //     status: item.status,
    //   })),
    //   capitalOutlayStatuses: capitalOutlayData.map((item) => ({
    //     id: item._id,
    //     status: item.status,
    //   })),
    //   incomeStatuses: incomeData.map((item) => ({
    //     id: item._id,
    //     status: item.status,
    //   })),
    //   budgetarySupportStatuses: budgetarySupportData.map((item) => ({
    //     id: item._id,
    //     status: item.status,
    //   })),
    //   // Show what statuses are considered eligible
    //   eligibleStatuses: ["Not Submitted", "Returned", "Draft"],
    // });

    return result;
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    budgetarySupportData,
  ]);

  // Detect if there are any proposals at all for the currently selected fiscal year
  const hasAnyProposalsForFY = useMemo(() => {
    const counts = [
      Array.isArray(personnelData) ? personnelData.length : 0,
      Array.isArray(mooeData) ? mooeData.length : 0,
      Array.isArray(capitalOutlayData) ? capitalOutlayData.length : 0,
      Array.isArray(incomeData) ? incomeData.length : 0,
      Array.isArray(budgetarySupportData) ? budgetarySupportData.length : 0,
    ];
    return counts.reduce((a, b) => a + b, 0) > 0;
  }, [personnelData, mooeData, capitalOutlayData, incomeData, budgetarySupportData]);

  // Lock only when there ARE proposals for this FY and none of them are editable (i.e., not Draft/Returned/Not Submitted)
  // If there are NO proposals for the selected FY, keep it unlocked so users can start creating.
  const submissionLocked = useMemo(() => {
    if (!hasAnyProposalsForFY) return false;
    return !anyNotSubmitted;
  }, [hasAnyProposalsForFY, anyNotSubmitted]);

  // Auto-save functionality (moved here after anyNotSubmitted is declared)
  useEffect(() => {
    if (
      !autoSaveEnabled ||
      !anyNotSubmitted ||
      isSubmitting ||
      !hasUnsavedChanges
    )
      return;

    const autoSaveInterval = setInterval(async () => {
      if (currentUser && activeFiscalYear && activeBudgetType) {
        setSaveStatus("saving");
        try {
          await handleSaveAsDraft(true); // Pass true to indicate auto-save
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          setSaveStatus("saved");
        } catch (error) {
          console.error("Auto-save failed:", error);
          setSaveStatus("error");
        }
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [
    autoSaveEnabled,
    anyNotSubmitted,
    isSubmitting,
    hasUnsavedChanges,
    currentUser,
    activeFiscalYear,
    activeBudgetType,
  ]);

  // Keyboard shortcuts (moved here after anyNotSubmitted is declared)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault();
            if (
              anyNotSubmitted &&
              !isSubmitting &&
              Object.keys(validationErrors).length === 0
            ) {
              handleSaveAsDraft();
            }
            break;
          case "Enter":
            if (e.shiftKey) {
              e.preventDefault();
              if (
                anyNotSubmitted &&
                !isSubmitting &&
                budgetSummary.isIncomeBalanced &&
                Object.keys(validationErrors).length === 0
              ) {
                handleOpenDialog();
              }
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    anyNotSubmitted,
    isSubmitting,
    validationErrors,
    budgetSummary.isIncomeBalanced,
  ]);

  // Create a callback function to receive the grand total from IncomeTable
  const handleIncomeGrandTotalUpdate = useCallback(
    (total) => {
      const regionName = activeRegion?.name || activeRegion?.regionName || 'Unknown';
      setIncomeGrandTotal(total);

      // Calculate total from MOOE and Capital Outlay
      const mooeIncomeTotal = mooeData.reduce(
        (sum, item) => sum + (parseFloat(item.income) || 0),
        0
      );
      const capitalOutlayIncomeTotal = capitalOutlayData.reduce(
        (sum, item) => sum + (parseFloat(item.income) || 0),
        0
      );
      const combinedTotal = mooeIncomeTotal + capitalOutlayIncomeTotal;
      // Set disable flag if totals match or if user is in read-only mode
      setDisableIncomeInputs(Math.abs(total - combinedTotal) < 0.01 || readOnly); // Using small epsilon for float comparison
    },
    [mooeData, capitalOutlayData, activeRegion, readOnly]
  );

  const calculateBudgetSummary = useCallback(() => {
    try {
      // Use the selected fiscal year for filtering (fall back to active fiscal year if not set)
      const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;

      // Filter data by fiscal year
      const filteredPersonnelData = Array.isArray(personnelData)
        ? personnelData.filter((p) => p && p.fiscalYear === fiscalYearToUse)
        : [];
      const filteredMooeData = Array.isArray(mooeData)
        ? mooeData.filter((p) => p && p.fiscalYear === fiscalYearToUse)
        : [];
      const filteredCapitalOutlayData = Array.isArray(capitalOutlayData)
        ? capitalOutlayData.filter((p) => p && p.fiscalYear === fiscalYearToUse)
        : [];
      const filteredIncomeData = Array.isArray(incomeData)
        ? incomeData.filter((p) => p && p.fiscalYear === fiscalYearToUse)
        : [];

      // Calculate personnel total with proper type conversion
      const personnelTotal = Array.isArray(filteredPersonnelData)
        ? filteredPersonnelData.reduce((sum, p) => {
            if (!p) return sum;

            return (
              sum +
              (Number(p.annualSalary) || 0) +
              (Number(p.RATA) || 0) +
              (Number(p.PERA) || 0) +
              (Number(p.uniformALLOWANCE) || 0) +
              (Number(p.productivityIncentive) || 0) +
              (Number(p.medical) || 0) +
              (Number(p.childrenAllowance) || 0) +
              (Number(p.meal) || 0) +
              (Number(p.cashGift) || 0) +
              (Number(p.subsistenceAllowanceMDS) || 0) +
              (Number(p.subsistenceAllowanceST) || 0) +
              (Number(p.midyearBonus) || 0) +
              (Number(p.yearEndBonus) || 0) +
              (Number(p.gsisPremium) || 0) +
              (Number(p.philhealthPremium) || 0) +
              (Number(p.pagibigPremium) || 0) +
              (Number(p.employeeCompensation) || 0) +
              (Number(p.loyaltyAward) || 0) +
              (Number(p.overtimePay) || 0) +
              (Number(p.earnedLeaves) || 0) +
              (Number(p.retirementBenefits) || 0) +
              (Number(p.terminalLeave) || 0) +
              (Number(p.courtAppearance) || 0)
            );
          }, 0)
        : 0;

      // Calculate regular MOOE total with proper type conversion
      const mooeRegularTotal = Array.isArray(filteredMooeData)
        ? filteredMooeData.reduce((sum, p) => {
            if (!p) return sum;
            return sum + (Number(p.amount) || 0);
          }, 0)
        : 0;

      // Calculate IAs O&M Cost total (ALWAYS include if present)
      const iasOMCostTotal = iasOMCostData
        ? (Number(iasOMCostData.nis) || 0) +
          (Number(iasOMCostData.cis) || 0) +
          (Number(iasOMCostData.nisSubsidy) || 0) +
          (Number(iasOMCostData.cisSubsidy) || 0)
        : 0;

      // Total MOOE is regular MOOE plus IAs O&M Cost
      const mooeTotal = mooeRegularTotal + iasOMCostTotal;

      // Calculate Capital Outlay total with proper type conversion
      const capitalOutlayTotal = Array.isArray(filteredCapitalOutlayData)
        ? filteredCapitalOutlayData.reduce((sum, p) => {
            if (!p) return sum;
            return sum + (Number(p.cost) || 0);
          }, 0)
        : 0;

      // Calculate MOOE income total
      const mooeIncomeTotal = Array.isArray(filteredMooeData)
        ? filteredMooeData.reduce((sum, item) => {
            if (!item) return sum;
            return sum + (parseFloat(item.income) || 0);
          }, 0)
        : 0;

      // Calculate Capital Outlay income total
      const capitalOutlayIncomeTotal = Array.isArray(filteredCapitalOutlayData)
        ? filteredCapitalOutlayData.reduce((sum, item) => {
            if (!item) return sum;
            return sum + (parseFloat(item.income) || 0);
          }, 0)
        : 0;

      // Calculate combined income total from MOOE and Capital Outlay
      const combinedIncomeTotal = mooeIncomeTotal + capitalOutlayIncomeTotal;

      // Use the incomeGrandTotal from IncomeTable
      const incomeTotal = incomeGrandTotal || 0;
      // Calculate total expenses (MOOE + Capital Outlay)
      const expensesTotal = mooeTotal + capitalOutlayTotal;

      // Check if income is balanced (Corporate Income vs MOOE+CapitalOutlay income)
      const isIncomeBalanced =
        Math.abs(incomeTotal - combinedIncomeTotal) < 0.01;

      // Calculate subsidy totals from MOOE and Capital Outlay data
      // console.log(
      //   "Debug - Filtered MOOE Data for subsidy calculation:",
      //   filteredMooeData
      // );
      // console.log(
      //   "Debug - Filtered Capital Outlay Data for subsidy calculation:",
      //   filteredCapitalOutlayData
      // );
      // console.log("Debug - Filtered Income Data:", filteredIncomeData);
      // console.log("Debug - Fiscal Year Used:", fiscalYearToUse);

      const mooeSubsidyTotal = Array.isArray(filteredMooeData)
        ? filteredMooeData.reduce((sum, item) => {
            if (!item) return sum;
            const subsidyValue = Number(item.subsidy) || 0;
            // console.log(`MOOE item subsidy: ${subsidyValue}`, item);
            return sum + subsidyValue;
          }, 0)
        : 0;

      const capitalOutlaySubsidyTotal = Array.isArray(filteredCapitalOutlayData)
        ? filteredCapitalOutlayData.reduce((sum, item) => {
            if (!item) return sum;
            const subsidyValue = Number(item.subsidy) || 0;
            // console.log(`Capital Outlay item subsidy: ${subsidyValue}`, item);
            return sum + subsidyValue;
          }, 0)
        : 0;

      const combinedSubsidyTotal = mooeSubsidyTotal + capitalOutlaySubsidyTotal;

      // Check if subsidy is balanced (Budgetary Support should equal Combined Subsidy)
      const budgetarySupportTotal =
        calculateTotalBudget.budgetarySupportTotal || 0;
      const isSubsidyBalanced =
        Math.abs(budgetarySupportTotal - combinedSubsidyTotal) < 0.01;

      // Check if budget is balanced (expenses vs income)
      const isBalanced = Math.abs(expensesTotal - incomeTotal) < 0.01;

      // console.log("ProposalCustomPage: Setting budget summary:", {
      //   personnelTotal,
      //   mooeTotal,
      //   capitalOutlayTotal,
      //   expensesTotal,
      //   incomeTotal,
      //   mooeIncomeTotal,
      //   capitalOutlayIncomeTotal,
      //   combinedIncomeTotal,
      //   isIncomeBalanced,
      //   mooeSubsidyTotal,
      //   capitalOutlaySubsidyTotal,
      //   combinedSubsidyTotal,
      //   budgetarySupportTotal,
      //   isSubsidyBalanced,
      //   isBalanced,
      // });

      setBudgetSummary({
        personnelTotal,
        mooeTotal,
        capitalOutlayTotal,
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
      });
    } catch (error) {
      console.error("Error calculating budget summary:", error);
      // Set default values in case of error
      setBudgetSummary({
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
      });
    }
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeGrandTotal,
    selectedFiscalYear,
    activeFiscalYear,
  ]);

  // Add React Query for data fetching

  // Use React Query for data fetching
  const { data: personnelQueryData } = useQuery({
    queryKey: [
      QUERY_KEYS.personnel,
      activeRegion?.name || activeRegion?.regionName,
      selectedFiscalYear || activeFiscalYear,
    ],
    queryFn: async () => {
      const region = activeRegion?.name || activeRegion?.regionName;
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      const isFullAccess = currentUser?.hierarchicalAccess?.scope === 'FULL';
      
      // For FULL access users, don't include region parameter to get all regions
      const url = isFullAccess 
        ? `/getpersonnels?fiscalYear=${fiscalYear}`
        : `/getpersonnels?region=${region}&fiscalYear=${fiscalYear}`;
        
      const response = await api.get(url);
      // console.log(
      //   `Fetched personnel data for ${isFullAccess ? 'all regions' : 'region: ' + region}, fiscal year: ${fiscalYear}`
      // );
      return response.data.map((item) => ({
        ...item,
        key: item._id,
      }));
    },
    onSuccess: (data) => {
      setPersonnelData(data);
    },
    // Refresh every 5 seconds in the background
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const { data: mooeQueryData } = useQuery({
    queryKey: [
      QUERY_KEYS.mooe,
      activeRegion?.name || activeRegion?.regionName,
      selectedFiscalYear || activeFiscalYear,
    ],
    queryFn: async () => {
      const region = activeRegion?.name || activeRegion?.regionName;
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      const isFullAccess = currentUser?.hierarchicalAccess?.scope === 'FULL';
      
      // For FULL access users, don't include region parameter to get all regions
      const url = isFullAccess 
        ? `/mooe-list?fiscalYear=${fiscalYear}`
        : `/mooe-list?region=${region}&fiscalYear=${fiscalYear}`;
        
      const response = await api.get(url);
      // console.log(
      //   `Fetched MOOE data for region: ${region}, fiscal year: ${fiscalYear}`
      // );
      return response.data.map((item) => ({
        ...item,
        key: item._id,
      }));
    },
    onSuccess: (data) => {
      setMooeData(data);
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // Fetch IAs O&M Cost data
  const { data: iasOMCostData } = useQuery({
    queryKey: [
      "iasOMCost",
      activeRegion?.name || activeRegion?.regionName,
      selectedFiscalYear || activeFiscalYear,
    ],
    queryFn: async () => {
      try {
        const region = activeRegion?.name || activeRegion?.regionName;
        const fiscalYear = selectedFiscalYear || activeFiscalYear;
        const response = await api.get("/ias-om-cost", {
          params: { region, fiscalYear },
          withCredentials: true,
        });
        // console.log(
        //   `Fetched IAs O&M Cost data for region: ${region}, fiscal year: ${fiscalYear}`
        // );
        return response.data;
      } catch (err) {
        console.error("Error fetching IAs O&M Cost data:", err);
        // If the endpoint doesn't exist yet or there's an error, return default values
        return { nis: 0, cis: 0, nisSubsidy: 0, cisSubsidy: 0 };
      }
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: capitalOutlayQueryData } = useQuery({
    queryKey: [
      QUERY_KEYS.capitalOutlay,
      activeRegion?.name || activeRegion?.regionName,
      selectedFiscalYear || activeFiscalYear,
    ],
    queryFn: async () => {
      // Use the same endpoint as CapitalOutlayTable for consistency
      const region = activeRegion?.name || activeRegion?.regionName;
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      const isFullAccess = currentUser?.hierarchicalAccess?.scope === 'FULL';
      
      // For FULL access users, don't include region parameter to get all regions
      const url = isFullAccess 
        ? `/capital-outlays?fiscalYear=${fiscalYear}`
        : `/capital-outlays?region=${region}&fiscalYear=${fiscalYear}`;
        
      const response = await api.get(url);
      // console.log(
      //   `Fetched Capital Outlay data for region: ${region}, fiscal year: ${fiscalYear}`
      // );
      return response.data.capitalOutlays.map((item) => ({
        ...item,
        key: item._id,
        status: item.status || "Not Submitted",
      }));
    },
    onSuccess: (data) => {
      setCapitalOutlayData(data);
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: incomeQueryData } = useQuery({
    queryKey: [
      QUERY_KEYS.income,
      activeRegion?.name || activeRegion?.regionName,
      selectedFiscalYear || activeFiscalYear,
    ],
    queryFn: async () => {
      const region = activeRegion?.name || activeRegion?.regionName;
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      const isFullAccess = currentUser?.hierarchicalAccess?.scope === 'FULL';
      
      // For FULL access users, don't include region parameter to get all regions
      const params = isFullAccess 
        ? { fiscalYear }
        : { fiscalYear, region };
        
      const response = await api.get("/income", { params });
      // console.log(
      //   `Fetched Income data for region: ${region}, fiscal year: ${fiscalYear}`
      // );
      return response.data.map((item) => ({
        ...item,
        key: item._id,
      }));
    },
    onSuccess: (data) => {
      setIncomeData(data);
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const { data: budgetarySupportQueryData, error: budgetarySupportError } =
    useQuery({
      queryKey: [
        QUERY_KEYS.budgetarySupport,
        selectedFiscalYear || activeFiscalYear,
        activeBudgetType,
        activeRegion?.name || activeRegion?.regionName,
      ],
      queryFn: async () => {
        const region = activeRegion?.name || activeRegion?.regionName;
        const fiscalYear = selectedFiscalYear || activeFiscalYear;
        const isFullAccess = currentUser?.hierarchicalAccess?.scope === 'FULL';
        
        // For FULL access users, don't include region parameter to get all regions
        const params = isFullAccess 
          ? { fiscalYear, budgetType: activeBudgetType }
          : { fiscalYear, budgetType: activeBudgetType, region };
          
        const response = await api.get("/budgetary-support", { params });
        // console.log("Budgetary support response:", response.data);
        return response.data.map((item) => ({
          ...item,
          key: item._id,
        }));
      },
      enabled: !!activeFiscalYear && !!activeBudgetType, // Only run when we have the required parameters
      onSuccess: (data) => {
        // console.log("Budgetary support data loaded successfully:", data);
        setBudgetarySupportData(data);
      },
      onError: (error) => {
        console.error("Error fetching budgetary support data:", error);
        setBudgetarySupportData([]); // Set empty array on error
      },
      refetchInterval: 5000,
      refetchIntervalInBackground: true,
    });

  const { data: chargedToIncomeQueryData = 0 } = useQuery({
    queryKey: [
      'chargedToIncomeAmount',
      selectedFiscalYear || activeFiscalYear,
      activeBudgetType,
    ],
    queryFn: async () => {
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      const baseParams = {
        fiscalYear: Number(fiscalYear),
        budgetType: activeBudgetType,
        chargedToIncomeEligible: true,
        limit: 1000,
        page: 1
      };
      
      try {
        const response = await api.get('/personnelServices', { params: baseParams });
        const data = response.data?.personnelServices || [];
        
        if (!Array.isArray(data)) return 0;
        
        const total = data.reduce((sum, p) => {
          return sum + (Number(p.chargedToIncomeAmount || 0));
        }, 0);
        
        return total;
      } catch (error) {
        console.error('Error fetching charged to income data:', error);
        return 0;
      }
    },
    enabled: !!activeFiscalYear && !!activeBudgetType,
    staleTime: 30000,
  });

  // Use React Query's cache to update data
  useEffect(() => {
    if (personnelQueryData) setPersonnelData(personnelQueryData);
    if (mooeQueryData) setMooeData(mooeQueryData);
    if (capitalOutlayQueryData) setCapitalOutlayData(capitalOutlayQueryData);
    if (incomeQueryData) setIncomeData(incomeQueryData);
    if (budgetarySupportQueryData)
      setBudgetarySupportData(budgetarySupportQueryData);
    if (chargedToIncomeQueryData) setChargedToIncomeAmount(chargedToIncomeQueryData);
  }, [
    personnelQueryData,
    mooeQueryData,
    capitalOutlayQueryData,
    incomeQueryData,
    budgetarySupportQueryData,
    chargedToIncomeQueryData,
  ]);

  // Update budget summary when data changes or selected fiscal year changes
  useEffect(() => {
    calculateBudgetSummary();
  }, [
    personnelData,
    mooeData,
    capitalOutlayData,
    incomeData,
    selectedFiscalYear,
    calculateBudgetSummary,
    iasOMCostData,
  ]);

  // Create a mutation for adding personnel services
  const addPersonnelMutation = useMutation({
    mutationFn: async (newPersonnel) => {
      return await api.post("/personnelServices", newPersonnel);
    },
    onSuccess: (data) => {
      // Optimistically update the cache
      const currentData =
        queryClient.getQueryData([QUERY_KEYS.personnel]) || [];
      queryClient.setQueryData(
        [QUERY_KEYS.personnel],
        [...currentData, { ...data.data, key: data.data._id }]
      );

      // Show success message
      setSnackbar({
        open: true,
        message: "Personnel service added successfully!",
        severity: "success",
      });
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message:
          error.response?.data?.message || "Failed to add personnel service",
        severity: "error",
      });
    },
  });

  // Create mutations for other services (MOOE, Capital Outlay, Income)
  const addMooeMutation = useMutation({
    mutationFn: async (newMooe) => {
      return await api.post("/mooe", newMooe);
    },
    onSuccess: (data) => {
      // Optimistically update the cache
      const currentData = queryClient.getQueryData([QUERY_KEYS.mooe]) || [];
      queryClient.setQueryData(
        [QUERY_KEYS.mooe],
        [...currentData, { ...data.data, key: data.data._id }]
      );

      // Show success message
      setSnackbar({
        open: true,
        message: "MOOE added successfully!",
        severity: "success",
      });
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Failed to add MOOE",
        severity: "error",
      });
    },
  });

  const handleSubmitAll = async () => {
    // Check user permissions before proceeding
    try {
      // Quick permission check by calling a simple endpoint
      await api.get("/my-proposals?limit=1");
    } catch (error) {
      if (error.response?.status === 403) {
        setSnackbar({
          open: true,
          message: "You don't have permission to submit proposals. Please contact your administrator to assign proper permissions.",
          severity: "error",
        });
        return;
      }
    }

    // Use the active region from context instead of user's default region
    // This ensures we use the currently selected region, not just the user's default
    const userRegion = activeRegion
      ? activeRegion.name || activeRegion.regionName || activeRegion
      : currentUser?.Region || currentUser?.region;

    if (!userRegion) {
      console.error("Region information is missing", { activeRegion, currentUserRegion: currentUser?.Region });
      setSnackbar({
        open: true,
        message:
          "Region information is missing. Please select a region or update your profile.",
        severity: "error",
      });
      return;
    }
    // Check for budget deficit - BLOCK submission if there's a deficit
    if (budgetDeficit && budgetDeficit.hasDeficit) {
      setSnackbar({
        open: true,
        message: `Cannot submit: Budget has a deficit of ₱${budgetDeficit.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Total Sources (₱${budgetDeficit.totalSources.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) must equal or exceed Total Uses (₱${budgetDeficit.totalUses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
        severity: "error",
      });
      return;
    }

    // If income is not balanced, allow submission but warn the user
    if (!budgetSummary.isIncomeBalanced) {
      setSnackbar({
        open: true,
        message:
          "Warning: Income is not balanced. Submission will proceed, but may be returned by reviewers.",
        severity: "warning",
      });
      // Continue without blocking
    }

    // Get all eligible proposals for submission
    const personnelIds = personnelData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const mooeIds = mooeData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const capitalOutlayIds = capitalOutlayData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const incomeIds = incomeData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const budgetarySupportIds = budgetarySupportData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);
    
    if (
      personnelIds.length === 0 &&
      mooeIds.length === 0 &&
      capitalOutlayIds.length === 0 &&
      incomeIds.length === 0 &&
      budgetarySupportIds.length === 0
    ) {
      setSnackbar({
        open: true,
        message: "No proposals are eligible for submission.",
        severity: "warning",
      });
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    const payload = {
      personnelIds,
      mooeIds,
      capitalOutlayIds,
      incomeIds,
      budgetarySupportIds,
      fiscalYear: activeFiscalYear,
      budgetType: activeBudgetType,
      processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
      region: userRegion,
      userId: currentUser._id,
      // Only send essential budget data for performance
      isIncomeBalanced: budgetSummary.isIncomeBalanced,
    };
    try {
      const response = await api.post("/updateProposalStatus", payload);
      // Clear any stored income grand total after successful submission
      localStorage.removeItem("incomeGrandTotal");
      localStorage.removeItem("incomeFieldsLocked");
      await fetchAllData();
      setSnackbar({
        open: true,
        message: "Proposals submitted successfully!",
        severity: "success",
      });
    } catch (error) {
      console.error(
        "Error updating proposal status:",
        error.response?.data || error.message
      );
      
      // Handle permission errors specifically
      if (error.response?.status === 403) {
        const errorData = error.response.data;
        if (errorData.code === 'INSUFFICIENT_PERMISSIONS' && errorData.required === 'canEditOwnProposals') {
          setSnackbar({
            open: true,
            message: "You don't have permission to submit proposals. Please contact your administrator to grant 'canEditOwnProposals' permission.",
            severity: "error",
          });
          return;
        }
      }
      
      setSnackbar({
        open: true,
        message:
          "An error occurred while submitting proposals. Please try again.",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const fetchAllData = useCallback(async () => {
    try {
      const regionName = activeRegion?.name || activeRegion?.regionName;
      const fiscalYear = selectedFiscalYear || activeFiscalYear;
      // Invalidate cache in parallel for better performance
      await Promise.all([
        queryClient.invalidateQueries([
          QUERY_KEYS.personnel,
          regionName,
          fiscalYear,
        ]),
        queryClient.invalidateQueries([
          QUERY_KEYS.mooe,
          regionName,
          fiscalYear,
        ]),
        queryClient.invalidateQueries([
          QUERY_KEYS.capitalOutlay,
          regionName,
          fiscalYear,
        ]),
        queryClient.invalidateQueries([
          QUERY_KEYS.income,
          regionName,
          fiscalYear,
        ]),
        queryClient.invalidateQueries([
          QUERY_KEYS.budgetarySupport,
          fiscalYear,
          activeBudgetType,
          regionName,
        ]),
      ]);

      // Then refetch all data
      await queryClient.refetchQueries([
        QUERY_KEYS.personnel,
        regionName,
        fiscalYear,
      ]);
      await queryClient.refetchQueries([
        QUERY_KEYS.mooe,
        regionName,
        fiscalYear,
      ]);
      await queryClient.refetchQueries([
        QUERY_KEYS.capitalOutlay,
        regionName,
        fiscalYear,
      ]);
      await queryClient.refetchQueries([
        QUERY_KEYS.income,
        regionName,
        fiscalYear,
      ]);
      await queryClient.refetchQueries([
        QUERY_KEYS.budgetarySupport,
        fiscalYear,
        activeBudgetType,
        regionName,
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
      setSnackbar({
        open: true,
        message: "Failed to refresh data. Please reload the page.",
        severity: "error",
      });
    }
  }, [
    activeRegion,
    activeFiscalYear,
    selectedFiscalYear,
    activeBudgetType,
    queryClient,
    setSnackbar,
  ]);

  const handleSaveAsDraft = async (isAutoSave = false) => {
    if (!isAutoSave) {
    }

    // Enhanced debugging for save as draft issues
    if (!currentUser || !currentUser.Username) {
      console.error("User information missing", { currentUser });
      setSnackbar({
        open: true,
        message: "User information is missing. Please log in again.",
        severity: "error",
      });
      return;
    }

    if (!activeFiscalYear || !activeBudgetType) {
      console.error("Missing activeFiscalYear or activeBudgetType", {
        activeFiscalYear,
        activeBudgetType,
      });
      setSnackbar({
        open: true,
        message: "System settings are missing. Please contact support.",
        severity: "error",
      });
      return;
    }

    // Get all eligible proposals for saving as draft
    const personnelIds = personnelData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const mooeIds = mooeData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const capitalOutlayIds = capitalOutlayData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const incomeIds = incomeData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    const budgetarySupportIds = budgetarySupportData
      .filter((p) => isEligibleForSubmission(p.status))
      .map((p) => p._id);

    if (
      personnelIds.length === 0 &&
      mooeIds.length === 0 &&
      capitalOutlayIds.length === 0 &&
      incomeIds.length === 0 &&
      budgetarySupportIds.length === 0
    ) {
      setSnackbar({
        open: true,
        message: "No proposals are eligible to be saved as draft.",
        severity: "warning",
      });
      return;
    }

    // Use the active region from context instead of user's default region
    // This ensures we use the currently selected region, not just the user's default
    const userRegion = activeRegion
      ? activeRegion.name || activeRegion.regionName || activeRegion
      : currentUser?.Region || currentUser?.region;

    if (!userRegion) {
      console.error("Region information is missing", { activeRegion, currentUserRegion: currentUser?.Region });
      setSnackbar({
        open: true,
        message:
          "Region information is missing. Please select a region or update your profile.",
        severity: "error",
      });
      return;
    }
    const payload = {
      personnelIds,
      mooeIds,
      capitalOutlayIds,
      incomeIds,
      budgetarySupportIds,
      fiscalYear: activeFiscalYear,
      budgetType: activeBudgetType,
      processBy: `${currentUser.FirstName} ${currentUser.LastName}`,
      region: userRegion,
    };
    setLoading(true);
    setIsSubmitting(true);

    try {
      const response = await api.post("/saveAsDraft", payload);
      // Remove artificial delay for better performance
      // await new Promise(resolve => setTimeout(resolve, 1000));

      await fetchAllData();

      // Check if there were any items that couldn't be updated because they belong to a different region
      if (response.data.notUpdatedCounts) {
        const totalNotUpdated = Object.values(
          response.data.notUpdatedCounts
        ).reduce((sum, count) => sum + count, 0);

        if (totalNotUpdated > 0) {
          console.warn(
            `${totalNotUpdated} items were not updated because they belong to a different region`
          );

          if (!isAutoSave) {
            setSnackbar({
              open: true,
              message: `Proposals saved as draft, but ${totalNotUpdated} items were not updated because they belong to a different region than ${userRegion}`,
              severity: "warning",
            });
          }
        } else {
          if (!isAutoSave) {
            setSnackbar({
              open: true,
              message: "Proposals saved as draft successfully!",
              severity: "success",
            });
          }
        }
      } else {
        if (!isAutoSave) {
          setSnackbar({
            open: true,
            message: "Proposals saved as draft successfully!",
            severity: "success",
          });
        }
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setSaveStatus("saved");
    } catch (error) {
      console.error(
        "Error saving proposals as draft:",
        error.response?.data || error.message
      );

      setSaveStatus("error");

      if (!isAutoSave) {
        setSnackbar({
          open: true,
          message:
            "An error occurred while saving proposals as draft. Please try again.",
          severity: "error",
        });
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleOpenDialog = () => {
    // Check for budget deficit - BLOCK if there's a deficit
    if (budgetDeficit && budgetDeficit.hasDeficit) {
      setSnackbar({
        open: true,
        message: `Cannot submit: Budget has a deficit of ₱${budgetDeficit.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Total Sources must equal or exceed Total Uses.`,
        severity: "error",
      });
      return;
    }

    if (!budgetSummary.isIncomeBalanced) {
      setSnackbar({
        open: true,
        message:
          "Income is not balanced. You can still submit, but reviewers may return it.",
        severity: "warning",
      });
      // Do not block dialog; allow user to proceed with a warning
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = (confirm) => {
    setOpenDialog(false);
    if (confirm) {
      handleSubmitAll();
    }
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  // Add this effect to show a notification when inputs become disabled
  // useEffect(() => {
  //   if (disableIncomeInputs) {
  //     toast.info(
  //       "Income fields are now locked because the total matches the Corporate Income projection. To make changes, adjust the Corporate Income first.",
  //       {
  //         position: "top-right",
  //         autoClose: 5000,
  //         hideProgressBar: false,
  //         closeOnClick: true,
  //         pauseOnHover: true,
  //         draggable: true,
  //       }
  //     );
  //   }
  // }, [disableIncomeInputs]);

  // Also add a more visible indicator at the top of each tab
  const handleForceUnlock = () => {
    if (
      window.confirm(
        "Are you sure you want to unlock income fields? This should only be done if there is a discrepancy that needs to be fixed."
      )
    ) {
      setDisableIncomeInputs(false);
      localStorage.removeItem("incomeFieldsLocked");
      toast.success("Income fields unlocked. You can now make changes.");
    }
  };

  const IncomeLockedBanner = () => {
    if (!disableIncomeInputs) return null;

    return (
      <Box
        sx={{
          bgcolor: "#ffebee",
          p: { xs: 1.5, sm: 3 },
          mb: 3,
          borderRadius: 2,
          border: "2px solid #f44336",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          gap: 2,
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <LockIcon color="error" fontSize="large" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant="h6"
            color="error"
            gutterBottom
            fontSize={{ xs: "1rem", sm: "1.25rem" }}
          >
            Income Fields Locked
          </Typography>
          <Typography fontSize={{ xs: "0.875rem", sm: "1rem" }}>
            Income fields are locked because the total matches the Corporate
            Income projection.
            <strong> All save attempts will be blocked.</strong> To make
            changes, adjust the Corporate Income first.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          onClick={handleForceUnlock}
          startIcon={<LockOpenIcon />}
          size="small"
          sx={{ mt: { xs: 1, sm: 0 } }}
        >
          Force Unlock
        </Button>
      </Box>
    );
  };

  // Update region filter when active region changes
  useEffect(() => {
    if (activeRegion) {
      const regionName = activeRegion.name || activeRegion.regionName;
      setRegionFilter(regionName);
      
      // Force refresh income data when region changes
      queryClient.invalidateQueries(["income-items"]);
      queryClient.invalidateQueries(["income-categories"]);
      
      // Reset income grand total to trigger recalculation
      setIncomeGrandTotal(0);
    } else {
      setRegionFilter("");
    }
  }, [activeRegion, queryClient]);

  // Calculate total budget across all categories
  const calculateTotalBudget = useMemo(() => {
    try {
      // Use the selected fiscal year for filtering (fall back to active fiscal year if not set)
      const fiscalYearToUse = selectedFiscalYear || activeFiscalYear;
      // Filter personnel data by region and fiscal year
      const filteredPersonnelData = personnelData.filter((p) => {
        const matchesRegion = !regionFilter || p.region === regionFilter;
        const matchesFiscalYear = p.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      const personnelTotal = filteredPersonnelData.reduce((sum, p) => {
        // Only include submitted or draft items
        if (!isEligibleForSubmission(p.status) && p.status !== "Submitted") {
          return sum;
        }

        return sum + (Number(p.Total) || 0);
      }, 0);

      // Filter MOOE data by region and fiscal year
      const filteredMooeData = mooeData.filter((item) => {
        const matchesRegion = !regionFilter || item.region === regionFilter;
        const matchesFiscalYear = item.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      // Calculate regular MOOE total
      const mooeRegularTotal = filteredMooeData.reduce((sum, item) => {
        // Only include submitted or draft items
        if (
          !isEligibleForSubmission(item.status) &&
          item.status !== "Submitted"
        ) {
          return sum;
        }

        return sum + (Number(item.amount) || 0);
      }, 0);

      // Calculate IAs O&M Cost total (ALWAYS include if present)
      const iasOMCostTotal = iasOMCostData
        ? (Number(iasOMCostData.nis) || 0) +
          (Number(iasOMCostData.cis) || 0) +
          (Number(iasOMCostData.nisSubsidy) || 0) +
          (Number(iasOMCostData.cisSubsidy) || 0)
        : 0;

      // Total MOOE is regular MOOE plus IAs O&M Cost
      const mooeTotal = mooeRegularTotal + iasOMCostTotal;

      // Filter Capital Outlay data by region and fiscal year
      const filteredCapitalOutlayData = capitalOutlayData.filter((item) => {
        const matchesRegion = !regionFilter || item.region === regionFilter;
        const matchesFiscalYear = item.fiscalYear === fiscalYearToUse;
        return matchesRegion && matchesFiscalYear;
      });

      const capitalOutlayTotal = filteredCapitalOutlayData.reduce(
        (sum, item) => {
          // Only include submitted or draft items
          if (
            !isEligibleForSubmission(item.status) &&
            item.status !== "Submitted"
          ) {
            return sum;
          }

          return sum + (Number(item.cost) || 0);
        },
        0
      );

      // Auto-calculate budgetary support total as MOOE Subsidy + Capital Outlay Subsidy
      // This matches the BudgetarySupportTable auto-calculation logic
      const mooeSubsidyTotal = filteredMooeData.reduce((sum, item) => {
        if (
          !isEligibleForSubmission(item.status) &&
          item.status !== "Submitted"
        ) {
          return sum;
        }
        return sum + (Number(item.subsidy) || 0);
      }, 0);

      const capitalOutlaySubsidyTotal = filteredCapitalOutlayData.reduce(
        (sum, item) => {
          if (
            !isEligibleForSubmission(item.status) &&
            item.status !== "Submitted"
          ) {
            return sum;
          }
          return sum + (Number(item.subsidy) || 0);
        },
        0
      );

      const budgetarySupportTotal =
        mooeSubsidyTotal + capitalOutlaySubsidyTotal;

      return {
        personnelTotal,
        mooeTotal, // <-- now always includes IAs O&M
        capitalOutlayTotal,
        budgetarySupportTotal,
        grandTotal:
          personnelTotal +
          mooeTotal +
          capitalOutlayTotal +
          budgetarySupportTotal,
      };
    } catch (error) {
      console.error("Error calculating total budget:", error);
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
    selectedFiscalYear,
    activeFiscalYear,
    regionFilter,
    isEligibleForSubmission,
    iasOMCostData,
  ]);

  // Enhancement Functions (defined after all hooks to ensure proper dependency access)
  
  // Bulk Selection Functions
  const handleBulkSelect = useCallback((type, ids) => {
    setBulkSelection(prev => ({
      ...prev,
      [type]: ids
    }));
    setShowBulkActions(ids.length > 0);
  }, []);

  const handleSelectAll = useCallback((type) => {
    let data = [];
    switch (type) {
      case 'personnel': data = personnelData || []; break;
      case 'mooe': data = mooeData || []; break;
      case 'capitalOutlay': data = capitalOutlayData || []; break;
      case 'income': data = incomeData || []; break;
      case 'budgetarySupport': data = budgetarySupportData || []; break;
    }
    const eligibleIds = data.filter(item => isEligibleForSubmission(item.status || 'Not Submitted')).map(item => item._id);
    handleBulkSelect(type, eligibleIds);
  }, [personnelData, mooeData, capitalOutlayData, incomeData, budgetarySupportData, handleBulkSelect, isEligibleForSubmission]);

  const handleDeselectAll = useCallback((type) => {
    handleBulkSelect(type, []);
  }, [handleBulkSelect]);

  // Bulk Actions
  const handleBulkStatusChange = useCallback(async (newStatus) => {
    setLoading(true);
    try {
      const allSelectedIds = [
        ...bulkSelection.personnel,
        ...bulkSelection.mooe,
        ...bulkSelection.capitalOutlay,
        ...bulkSelection.income,
        ...bulkSelection.budgetarySupport
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

      if (newStatus === 'Submitted') {
        await api.post("/updateProposalStatus", payload);
      } else if (newStatus === 'Draft') {
        await api.post("/saveAsDraft", payload);
      }

      // Log activity
      const activityEntry = {
        timestamp: new Date(),
        action: `Bulk ${newStatus}`,
        itemCount: allSelectedIds.length,
        user: `${currentUser.FirstName} ${currentUser.LastName}`,
        details: `${newStatus} ${allSelectedIds.length} proposals`
      };
      setActivityLog(prev => [activityEntry, ...prev.slice(0, 49)]); // Keep last 50 activities

      await fetchAllData();
      setBulkSelection({ personnel: [], mooe: [], capitalOutlay: [], income: [], budgetarySupport: [] });
      setShowBulkActions(false);
      setBulkActionsAnchor(null);

      setSnackbar({
        open: true,
        message: `Successfully updated ${allSelectedIds.length} proposals to ${newStatus}`,
        severity: "success",
      });
    } catch (error) {
      console.error("Bulk action error:", error);
      setSnackbar({
        open: true,
        message: "Failed to update selected proposals",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [bulkSelection, activeFiscalYear, activeBudgetType, currentUser, activeRegion, fetchAllData]);

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
          budgetarySupport: budgetarySupportData?.length || 0
        },
        budgetSummary: {
          grandTotal: budgetSummary?.grandTotal || 0,
          personnelTotal: budgetSummary?.personnelTotal || 0,
          mooeTotal: budgetSummary?.mooeTotal || 0,
          capitalOutlayTotal: budgetSummary?.capitalOutlayTotal || 0,
          budgetarySupportTotal: budgetSummary?.budgetarySupportTotal || 0,
          incomeTotal: budgetSummary?.incomeTotal || 0,
          isIncomeBalanced: budgetSummary?.isIncomeBalanced || false
        }
      };

      const response = await api.post('/api/export/budget-summary-pdf', exportParams, {
        responseType: 'blob',
        timeout: 30000 // 30 second timeout
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Budget_Summary_${selectedFiscalYear || activeFiscalYear}_${activeRegion?.name || 'Region'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Log activity
      const activityEntry = {
        timestamp: new Date(),
        action: 'Export PDF',
        user: `${currentUser.FirstName} ${currentUser.LastName}`,
        details: `Exported budget summary as PDF for FY ${selectedFiscalYear || activeFiscalYear}`
      };
      setActivityLog(prev => [activityEntry, ...prev.slice(0, 49)]);

      setSnackbar({
        open: true,
        message: "PDF report generated successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      setSnackbar({
        open: true,
        message: "Failed to generate PDF report",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setExportMenuAnchor(null);
    }
  }, [selectedFiscalYear, activeFiscalYear, activeBudgetType, activeRegion, personnelData, mooeData, capitalOutlayData, incomeData, budgetarySupportData, budgetSummary, currentUser]);

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
          budgetarySupport: budgetarySupportData?.length || 0
        },
        budgetSummary: {
          grandTotal: budgetSummary?.grandTotal || 0,
          personnelTotal: budgetSummary?.personnelTotal || 0,
          mooeTotal: budgetSummary?.mooeTotal || 0,
          capitalOutlayTotal: budgetSummary?.capitalOutlayTotal || 0,
          budgetarySupportTotal: budgetSummary?.budgetarySupportTotal || 0,
          incomeTotal: budgetSummary?.incomeTotal || 0,
          isIncomeBalanced: budgetSummary?.isIncomeBalanced || false
        }
      };

      const response = await api.post('/api/export/budget-summary-excel', exportParams, {
        responseType: 'blob',
        timeout: 30000 // 30 second timeout
      });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Budget_Summary_${selectedFiscalYear || activeFiscalYear}_${activeRegion?.name || 'Region'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Log activity
      const activityEntry = {
        timestamp: new Date(),
        action: 'Export Excel',
        user: `${currentUser.FirstName} ${currentUser.LastName}`,
        details: `Exported budget summary as Excel for FY ${selectedFiscalYear || activeFiscalYear}`
      };
      setActivityLog(prev => [activityEntry, ...prev.slice(0, 49)]);

      setSnackbar({
        open: true,
        message: "Excel report generated successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("Excel export error:", error);
      setSnackbar({
        open: true,
        message: "Failed to generate Excel report",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setExportMenuAnchor(null);
    }
  }, [selectedFiscalYear, activeFiscalYear, activeBudgetType, activeRegion, personnelData, mooeData, capitalOutlayData, incomeData, budgetarySupportData, budgetSummary, currentUser]);

  // Mobile Tab Component
  const MobileTabNavigation = () => (
    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            minWidth: 'auto',
            fontSize: '0.75rem',
            px: 1
          }
        }}
      >
        <Tab label="Income" value="Income" icon={<FaMoneyCheckAlt size={16} />} />
        <Tab label="PS-Perm" value="PSPermanent" icon={<IoPersonCircleOutline size={16} />} />
        <Tab label="PS-Casual" value="PSCasual" icon={<IoPersonCircleOutline size={16} />} />
        <Tab label="PS-Charged" value="PSChargedToIncome" icon={<IoPersonCircleOutline size={16} />} />
        <Tab label="COS/JO" value="COS/JO" icon={<FaFileContract size={16} />} />
        <Tab label="MOOE" value="MOOE" icon={<GrHostMaintenance size={16} />} />
        <Tab label="Capital" value="Capital Outlay" icon={<FaMoneyBill size={16} />} />
        <Tab label="Budget" value="Budgetary Support" icon={<FaProjectDiagram size={16} />} />
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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon />
        Activity Log
      </DialogTitle>
      <DialogContent>
        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {activityLog.length === 0 ? (
            <ListItem>
              <ListItemText primary="No activities recorded yet" />
            </ListItem>
          ) : (
            activityLog.map((activity, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    {activity.action.includes('Export') ? <GetAppIcon /> :
                     activity.action.includes('Bulk') ? <SelectAllIcon /> :
                     <EditIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={activity.action}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {activity.details}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          by {activity.user} • {activity.timestamp.toLocaleString()}
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
      // Fetch active settings
      try {
        const activeResponse = await api.get("/settings/active");
        if (activeResponse.data) {
          const fiscalYear = activeResponse.data.fiscalYear || "";
          setActiveFiscalYear(fiscalYear);
          setSelectedFiscalYear(fiscalYear); // Set selected fiscal year to active by default
          setActiveBudgetType(activeResponse.data.budgetType || "");
        } else {
          console.warn("No active settings data returned from API");
        }
      } catch (activeError) {
        console.error("Error fetching active settings:", activeError);
        toast.error("Failed to fetch active fiscal year settings");
      }

      // Fetch all available fiscal years (in a separate try/catch to avoid one failure affecting the other)
      try {
        const fiscalYearsResponse = await api.get("/settings/fiscal-years");
        const yearsData = fiscalYearsResponse.data?.data || fiscalYearsResponse.data || [];
        if (Array.isArray(yearsData)) {
          // Make sure we have at least the active fiscal year in the list
          setAvailableFiscalYears(yearsData);
        } else {
          console.warn("No fiscal years data returned or data is not an array");
          // If we don't get a valid response, at least include the active fiscal year
          if (activeFiscalYear) {
            setAvailableFiscalYears([activeFiscalYear]);
          }
        }
      } catch (fiscalYearsError) {
        console.error("Error fetching fiscal years:", fiscalYearsError);
        // Don't show a toast for this error since we already have the active fiscal year
        // Just make sure we have the active fiscal year in the list
        if (activeFiscalYear) {
          setAvailableFiscalYears([activeFiscalYear]);
        }
      }
    };

    fetchActiveSettings();
  }, [activeFiscalYear]);

  // Refresh data when active region changes
  useEffect(() => {
    if (activeRegion) {
      fetchAllData();
    }
  }, [activeRegion, fetchAllData]);

  // Refresh data when selected fiscal year changes
  useEffect(() => {
    if (selectedFiscalYear) {
      fetchAllData();
    }
  }, [selectedFiscalYear, fetchAllData]);

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

  return (
    <Box sx={{ p: 0, bgcolor: 'white', minHeight: '100vh' }}>
      {/* Modern Header Section */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5,
          borderRadius: 0,
          background: '#375e38',
          color: 'white',
          boxShadow: 'none',
          transition: 'all 0.3s ease',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: "bold", fontSize: '1.8rem' }}>
            {title}
          </Typography>
          <Typography variant="body1" component="h2" sx={{ opacity: 0.9, fontSize: '0.9rem' }}>
            {description || "Submit and manage your budget proposals"}
          </Typography>
        </Box>
        <TextField
          placeholder="Search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          variant="outlined"
          sx={{
            width: 250,
            '& .MuiOutlinedInput-root': {
              color: '#333',
              backgroundColor: 'white',
              borderRadius: '6px',
              '& fieldset': {
                borderColor: '#e0e0e0',
              },
              '&:hover fieldset': {
                borderColor: '#e0e0e0',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#2d5016',
                borderWidth: '2px'
              },
            },
            '& .MuiOutlinedInput-input': {
              '&::placeholder': {
                opacity: 0.6,
                color: '#999',
              },
            },
            '& .MuiSvgIcon-root': {
              color: '#999',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ opacity: 0.6, fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <StyledBox>
      {/* Create Proposal Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
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
              setNewProposalData({ ...newProposalData, title: e.target.value })
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
          <TextField
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
            inputProps={{ step: '0.01', min: '0' }}
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
            inputProps={{ step: '0.01', min: '0' }}
          />
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip icon={<CalendarTodayIcon />} label={`Fiscal Year: ${activeFiscalYear || 'N/A'}`} color="primary" size="small" />
            <Chip icon={<AccountBalanceIcon />} label={`Budget Type: ${activeBudgetType || newProposalData.modelType || 'Initial'}`} color="primary" size="small" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateProposal}
            disabled={createProposalMutation.isLoading || !!currentProposalId || !newProposalData.title || !activeFiscalYear || !activeRegion}
          >
            {createProposalMutation.isLoading ? <CircularProgress size={24} /> : !!currentProposalId ? 'Created' : 'Create'}
          </Button>
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
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <Chip
            icon={<CalendarTodayIcon />}
            label={`Active FY: ${activeFiscalYear || "N/A"}`}
            color="primary"
            variant="filled"
            size="small"
            sx={{
              backgroundColor: "#1976d2",
              fontWeight: 600,
              letterSpacing: "0.3px",
              "& .MuiChip-icon": {
                color: "white !important",
              },
            }}
          />
          {selectedFiscalYear &&
            selectedFiscalYear !== activeFiscalYear && (
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
          {!currentProposalId && (
            <Button
              variant="contained"
              size="small"
              onClick={() => setCreateDialogOpen(true)}
              disabled={createProposalMutation.isLoading}
              startIcon={createProposalMutation.isLoading ? <CircularProgress size={16} /> : null}
              sx={{
                ml: 1,
                backgroundColor: "#4CAF50",
                fontWeight: 600,
                letterSpacing: "0.5px",
                borderRadius: "6px",
                padding: "6px 16px",
                textTransform: "capitalize",
                boxShadow: "0 2px 6px rgba(76, 175, 80, 0.3)",
                transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                "&:hover": {
                  backgroundColor: "#45a049",
                  boxShadow: "0 4px 12px rgba(76, 175, 80, 0.4)",
                  transform: "translateY(-2px)",
                },
                "&:active": {
                  transform: "translateY(0px)",
                },
              }}
            >
              {createProposalMutation.isLoading ? 'Creating...' : '+ Create Proposal'}
            </Button>
          )}
          {currentProposalId && (
            <Tooltip title={`Linked Proposal ID: ${currentProposalId} - Click to unlink`}> 
              <Chip
                icon={<CheckCircleIcon />}
                label="Proposal Linked"
                onDelete={() => {
                  setCurrentProposalId(null);
                  sessionStorage.removeItem('activeWorkflowRef');
                  localStorage.removeItem('activeWorkflowRef');
                  toast.info("Proposal unlinked successfully");
                }}
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
                    }
                  }
                }}
              />
            </Tooltip>
          )}
        </Box>
        <AutoSaveIndicator />
      </Box>

      {/* Collapsible Budget Summary */}
      {import.meta.env.VITE_HIDE_BUDGET_SUMMARY !== 'true' && (
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
                  background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
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
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
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
                  background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                  borderRadius: 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(25, 118, 210, 0.2)",
                  transition: "all 0.3s cubic-bezier(0.3, 0, 0.7, 1)",
                  "&:hover": {
                    boxShadow: "0 4px 8px rgba(25, 118, 210, 0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
                  MOOE (Regular + IAs O&M)
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    display: "block",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    color: "#0d47a1",
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
                  background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
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
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600 }}>
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
                  color={budgetSummary.isIncomeBalanced ? "success" : "error"}
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
                  {budgetSummary.isIncomeBalanced ? "Balanced" : "Unbalanced"}
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
        <Paper sx={{ 
          boxShadow: 'none',
          borderRadius: '0px',
          overflow: 'hidden',
          border: 'none',
          transition: 'all 0.2s ease',
          bgcolor: '#375e38',
          display: { xs: 'none', md: 'block' }
        }}>
          {/* Tabs Header with Green Background */}
          <Box sx={{ 
            background: '#375e38',
            color: 'white',
            px: 1,
            py: 1,
            display: 'flex',
            gap: 0,
            alignItems: 'stretch',
            borderTop: '1px solid rgba(255,255,255,0.15)'
          }}>
            {[
              { label: 'INCOME', value: 'Income' },
              { label: 'PS - Permanent', value: 'PSPermanent' },
              { label: 'PS - Casual', value: 'PSCasual' },
              { label: 'PS - Charged to Income', value: 'PSChargedToIncome' },
              { label: 'COS/JO', value: 'COS/JO' },
              { label: 'MOOE', value: 'MOOE' },
              { label: 'CAPITAL OUTLAY', value: 'Capital Outlay' },
              { label: 'BSGC', value: 'Budgetary Support' }
            ].map((tab, index, arr) => {
              const isActive = activeTab === tab.value;
              return (
                <Box
                  key={index}
                  onClick={() => setActiveTab(tab.value)}
                  sx={{
                    flex: 1,
                    bgcolor: isActive ? '#2b4a2c' : 'transparent',
                    color: 'white',
                    textTransform: 'uppercase',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    p: 1.25,
                    borderRight: index < arr.length - 1 ? '1px solid rgba(255,255,255,0.25)' : 'none',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    textAlign: 'center',
                    '&:hover': {
                      bgcolor: isActive ? '#2b4a2c' : 'rgba(255,255,255,0.08)'
                    }
                  }}
                >
                  {tab.label}
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* Tab Content Rendering */}
        <Box sx={{ mt: 3, mb: 3, width: '100%' }}>
          {activeTab === "Income" && (
            <IncomeTable
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              onGrandTotalUpdate={(grandTotal) => {
                setIncomeGrandTotal(grandTotal || 0);
              }}
              onGroupedItemsUpdate={(items) => {
                setGroupedItems(items || {});
              }}
            />
          )}

          {activeTab === "PSPermanent" && (
            <PSPermanentServiceTable
              dataListName={dataListName}
              schema={schema}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
            />
          )}

          {activeTab === "PSCasual" && (
            <PSCasualServiceTable
              dataListName={dataListName}
              schema={schema}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
            />
          )}

          {activeTab === "PSChargedToIncome" && (
            <PSChargedToIncomeTable
              dataListName={dataListName}
              schema={schema}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
            />
          )}

          {activeTab === "COS/JO" && (
            <PSCOSCustomPageTable
              dataListName={dataListName}
              schema={schema}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
            />
          )}

          {activeTab === "MOOE" && (
            <Mooe
              dataListName={dataListName}
              schema={schema}
              region={activeRegion}
              fiscalYear={selectedFiscalYear}
              proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
            />
          )}

          {activeTab === "Capital Outlay" && (
            useDataGridView ? (
              <CapitalOutlayDataGrid
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
              />
            ) : (
              <CapitalOutlayTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={currentProposalId || sessionStorage.getItem('activeWorkflowRef') || localStorage.getItem('activeWorkflowRef') || (dataListName !== "tests" ? dataListName : undefined)}
              />
            )
          )}

          {activeTab === "Budgetary Support" && (
            <>
              {!activeBudgetType || !selectedFiscalYear ? (
                <Box sx={{ p: 3, textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="textSecondary">
                    Loading Budgetary Support data...
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Fiscal Year: {selectedFiscalYear || 'Loading...'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Budget Type: {activeBudgetType || 'Loading...'}
                  </Typography>
                </Box>
              ) : (
                <BudgetarySupportTable
                  proposalId={currentProposalId}
                  fiscalYear={selectedFiscalYear || activeFiscalYear}
                  budgetType={activeBudgetType}
                  incomeGrandTotal={incomeGrandTotal}
                  groupedItems={groupedItems}
                  onChargedToIncomeChange={setChargedToIncomeAmount}
                  onNonChargedPersonnelServicesChange={setNonChargedPersonnelServices}
                  onBudgetDeficitChange={setBudgetDeficit}
                />
              )}
            </>
          )}
        </Box>

        {/* Enhanced Button Group with Export and Bulk Actions */}
        <div className="button-group">
          {/* Bulk Actions Button */}
          {showBulkActions && (
            <Button
              variant="outlined"
              color="primary"
              onClick={(e) => setBulkActionsAnchor(e.currentTarget)}
              startIcon={<SelectAllIcon />}
              sx={{ mr: 1 }}
            >
              Bulk Actions ({
                bulkSelection.personnel.length + 
                bulkSelection.mooe.length + 
                bulkSelection.capitalOutlay.length + 
                bulkSelection.income.length + 
                bulkSelection.budgetarySupport.length
              })
            </Button>
          )}

          {/* Export Button */}
          <Button
            variant="outlined"
            color="secondary"
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            startIcon={<GetAppIcon />}
            sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Export
          </Button>

          {/* Activity Log Button */}
          <Button
            variant="outlined"
            onClick={() => setShowActivityLog(true)}
            startIcon={<HistoryIcon />}
            sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Activity
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
      </Box>

      {/* Mobile Speed Dial for Actions */}
      {isMobile && (
        <SpeedDial
          ariaLabel="Mobile Actions"
          sx={{ position: 'fixed', bottom: 16, right: 16, display: { xs: 'block', md: 'none' } }}
          icon={<SpeedDialIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
        >
          <SpeedDialAction
            icon={<GetAppIcon />}
            tooltipTitle="Export"
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          />
          <SpeedDialAction
            icon={<HistoryIcon />}
            tooltipTitle="Activity Log"
            onClick={() => setShowActivityLog(true)}
          />
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
        <MenuItem onClick={() => handleBulkStatusChange('Draft')}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Save Selected as Draft</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleBulkStatusChange('Submitted')}>
          <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Submit Selected</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          const currentType = activeTab === 'PSPermanent' || activeTab === 'PSCasual' || activeTab === 'PSChargedToIncome' || activeTab === 'COS/JO' ? 'personnel' : 
                             activeTab === 'MOOE' ? 'mooe' :
                             activeTab === 'Capital Outlay' ? 'capitalOutlay' :
                             activeTab === 'Income' ? 'income' : 'budgetarySupport';
          handleSelectAll(currentType);
          setBulkActionsAnchor(null);
        }}>
          <ListItemIcon><SelectAllIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Select All in Tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          setBulkSelection({ personnel: [], mooe: [], capitalOutlay: [], income: [], budgetarySupport: [] });
          setShowBulkActions(false);
          setBulkActionsAnchor(null);
        }}>
          <ListItemIcon><DeselectIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Deselect All</ListItemText>
        </MenuItem>
      </Menu>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={generatePDFReport}>
          <ListItemIcon><PictureAsPdfIcon /></ListItemIcon>
          <ListItemText primary="Export as PDF" />
        </MenuItem>
        <MenuItem onClick={generateExcelReport}>
          <ListItemIcon><GetAppIcon /></ListItemIcon>
          <ListItemText primary="Export as Excel" />
        </MenuItem>
      </Menu>

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
