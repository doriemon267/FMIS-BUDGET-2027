import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useUser } from "../../context/UserContext";
import CustomSnackbar from "../../global/components/CustomSnackbar";
import { FaProjectDiagram } from "react-icons/fa";
import BudgetarySupportTable from "../budgetarysupport/BudgetarySupportTable";
import { toast } from "react-toastify";
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
import { styled } from "@mui/material/styles";

const CAPITAL_OUTLAY_VIEW_PREFERENCE_KEY = "capitalOutlayViewPreference";

const ProposalCustomPage = ({
  dataListName,
  schema,
  title = "Budget Proposal Entry",
  description = "",
}) => {
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const { readOnly, canCreate } = useUserRestrictions();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const activeRegionKey =
    activeRegion?.name ||
    activeRegion?.regionName ||
    activeRegion?.Region ||
    activeRegion?.id ||
    "";
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
  const [activeDueDate, setActiveDueDate] = useState(null);
  const [isDueDatePassed, setIsDueDatePassed] = useState(true); // Conservative: block until API confirms due date is valid
  const [budgetDeficit, setBudgetDeficit] = useState(null);
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
      console.error("Error fetching all data:", error);
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
      toast.success("Proposal created successfully!");
      setCreateDialogOpen(false);
      setPrivacyNoticeAccepted(false);
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
        `Error creating proposal: ${
          error.response?.data?.message || error.message
        }`
      );
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

  // Enhanced UX state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // 'saved', 'saving', 'error'
  const [validationErrors, setValidationErrors] = useState({});

  // ADDED: Restore activeWorkflowRef from storage on mount to preserve proposal ID across page refreshes
  // Also verify that the stored proposal still exists in the database
  useEffect(() => {
    const storedWorkflowRef =
      sessionStorage.getItem("activeWorkflowRef") ||
      localStorage.getItem("activeWorkflowRef");
    if (storedWorkflowRef && !currentProposalId) {
      // Verify the proposal still exists before setting it
      const verifyProposal = async () => {
        try {
          const response = await api.get(
            `/api/allproposal/proposals/${storedWorkflowRef}`
          );
          // Backend returns { success: true, data: proposal } - check for data property
          if (response.data?.success && response.data?.data) {
            setCurrentProposalId(storedWorkflowRef);
          } else {
            // Proposal not found - clear storage
            // console.log(
              // "[ProposalCustomPage] Stored proposal not found, clearing reference"
            // );
            sessionStorage.removeItem("activeWorkflowRef");
            localStorage.removeItem("activeWorkflowRef");
            setCurrentProposalId(null);
          }
        } catch (error) {
          // Error fetching proposal (likely 404) - clear storage
          // console.log(
            // "[ProposalCustomPage] Error verifying stored proposal, clearing reference:",
            // error.message
          // );
          sessionStorage.removeItem("activeWorkflowRef");
          localStorage.removeItem("activeWorkflowRef");
          setCurrentProposalId(null);
        }
      };
      verifyProposal();
    }
  }, []);

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

      const sumFromLeaves = (leaves, keys) =>
        leaves.reduce((sum, leaf) => {
          if (!includeByStatus(leaf.status)) {
            return sum;
          }
          return sum + pickNumber(leaf.node, keys);
        }, 0);

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

      const personnelTotal = filteredPersonnelData.reduce((sum, p) => {
        if (!includeByStatus(p.status)) {
          return sum;
        }

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

      const mooeRegularTotal = filteredMooeData.reduce((sum, item) => {
        if (!includeByStatus(item.status)) {
          return sum;
        }
        return sum + parseNumeric(item.amount);
      }, 0);

      const iasOMCostTotal = iasOMCostData
        ? parseNumeric(iasOMCostData.nis) +
          parseNumeric(iasOMCostData.cis) +
          parseNumeric(iasOMCostData.nisSubsidy) +
          parseNumeric(iasOMCostData.cisSubsidy)
        : 0;

      const mooeTotal = mooeRegularTotal + iasOMCostTotal;

      const capitalOutlayTotal = filteredCapitalOutlayData.reduce((sum, item) => {
        if (!includeByStatus(item.status)) {
          return sum;
        }
        return sum + parseNumeric(item.cost);
      }, 0);

      const mooeLeaves = collectLeafRecords(filteredMooeData);
      const capitalLeaves = collectLeafRecords(filteredCapitalOutlayData);

      const mooeIncomeTotal = sumFromLeaves(mooeLeaves, incomeKeys);
      const mooeSubsidyTotal = sumFromLeaves(mooeLeaves, subsidyKeys);

      const capitalOutlayIncomeTotal = sumFromLeaves(capitalLeaves, incomeKeys);
      const capitalOutlaySubsidyTotal = sumFromLeaves(capitalLeaves, subsidyKeys);

      const combinedIncomeTotal = mooeIncomeTotal + capitalOutlayIncomeTotal;
      const combinedSubsidyTotal = mooeSubsidyTotal + capitalOutlaySubsidyTotal;

      const incomeTotal = parseNumeric(incomeGrandTotal) || 0;
      const expensesTotal = mooeTotal + capitalOutlayTotal;
      const budgetarySupportTotal =
        calculateTotalBudget.budgetarySupportTotal || 0;

      const isIncomeBalanced =
        Math.abs(incomeTotal - combinedIncomeTotal) < 0.01;
      const isSubsidyBalanced =
        Math.abs(budgetarySupportTotal - combinedSubsidyTotal) < 0.01;
      const isBalanced = Math.abs(expensesTotal - incomeTotal) < 0.01;

      return {
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
      };
    } catch (error) {
      console.error("Error calculating budget summary:", error);
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
        console.error("Bulk action error:", error);
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
    <Box sx={{ display: { xs: "block", md: "none" } }}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          "& .MuiTab-root": {
            minWidth: "auto",
            fontSize: "0.75rem",
            px: 1,
          },
        }}
      >
        <Tab
          label="Income"
          value="Income"
          icon={<FaMoneyCheckAlt size={16} />}
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
          icon={<FaMoneyBill size={16} />}
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
          console.warn("No active settings data returned from API");
        }
      } catch (activeError) {
        console.error("Error fetching active settings:", activeError);
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

  return (
    <Box sx={{ p: 0, bgcolor: "white", minHeight: "100vh" }}>
      {/* Modern Header Section */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 0,
          background: "#375e38",
          color: "white",
          boxShadow: "none",
          transition: "all 0.3s ease",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            variant="h5"
            component="h1"
            gutterBottom
            sx={{ fontWeight: "bold", fontSize: "1.8rem" }}
          >
            {title}
          </Typography>
          <Typography
            variant="body1"
            component="h2"
            sx={{ opacity: 0.9, fontSize: "0.9rem" }}
          >
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
            "& .MuiOutlinedInput-root": {
              color: "#333",
              backgroundColor: "white",
              borderRadius: "6px",
              "& fieldset": {
                borderColor: "#e0e0e0",
              },
              "&:hover fieldset": {
                borderColor: "#e0e0e0",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#2d5016",
                borderWidth: "2px",
              },
            },
            "& .MuiOutlinedInput-input": {
              "&::placeholder": {
                opacity: 0.6,
                color: "#999",
              },
            },
            "& .MuiSvgIcon-root": {
              color: "#999",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ opacity: 0.6, fontSize: "1.2rem" }} />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <StyledBox>
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
                color="primary"
                size="small"
              />
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
                sx={{ fontWeight: 600, mb: 1, color: "#1976d2" }}
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
                backgroundColor: "#1976d2",
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
                    disabled={createProposalMutation.isLoading || (isDueDatePassed && !isSuperAdmin)}
                    startIcon={
                      createProposalMutation.isLoading ? (
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
                    {createProposalMutation.isLoading
                      ? "Creating..."
                      : isDueDatePassed && !isSuperAdmin
                      ? "Due Date Passed"
                      : "+ Create Proposal"}
                  </Button>
                </span>
              </Tooltip>
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
                        "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
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
              boxShadow: "none",
              borderRadius: "0px",
              overflow: "hidden",
              border: "none",
              transition: "all 0.2s ease",
              bgcolor: "#375e38",
              display: { xs: "none", md: "block" },
            }}
          >
            {/* Tabs Header with Green Background */}
            <Box
              sx={{
                background: "#375e38",
                color: "white",
                px: 1,
                py: 1,
                display: "flex",
                gap: 0,
                alignItems: "stretch",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {[
                { label: "INCOME", value: "Income" },
                { label: "PS - Permanent", value: "PSPermanent" },
                { label: "PS - Casual", value: "PSCasual" },
                { label: "PS - Charged to Income", value: "PSChargedToIncome" },
                { label: "COS/JO", value: "COS/JO" },
                { label: "MOOE", value: "MOOE" },
                { label: "CAPITAL OUTLAY", value: "Capital Outlay" },
                { label: "BSGC", value: "Budgetary Support" },
              ].map((tab, index, arr) => {
                const isActive = activeTab === tab.value;
                return (
                  <Box
                    key={index}
                    onClick={() => setActiveTab(tab.value)}
                    sx={{
                      flex: 1,
                      bgcolor: isActive ? "#2b4a2c" : "transparent",
                      color: "white",
                      textTransform: "uppercase",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      letterSpacing: "0.8px",
                      p: 1.25,
                      borderRight:
                        index < arr.length - 1
                          ? "1px solid rgba(255,255,255,0.25)"
                          : "none",
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                      textAlign: "center",
                      "&:hover": {
                        bgcolor: isActive
                          ? "#2b4a2c"
                          : "rgba(255,255,255,0.08)",
                      },
                    }}
                  >
                    {tab.label}
                  </Box>
                );
              })}
            </Box>
          </Paper>

          {/* Tab Content Rendering */}
          <Box sx={{ mt: 3, mb: 3, width: "100%" }}>
            {activeTab === "Income" && (
              <IncomeTable
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
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
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "PSCasual" && (
              <PSCasualServiceTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "PSChargedToIncome" && (
              <PSChargedToIncomeTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "COS/JO" && (
              <PSCOSCustomPageTable
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
                  (dataListName !== "tests" ? dataListName : undefined)
                }
              />
            )}

            {activeTab === "MOOE" && (
              <Mooe
                dataListName={dataListName}
                schema={schema}
                region={activeRegion}
                fiscalYear={selectedFiscalYear}
                proposalId={
                  currentProposalId ||
                  sessionStorage.getItem("activeWorkflowRef") ||
                  localStorage.getItem("activeWorkflowRef") ||
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
                  fiscalYear={selectedFiscalYear}
                  proposalId={
                    currentProposalId ||
                    sessionStorage.getItem("activeWorkflowRef") ||
                    localStorage.getItem("activeWorkflowRef") ||
                    (dataListName !== "tests" ? dataListName : undefined)
                  }
                />
              ) : (
                <CapitalOutlayTable
                  dataListName={dataListName}
                  schema={schema}
                  region={activeRegion}
                  fiscalYear={selectedFiscalYear}
                  proposalId={
                    currentProposalId ||
                    sessionStorage.getItem("activeWorkflowRef") ||
                    localStorage.getItem("activeWorkflowRef") ||
                    (dataListName !== "tests" ? dataListName : undefined)
                  }
                />
              ))}

            {activeTab === "Budgetary Support" && (
              <>
                {!activeBudgetType || !selectedFiscalYear ? (
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
                      Fiscal Year: {selectedFiscalYear || "Loading..."}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Budget Type: {activeBudgetType || "Loading..."}
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
                Bulk Actions (
                {bulkSelection.personnel.length +
                  bulkSelection.mooe.length +
                  bulkSelection.capitalOutlay.length +
                  bulkSelection.income.length +
                  bulkSelection.budgetarySupport.length}
                )
              </Button>
            )}

            {/* Export Button */}
            <Button
              variant="outlined"
              color="secondary"
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              startIcon={<GetAppIcon />}
              sx={{ mr: 1, display: { xs: "none", sm: "inline-flex" } }}
            >
              Export
            </Button>

            {/* Activity Log Button */}
            <Button
              variant="outlined"
              onClick={() => setShowActivityLog(true)}
              startIcon={<HistoryIcon />}
              sx={{ mr: 1, display: { xs: "none", sm: "inline-flex" } }}
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
