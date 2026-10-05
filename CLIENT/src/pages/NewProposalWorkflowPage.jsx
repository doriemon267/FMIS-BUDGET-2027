import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Switch,
  FormControlLabel,
  ButtonBase,
  useTheme,
} from "@mui/material";
import {
  Send as SendIcon,
  CallSplit as UnconsolidateIcon,
  ThumbUp as ApproveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  TableChart as TableChartIcon,
  ListAlt as LogsIcon,
  ForwardToInbox as ApproveForwardIcon,
  KeyboardReturn as ReturnIcon,
} from "@mui/icons-material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import HistoryIcon from "@mui/icons-material/History";
import { 
  FiLayers, 
  FiUser, 
  FiActivity, 
  FiTrendingUp, 
  FiUserCheck, 
  FiUsers, 
  FiCreditCard, 
  FiBriefcase, 
  FiCpu 
} from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import api from "../config/api";
import ProposalAttachments from "../components/workflow/ProposalAttachments";
import { toast } from "react-toastify";
import { useWorkflowRef } from "../hooks/useWorkflowRef";
import { prettyRole } from '../utils/role-utils';
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { displayUacs } from '../utils/uacsDisplayHelper';
import logger from '../utils/logger';
import { handleApiError } from '../utils/errorHandler';
import { useDebouncedCallback } from '../hooks/useDebounce';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import ErrorAlert from '../components/common/ErrorAlert';
import { preventNegativeNumericKey, toNonNegativeNumber } from '../utils/preventNegativeInput';
import ProposalVersionHistoryDialog from '../components/myproposal/ProposalVersionHistoryDialog';
import { createWorkflowDigitalSignature, actionRequiresDigitalSignature } from '../utils/digitalSignature';
import { useProposalLock } from "../hooks/useProposalLock";

// Brand colors aligned to Transactions Processing UI
const BRAND_COLORS = {
  darkGreen: "#375e38",
  deepGreen: "#2d5016",
};

// Enhanced table styles for Proposal Details tabs
const TABLE_HEADER_ROW = {
  bgcolor: BRAND_COLORS.deepGreen,
  "& .MuiTableCell-root": { color: "white", fontWeight: 600, fontSize: "0.8125rem", py: 1.25, borderBottom: "none" },
};
const TABLE_CONTAINER = {
  borderRadius: 2,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
};
// PS tabs: allow horizontal scroll when table is wide; min widths so all columns display
const TABLE_CONTAINER_PS = {
  ...TABLE_CONTAINER,
  overflowX: "auto",
  overflow: "auto",
};
const PS_TABLE_MIN_WIDTH = 3500;
const PS_HEADER_CELL = {
  expand: { width: 50, minWidth: 50 },
  name: { minWidth: 160 },
  position: { minWidth: 160 },
  sg: { minWidth: 56 },
  step: { minWidth: 56 },
  jg: { minWidth: 56 },
  amount: { minWidth: 130 },
};

const renderPSTableHead = (headerBg) => (
  <TableHead>
    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg || BRAND_COLORS.deepGreen }}>
      <TableCell sx={{ ...PS_HEADER_CELL.expand }}></TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.name }}>Employee Name</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.position }}>Position</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.sg }}>SG</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.step }}>STEP</TableCell>
      <TableCell sx={{ fontWeight: "bold", ...PS_HEADER_CELL.jg }}>JG</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>No. of Dependents</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Monthly Salary</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Annual Salary</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>PERA</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>RATA</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Subsistence Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Uniform Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Productivity Incentive</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Honoraria</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Medical Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Additional Medical</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Children Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Meal Allowance</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Hazard Pay</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Cash Gift</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Midyear Bonus</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Year End Bonus</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>GSIS Premium</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Provident Fund</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>PG (Pag-ibig)</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Philhealth Premium</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Employee Compensation</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Loyalty Award</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Earned Leaves</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Retirement Benefits</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Terminal Leave</TableCell>
      <TableCell align="right" sx={{ fontWeight: "bold", ...PS_HEADER_CELL.amount }}>Total</TableCell>
    </TableRow>
  </TableHead>
);

// Sum Other Compensation and Government Share from personnel row (for PS tab display)
const getOtherCompensation = (p) =>
  (Number(p?.uniformALLOWANCE) || 0) +
  (Number(p?.productivityIncentive) || 0) +
  (Number(p?.medical) || 0) +
  (Number(p?.additionalMedical) || 0) +
  (Number(p?.childrenAllowance) || 0) +
  (Number(p?.meal) || 0) +
  (Number(p?.cashGift) || 0) +
  (Number(p?.subsistenceAllowance) || 0) +
  (Number(p?.subsistenceAllowanceMDS) || 0) +
  (Number(p?.subsistenceAllowanceST) || 0) +
  (Number(p?.midyearBonus) || 0) +
  (Number(p?.yearEndBonus) || 0) +
  (Number(p?.loyaltyAward) || 0) +
  (Number(p?.overtimePay) || 0) +
  (Number(p?.earnedLeaves) || 0) +
  (Number(p?.retirementBenefits) || 0) +
  (Number(p?.terminalLeave) || 0) +
  (Number(p?.courtAppearance) || 0);
const getGovernmentShare = (p) =>
  (Number(p?.gsisPremium) || 0) +
  (Number(p?.providentFund) || 0) +
  (Number(p?.philhealthPremium) || 0) +
  (Number(p?.pagibigPremium) || 0) +
  (Number(p?.employeeCompensation) || 0);

// Workflow constants based on the provided specification
const WORKFLOW_ROLES = {
  "BUDGET PREPARER": "Preparer",
  "BUDGET REVIEWER": "Reviewer",
  "BUDGET APPROVER": "Approver",
  "BUDGET PLANNING ANALYST": "Planning Analyst",
  "BUDGET OFFICER": "Officer",
  "BUDGET MANAGER": "Manager",
};

const WORKFLOW_STATUSES = {
  DRAFT: { label: "Draft", color: "default" },
  FORWARDED_TO_REVIEWER: { label: "Forwarded to Reviewer", color: "primary" },
  FORWARDED_TO_APPROVER: { label: "Forwarded to Approver", color: "primary" },
  FORWARDED_TO_BRD_ANALYST: { label: "Forwarded to Analyst", color: "primary" },
  FORWARDED_TO_BRD_OFFICER: { label: "Forwarded to Officer", color: "primary" },
  FORWARDED_TO_BRD_MANAGER: { label: "Forwarded to Manager", color: "primary" },
  FINALIZED: { label: "Finalized", color: "success" },
  RETURNED_TO_PREPARER: { label: "Returned to Preparer", color: "warning" },
  RETURNED_TO_REVIEWER: { label: "Returned to Reviewer", color: "warning" },
  RETURNED_TO_APPROVER: { label: "Returned to Approver", color: "warning" },
  RETURNED_TO_PLANNING_ANALYST: {
    label: "Returned to Analyst",
    color: "warning",
  },
  RETURNED_TO_OFFICER: { label: "Returned to Officer", color: "warning" },
  MERGED: { label: "Consolidated (Archived)", color: "default" },
};

// Base tabs; Monitoring tab will be injected dynamically for Budget Manager
const BASE_TABS = [
  { label: "All Proposals", value: "all-proposals" },
  { label: "My Proposals", value: "my-proposals" },
  { label: "Pending Review", value: "pending-review" },
];

// Centralize the workflow API base path to avoid mismatched endpoints
const WORKFLOW_API_BASE = "/api/allproposal/proposals";

const NewProposalWorkflowPage = () => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === 'dark' ? '#0b2413' : '#2d5016';
  const highlightBg = theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.15)' : 'rgba(46, 125, 50, 0.06)';
  const titleColor = theme.palette.mode === 'dark' ? '#a5d6a7' : '#2d5016';
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [searchParams] = useSearchParams();
  const { setWorkflowRef } = useWorkflowRef();
  const queryClient = useQueryClient();
  const signerMode = String(import.meta.env.VITE_PNPKI_SIGNER_MODE || '').toLowerCase() || 'disabled';

  // Check if user is BRD (Budget Revenue Division) level or SUPER ADMIN
  const isBRDUser = currentUser?.Roles?.some((role) =>
    [
      "BUDGET_REVIEWER",
      "BUDGET REVIEWER",
      "BUDGET_APPROVER",
      "BUDGET APPROVER",
      "BUDGET_PLANNING_ANALYST",
      "BUDGET PLANNING ANALYST",
      "BUDGET_OFFICER",
      "BUDGET OFFICER",
      "BUDGET_MANAGER",
      "BUDGET MANAGER",
      "SUPER_ADMIN",
      "SUPER ADMIN",
    ].includes(role)
  );

  // Check if user is actual BRD staff (Planning Analyst, Officer, Manager) - only these should have status filter
  const isBRDStaff = currentUser?.Roles?.some((role) =>
    [
      "BUDGET_PLANNING_ANALYST",
      "BUDGET PLANNING ANALYST",
      "BUDGET_OFFICER",
      "BUDGET OFFICER",
      "BUDGET_MANAGER",
      "BUDGET MANAGER",
      "SUPER_ADMIN",
      "SUPER ADMIN",
    ].includes(role)
  );

  // State management - default to "All Proposals" (index 0)
  const [activeTab, setActiveTab] = useState(0);
  const hasInitializedDefaultTabRef = useRef(false);

  // Build tabs dynamically (include Monitoring for Budget Manager and SUPER_ADMIN)
  const isBudgetManager = (currentUser?.Roles || []).some((r) => {
    const norm = String(r || '').toUpperCase().replace(/[^A-Z]/g, '');
    // matches BUDGETMANAGER, BUDGET_MANAGER, BUDGET MANAGER
    return norm === 'BUDGETMANAGER';
  });

  // Check if user is SUPER_ADMIN
  const isSuperAdmin = (currentUser?.Roles || []).some((role) =>
    [
      "SUPER_ADMIN",
      "SUPER ADMIN",
    ].includes(role)
  );

  const isBudgetPreparer = (currentUser?.Roles || []).some((role) =>
    ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(String(role || "").toUpperCase())
  );

  // Check if user is Budget Approver
  const isBudgetApprover = (currentUser?.Roles || []).some((role) =>
    ["BUDGET APPROVER", "BUDGET_APPROVER"].includes(String(role || "").toUpperCase())
  );

  // Version history: BRD Budget Officer & Budget Manager only (same as backend)
  const canViewVersionHistory = (currentUser?.Roles || []).some((r) =>
    /BUDGET_OFFICER|BUDGET OFFICER|BUDGET_MANAGER|BUDGET MANAGER|OVERALL_BUDGET_APPROVER|SUPER_ADMIN|SUPER ADMIN/i.test(String(r || ''))
  );

  const tabs = (isBudgetManager || isSuperAdmin)
    ? [...BASE_TABS, { label: "Monitoring", value: "monitoring" }]
    : BASE_TABS;

  // Handle tab and proposalId parameters from query string (e.g., notifications deep link)
  // Format: /allproposal?tab=<tab>&proposalId=<id>
  const [targetProposalId, setTargetProposalId] = useState(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const proposalIdParam = searchParams.get("proposalId");

    // Handle tab parameter
    if (tabParam) {
      const tabIndex = tabs.findIndex((tab) => tab.value === tabParam);
      if (tabIndex !== -1) {
        setActiveTab(tabIndex);
        hasInitializedDefaultTabRef.current = true;
      }
    }

    // Store proposalId to auto-select it once proposals load
    if (proposalIdParam) {
      setTargetProposalId(proposalIdParam);
    }
  }, [searchParams, tabs]);

  useEffect(() => {
    if (hasInitializedDefaultTabRef.current) return;

    const tabParam = searchParams.get("tab");
    if (tabParam) return;

    const preferredTabValue = isBudgetPreparer
      ? "my-proposals"
      : "all-proposals";
    const preferredIndex = tabs.findIndex((tab) => tab.value === preferredTabValue);

    if (preferredIndex !== -1) {
      setActiveTab(preferredIndex);
      hasInitializedDefaultTabRef.current = true;
    }
  }, [searchParams, tabs, isBudgetPreparer, isBRDUser]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
  const [auditTrailData, setAuditTrailData] = useState([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [actionP12File, setActionP12File] = useState(null);
  const [actionP12Password, setActionP12Password] = useState("");
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [availableActionsForMenu, setAvailableActionsForMenu] = useState([]);
  const [proposalDetails, setProposalDetails] = useState(null);
  // ── Merge proposals state (Budget Approver only) ──────────────────────────
  const [selectedForMerge, setSelectedForMerge] = useState(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [unconsolidateDialogOpen, setUnconsolidateDialogOpen] = useState(false);
  const [unconsolidateLoading, setUnconsolidateLoading] = useState(false);
  const [discountSettings, setDiscountSettings] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState("income");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(20);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedConsolidated, setExpandedConsolidated] = useState({});
  const toggleConsolidated = (id) => {
    setExpandedConsolidated(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const [personnelPage, setPersonnelPage] = useState(0);
  const [personnelRowsPerPage, setPersonnelRowsPerPage] = useState(10);
  const [expandedPersonnel, setExpandedPersonnel] = useState({});
  const [permanentPersonnelPage, setPermanentPersonnelPage] = useState(0);
  const [permanentPersonnelRowsPerPage, setPermanentPersonnelRowsPerPage] = useState(10);
  const [casualPersonnelPage, setCasualPersonnelPage] = useState(0);
  const [casualPersonnelRowsPerPage, setCasualPersonnelRowsPerPage] = useState(10);
  const [chargedPersonnelPage, setChargedPersonnelPage] = useState(0);
  const [chargedPersonnelRowsPerPage, setChargedPersonnelRowsPerPage] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [analystsForProposal, setAnalystsForProposal] = useState([]);
  const [targetAnalystId, setTargetAnalystId] = useState(null);
  const [analystsForMenuProposal, setAnalystsForMenuProposal] = useState([]);

  // Proposal Lock Management
  const { lockStatus, acquireLock, releaseLock, hasLock } = useProposalLock(
    selectedProposal?._id,
    { autoRenew: true, showNotifications: true }
  );

  // SUPER ADMIN: default to "show all regions" so they see proposals without selecting a region
  useEffect(() => {
    if (isSuperAdmin) setShowAllRegions(true);
  }, [isSuperAdmin]);

  // Edit mode and change tracking for reviewers - now for items
  const [editableItems, setEditableItems] = useState({
    income: [],
    personnel: [],
    mooe: [],
    capitalOutlay: [],
  });
  const [changedItems, setChangedItems] = useState(new Set());
  // Inline proposal detail edits (for PREPARER while Draft)
  const [proposalEditValues, setProposalEditValues] = useState({
    title: "",
    description: "",
  });
  const [proposalEditDirty, setProposalEditDirty] = useState(false);

  const normalizeName = useCallback((value) => {
    if (!value) return "";
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9\s\-()/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const toNumber = useCallback((value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  useEffect(() => {
    const fetchDiscountSettings = async () => {
      const fiscalYear = selectedProposal?.fiscalYear || proposalDetails?.fiscalYear;
      const budgetType = selectedProposal?.budgetType || proposalDetails?.budgetType;
      const regionRaw =
        selectedProposal?.region ||
        proposalDetails?.region ||
        proposalDetails?.income?.[0]?.region ||
        proposalDetails?.income?.[0]?.Region ||
        "";
      const region = regionRaw && typeof regionRaw === "object"
        ? (regionRaw.RegionName || regionRaw.Region || regionRaw.regionName || regionRaw.region || regionRaw.name || "")
        : String(regionRaw || "");
      if (!fiscalYear || !budgetType || !region) {
        setDiscountSettings(null);
        return;
      }
      try {
        const response = await api.get("/api/discount-settings", {
          params: { fiscalYear, budgetType, region }
        });
        setDiscountSettings(response.data || null);
      } catch (error) {
        logger.warn("Unable to load discount settings", error);
        setDiscountSettings(null);
      }
    };

    fetchDiscountSettings();
  }, [
    selectedProposal?.fiscalYear,
    selectedProposal?.budgetType,
    selectedProposal?.region,
    proposalDetails?.fiscalYear,
    proposalDetails?.budgetType,
    proposalDetails?.region,
    proposalDetails?.income
  ]);

  // Fetch analysts when action menu opens for a proposal at Approver/Reviewer step (for dynamic "Send to" label)
  useEffect(() => {
    if (!actionMenuAnchor || !selectedProposal?._id) {
      setAnalystsForMenuProposal([]);
      return;
    }
    setAnalystsForMenuProposal([]); // Clear while fetching for new proposal
    const atApproverStep = ["Forwarded to Approver", "Returned to Approver", "FORWARDED_TO_APPROVER", "RETURNED_TO_APPROVER"].includes(selectedProposal?.status);
    const atReviewerStep = ["Forwarded to Reviewer", "Returned to Reviewer", "FORWARDED_TO_REVIEWER", "RETURNED_TO_REVIEWER"].includes(selectedProposal?.status);
    const isApprover = (currentUser?.Roles || []).some((r) => ["BUDGET APPROVER", "BUDGET_APPROVER"].includes(String(r)));
    const isReviewer = (currentUser?.Roles || []).some((r) => ["BUDGET REVIEWER", "BUDGET_REVIEWER"].includes(String(r)));
    if (!(atApproverStep && isApprover) && !(atReviewerStep && isReviewer)) {
      setAnalystsForMenuProposal([]);
      return;
    }
    let cancelled = false;
    api.get(`${WORKFLOW_API_BASE}/${selectedProposal._id}/analysts-for-proposal`)
      .then((res) => {
        if (!cancelled) setAnalystsForMenuProposal(res?.data?.data || []);
      })
      .catch(() => { if (!cancelled) setAnalystsForMenuProposal([]); });
    return () => { cancelled = true; };
  }, [actionMenuAnchor, selectedProposal?._id, selectedProposal?.status, currentUser?.Roles]);

  // Update menu actions when analysts load (for dynamic "Send to" label)
  useEffect(() => {
    if (actionMenuAnchor && selectedProposal) {
      setAvailableActionsForMenu(getAvailableActions(selectedProposal, analystsForMenuProposal));
    }
  }, [analystsForMenuProposal, actionMenuAnchor, selectedProposal]);

  // Fetch analysts for "Send to" when Approver/Reviewer forwards to Analyst (Central Office vs Other Region)
  const isSubmitToAnalystAction = ["approver-approve-forward-analyst", "reviewer-approve-forward-analyst", "approver-approve-forward-officer"].includes(actionType);
  useEffect(() => {
    if (!actionDialogOpen || !isSubmitToAnalystAction || !selectedProposal?._id) {
      setAnalystsForProposal([]);
      setTargetAnalystId(null);
      return;
    }
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await api.get(`${WORKFLOW_API_BASE}/${selectedProposal._id}/analysts-for-proposal`);
        const analysts = res?.data?.data || [];
        if (!cancelled) {
          setAnalystsForProposal(analysts);
          setTargetAnalystId(analysts[0]?.userId || null);
        }
      } catch (err) {
        if (!cancelled) {
          setAnalystsForProposal([]);
          setTargetAnalystId(null);
        }
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [actionDialogOpen, isSubmitToAnalystAction, selectedProposal?._id]);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Debounced search handler
  const debouncedSearch = useDebouncedCallback((query) => {
    // Trigger refetch with new search query
    if (query !== searchQuery) {
      fetchProposals({ forceAllRegions: showAllRegions });
    }
  }, 300);
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': (e) => {
      e.preventDefault();
      // Focus search input
      const searchInput = document.querySelector('input[placeholder*="Search"]');
      if (searchInput) searchInput.focus();
    },
    'ctrl+r': (e) => {
      e.preventDefault();
      fetchProposals({ forceAllRegions: showAllRegions });
    },
  });

  // Determine user's workflow role
  const userWorkflowRole =
    currentUser?.hierarchicalAssignment?.userRole ||
    (currentUser?.Roles?.includes("BUDGET_PREPARER")
      ? "BUDGET PREPARER"
      : null);

  const canCreate = userWorkflowRole === "BUDGET PREPARER";

  // Monitoring metrics (manager only)
  const [monitoringMetrics, setMonitoringMetrics] = useState(null);

  const resolvedWorkflowRef =
    selectedProposal?._id ||
    (typeof window !== "undefined"
      ? sessionStorage.getItem("activeWorkflowRef") ||
        localStorage.getItem("activeWorkflowRef")
      : null);

  // Compute resolved region for API calls
  const resolvedRegion = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion._id || activeRegion.id || activeRegion.Region || activeRegion.regionName || activeRegion.name)
    : activeRegion;

  // Get current tab view
  const activeTabView = tabs[activeTab]?.value || 'all-proposals';

  // React Query for real-time proposal fetching with polling
  const {
    data: proposalsData,
    isLoading: proposalsLoading,
    refetch: refetchProposals,
    isFetching: proposalsFetching,
  } = useQuery({
    queryKey: ['workflowProposals', activeTabView, showAllRegions ? null : resolvedRegion],
    queryFn: async () => {
      const params = {
        region: showAllRegions ? undefined : resolvedRegion,
        view: activeTabView,
      };
      const response = await api.get(WORKFLOW_API_BASE, { params });
      return response.data;
    },
    staleTime: 5000, // Consider data stale after 5 seconds
    refetchInterval: 10000, // Poll every 10 seconds for real-time updates
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
  });

  // Sync proposals state from React Query
  const proposals = proposalsData?.proposals || [];
  const loading = proposalsLoading;

  // Handle monitoring metrics from query data
  useEffect(() => {
    if (activeTabView === "monitoring" && proposalsData?.metrics) {
      setMonitoringMetrics(proposalsData.metrics);
    } else if (activeTabView !== "monitoring") {
      setMonitoringMetrics(null);
    }
  }, [activeTabView, proposalsData]);

  // Manual refetch function for backward compatibility
  const fetchProposals = useCallback(async (options = {}) => {
    // Trigger React Query refetch
    refetchProposals();
  }, [refetchProposals]);

  // Human readable resolved region for UI badge
  const resolvedRegionString = activeRegion && typeof activeRegion === 'object'
    ? (activeRegion.regionName || activeRegion.Region || activeRegion.name || activeRegion._id)
    : (activeRegion || 'No region');

  // tabs already built above

  // Listen for query cache invalidation and auto-refetch proposals
  // This ensures that when employee benefits are updated, the proposal totals update in real-time
  useEffect(() => {
    // Skip for monitoring tab — it already has its own polling (refetchInterval: 10000)
    // Listening on 'added' while on monitoring causes infinite loop: refetch → 'added' → refetch
    if (activeTabView === 'monitoring') return;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Use 'removed' or 'updated' (not 'added') to avoid triggering on our own refetch
      if ((event.type === 'removed' || event.type === 'updated') &&
          (event.query.queryKey?.[0] === 'proposals' || 
           event.query.queryKey?.[0] === 'allProposals' ||
           event.query.queryKey?.[0] === 'personnelServices')) {
        refetchProposals();
      }
    });
    return unsubscribe;
  }, [queryClient, refetchProposals, activeTabView]);

  // Auto-select proposal from deep link (notification)
  useEffect(() => {
    if (targetProposalId && proposals.length > 0) {
      const proposal = proposals.find((p) => p._id === targetProposalId);
      if (proposal) {
        setSelectedProposal(proposal);
        setViewDetailsDialogOpen(true);
        // Clear the target so we don't auto-select again
        setTargetProposalId(null);
      }
    }
  }, [proposals, targetProposalId]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0);
  };

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Check if user is a reviewer
  const isReviewer = currentUser?.Roles?.some((role) =>
    [
      "BUDGET REVIEWER",
      "BUDGET_REVIEWER",
      "BUDGET APPROVER",
      "BUDGET_APPROVER",
    ].includes(role)
  );

  // Check if user can edit the current proposal based on their role and proposal status
  const canUserEdit = () => {
    if (!selectedProposal) return false;

    // Concurrency Control: Prevent edits if locked by someone else
    if (lockStatus?.isLocked && !hasLock) return false;

    const userRoles = currentUser?.Roles || [];
    const status = selectedProposal.status;
    const statusUpper = String(status || '').toUpperCase();

    // SUPER ADMIN: editable in all statuses EXCEPT Finalized
    const isSuperAdmin = userRoles.some((r) =>
      ['SUPER_ADMIN', 'SUPER ADMIN', 'SUPERADMIN'].includes(String(r || ''))
    );
    if (isSuperAdmin) {
      return statusUpper !== 'FINALIZED';
    }

    // Allow the owner (Budget Preparer) to edit while Draft/Returned
    if (
      userRoles.some((role) =>
        ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(role)
      )
    ) {
      const userName =
        currentUser?.name ||
        `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`.trim();
      const draftStatuses = [
        "DRAFT",
        "Draft",
        "draft",
        "Returned",
        "Returned to Preparer",
        "RETURNED_TO_PREPARER",
      ];
      const currentUserId = currentUser?.id || currentUser?._id || currentUser?.UserId || currentUser?.Id;
      
      // Check ownership by: name match, createdBy ID match, or processBy ID match
      const isOwnerByName =
        selectedProposal?.processBy &&
        userName &&
        selectedProposal.processBy === userName;
      const isOwnerByCreatedId =
        selectedProposal?.createdBy && currentUserId
          ? String(selectedProposal.createdBy) === String(currentUserId)
          : false;
      const isOwnerByProcessId =
        selectedProposal?.processBy && currentUserId
          ? String(selectedProposal.processBy) === String(currentUserId)
          : false;
          
      if (draftStatuses.includes(status) && (isOwnerByName || isOwnerByCreatedId || isOwnerByProcessId)) {
        return true;
      }
    }

    // Budget Reviewer can only edit when status is Forwarded to Reviewer or Returned to Reviewer
    if (
      userRoles.some((role) =>
        ["BUDGET REVIEWER", "BUDGET_REVIEWER"].includes(role)
      )
    ) {
      return [
        "Forwarded to Reviewer",
        "Returned to Reviewer",
        "FORWARDED_TO_REVIEWER",
        "RETURNED_TO_REVIEWER",
      ].includes(status);
    }

    // Budget Approver can only edit when status is Forwarded to Approver or Returned to Approver
    if (
      userRoles.some((role) =>
        ["BUDGET APPROVER", "BUDGET_APPROVER"].includes(role)
      )
    ) {
      return [
        "Forwarded to Approver",
        "Returned to Approver",
        "FORWARDED_TO_APPROVER",
        "RETURNED_TO_APPROVER",
      ].includes(status);
    }

    // Budget Planning Analyst can edit when status is Forwarded to Analyst or Returned to Analyst
    if (
      userRoles.some((role) =>
        ["BUDGET PLANNING ANALYST", "BUDGET_PLANNING_ANALYST"].includes(role)
      )
    ) {
      return [
        "Forwarded to Budget Planning Analyst",
        "Returned to Budget Planning Analyst",
        "Returned",
        "FORWARDED_TO_BRD_ANALYST",
        "RETURNED_TO_PLANNING_ANALYST",
      ].includes(status);
    }

    // Budget Officer can edit when status is Forwarded to Officer or Returned to Officer
    if (
      userRoles.some((role) =>
        ["BUDGET OFFICER", "BUDGET_OFFICER"].includes(role)
      )
    ) {
      return [
        "Forwarded to Budget Officer",
        "Returned to Budget Officer",
        "Returned",
        "FORWARDED_TO_BRD_OFFICER",
        "RETURNED_TO_OFFICER",
      ].includes(status);
    }

    // Budget Manager can edit when status is Forwarded to Manager or Returned to Manager
    if (
      userRoles.some((role) =>
        ["BUDGET MANAGER", "BUDGET_MANAGER"].includes(role)
      )
    ) {
      // Only allow manager edits for forwarded statuses or if the proposal is 'Returned' specifically to the Budget Manager
      const forwardedAllowed = [
        "Forwarded to Overall Budget Approver",
        "Forwarded to Manager",
        "FORWARDED_TO_BRD_MANAGER",
        "FORWARDED_TO_MANAGER",
      ].includes(status);
      const returnedToManager = (status === "Returned" || status === "RETURNED") && selectedProposal?.currentAssigneeRole === "BUDGET_MANAGER";
      return forwardedAllowed || returnedToManager;
    }

    return false;
  };

  // Handle view details
  const handleViewDetails = async (proposal) => {
    setDetailsLoading(true);
    setViewDetailsDialogOpen(true);
    setSelectedProposal(proposal);
    if (proposal?._id) {
      setWorkflowRef(proposal._id);
    }
    setDetailsTab("income");
    setChangedItems(new Set());
    setPermanentPersonnelPage(0);
    setCasualPersonnelPage(0);
    setChargedPersonnelPage(0);
    // Initialize inline edit form values
    setProposalEditValues({
      title: proposal.title || "",
      description: proposal.description || "",
    });
    setProposalEditDirty(false);

    try {
      const queryParams = {
        proposalId: proposal._id,
        _t: Date.now(), // Cache buster - force fresh data
        ...(proposal.fiscalYear != null && { fiscalYear: String(proposal.fiscalYear) }),
        budgetType: proposal.budgetType || proposal.modelType || "",
        region: proposal.regionName || (proposal.region && typeof proposal.region === 'object' ? (proposal.region.Region || proposal.region.RegionName || proposal.region.region) : proposal.region) || "",
        ...((proposal.division || proposal.responsibilityCenter) && {
          division: proposal.division || proposal.responsibilityCenter,
        }),
      };

      // Use same params for all - do NOT add region filter when viewing proposal details
      // (region filter would exclude records and show empty tables)
      let incomeRes = { data: [] };
      let personnelRes = { data: [] };
      let mooeRes = { data: [] };
      let capitalRes = { data: [] };

      if (proposal.isConsolidated) {
        incomeRes.data = proposal.incomeData || [];
        personnelRes.data = proposal.personnelData || [];
        mooeRes.data = proposal.mooeData || [];
        capitalRes.data = proposal.capitalData || [];
      } else {
        [incomeRes, personnelRes, mooeRes, capitalRes] = await Promise.all([
          api.get("/income/getByParams", { params: queryParams }),
          api.get("/getpersonnels/byParams", { params: queryParams }),
          api.get("/mooe/getByParams", { params: queryParams }),
          api.get("/capital-outlay/getByParams", { params: queryParams }),
        ]);
      }

      // Normalize: backend may return array directly or { data: [] }
      const toArray = (res) => {
        const raw = res?.data;
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray(raw.data)) return raw.data;
        return [];
      };

      const details = {
        income: proposal.isConsolidated ? incomeRes.data : toArray(incomeRes),
        personnel: proposal.isConsolidated ? personnelRes.data : toArray(personnelRes),
        mooe: proposal.isConsolidated ? mooeRes.data : toArray(mooeRes),
        capitalOutlay: proposal.isConsolidated ? capitalRes.data : toArray(capitalRes),
      };

      console.log("[DEBUG] Fetched proposal details statistics:", {
        income: details.income.length,
        personnel: details.personnel.length,
        mooe: details.mooe.length,
        capitalOutlay: details.capitalOutlay.length,
      });

      if (details.personnel.length > 0) {
        console.log("[DEBUG] Sample personnel record:", details.personnel[0]);
        const counts = details.personnel.reduce((acc, p) => {
          const status = String(p.statusOfAppointment || p.StatusOfAppointment || 'N/A').toUpperCase();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        console.log("[DEBUG] Appointment status breakdown counts:", counts);
      }

      setProposalDetails(details);

      // Fetch full proposal to include attachments/metadata
      try {
        const [proposalRes, totalsRes] = await Promise.all([
          api.get(`/api/allproposal/proposals/${proposal._id}`),
          api.get(`/api/allproposal/proposals/${proposal._id}/totals`, { hideErrorToast: true }).catch(() => null),
        ]);

        const proposalData = proposalRes.data?.data || proposalRes.data;
        const totalsData = totalsRes?.data?.data || null;

        if (proposalData) {
          setSelectedProposal({
            ...proposalData,
            ...(totalsData ? {
              projectedSubsidy: totalsData.projectedSubsidy,
              projectedCorporateIncome: totalsData.projectedCorporateIncome,
              proposedBudget: totalsData.proposedBudget,
              totalIncome: totalsData.totalIncome,
              totalExpenses: totalsData.totalExpenses,
            } : {}),
          });
        }
      } catch (err) {
        // If full proposal fetch fails, keep the selected proposal as-is
        logger.warn('Failed to fetch full proposal details for attachments', err);
      }

      setEditableItems({
        income: JSON.parse(JSON.stringify(details.income)),
        personnel: JSON.parse(JSON.stringify(details.personnel)),
        mooe: JSON.parse(JSON.stringify(details.mooe)),
        capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay)),
      });
    } catch (error) {
      handleApiError(error, toast, 'Loading proposal details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewAuditTrail = async (proposal) => {
    setAuditTrailLoading(true);
    setSelectedProposal(proposal);

    try {
      const response = await api.get(
        `${WORKFLOW_API_BASE}/${proposal._id}/audit-trail`
      );

      if (response.data.success) {
        const changes = response.data.data.changes || [];
        setAuditTrailData(changes);

        // Show toast notification if no changes found
        if (changes.length === 0) {
          toast.info("No changes recorded for this proposal yet");
        }

        setAuditTrailDialogOpen(true);
      } else {
        toast.error("Failed to fetch audit trail");
      }
    } catch (error) {
      handleApiError(error, toast, 'Loading audit trail');
    } finally {
      setAuditTrailLoading(false);
    }
  };

  // Map frontend action names to backend action names
  const canUserEditProposal = (proposal) => {
    if (!proposal || !currentUser) return false;

    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;

    const statusToRoleMap = {
      DRAFT: ["BUDGET PREPARER", "BUDGET_PREPARER"],
      Draft: ["BUDGET PREPARER", "BUDGET_PREPARER"],
      RETURNED_TO_PREPARER: ["BUDGET PREPARER", "BUDGET_PREPARER"],
      "Returned to Preparer": ["BUDGET PREPARER", "BUDGET_PREPARER"],
      FORWARDED_TO_REVIEWER: ["BUDGET REVIEWER", "BUDGET_REVIEWER"],
      "Forwarded to Reviewer": ["BUDGET REVIEWER", "BUDGET_REVIEWER"],
      RETURNED_TO_REVIEWER: ["BUDGET REVIEWER", "BUDGET_REVIEWER"],
      "Returned to Reviewer": ["BUDGET REVIEWER", "BUDGET_REVIEWER"],
      FORWARDED_TO_APPROVER: ["BUDGET APPROVER", "BUDGET_APPROVER"],
      "Forwarded to Approver": ["BUDGET APPROVER", "BUDGET_APPROVER"],
      RETURNED_TO_APPROVER: ["BUDGET APPROVER", "BUDGET_APPROVER"],
      "Returned to Approver": ["BUDGET APPROVER", "BUDGET_APPROVER"],
      FORWARDED_TO_BRD_ANALYST: [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      "Forwarded to Budget Planning Analyst": [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      RETURNED_TO_PLANNING_ANALYST: [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      "Returned to Budget Planning Analyst": [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      FORWARDED_TO_BRD_OFFICER: ["BUDGET OFFICER", "BUDGET_OFFICER"],
      "Forwarded to Budget Officer": ["BUDGET OFFICER", "BUDGET_OFFICER"],
      RETURNED_TO_OFFICER: ["BUDGET OFFICER", "BUDGET_OFFICER"],
      "Returned to Budget Officer": ["BUDGET OFFICER", "BUDGET_OFFICER"],
      FORWARDED_TO_BRD_MANAGER: ["BUDGET MANAGER", "BUDGET_MANAGER"],
      "Forwarded to Overall Budget Approver": [
        "BUDGET MANAGER",
        "BUDGET_MANAGER",
      ],
    };

    const allowedRoles = statusToRoleMap[currentStatus] || [];
    const userHasRole = userRoles.some((role) => allowedRoles.includes(role));

    if (userHasRole) {
      return true;
    }

    return false;
  };

  // Auto acquire/release lock when viewing proposal details
  useEffect(() => {
    if (viewDetailsDialogOpen && selectedProposal) {
      if (canUserEditProposal(selectedProposal)) {
        acquireLock();
      }
    } else {
      if (hasLock) {
        releaseLock();
      }
    }
  }, [viewDetailsDialogOpen, selectedProposal, acquireLock, releaseLock, hasLock]);

  const mapActionToBackend = (frontendAction) => {
    const actionMapping = {
      // Budget Preparer actions
      "submit-to-reviewer": "submit-to-reviewer",

      // Budget Reviewer actions
      "reviewer-approve-forward-approver": "submit-to-approver",
      "reviewer-approve-forward-analyst": "submit-to-analyst", // IMO path: skip Approver
      "reviewer-return": "return-to-preparer",
      "reviewer-save-edits": "reviewer-save-edits",

      // Budget Approver actions
      "approver-approve-forward-analyst": "submit-to-analyst",
      "approver-approve-forward-officer": "submit-to-analyst",
      "approver-return": "return-to-reviewer",
      "approver-save-edits": "approver-save-edits",

      // Budget Planning Analyst actions (BRD: return goes to Preparer only)
      "analyst-submit-to-officer": "forward-to-officer",
      "analyst-return": "return-to-preparer",
      "analyst-save-edits": "analyst-save-edits",

      // Budget Officer actions (BRD: return goes to Preparer only)
      "officer-approve": "forward-to-manager",
      "officer-return": "return-to-preparer",
      "officer-save-edits": "officer-save-edits",
      "officer-submit-to-manager": "forward-to-manager",

      // Budget Manager actions (BRD: return goes to Preparer only)
      "manager-approve": "finalize",
      "manager-return": "return-to-preparer",
      "manager-save-edits": "manager-save-edits",
    };

    return actionMapping[frontendAction] || frontendAction;
  };

  const getSignatureVerificationState = (entry) => {
    if (entry?.digitalSignature) {
      const hasFingerprint = Boolean(entry.digitalSignature.certificateFingerprint256);
      const trustBundleConfigured = entry.digitalSignature.trustBundleConfigured !== false;

      if (hasFingerprint && trustBundleConfigured) {
        return {
          label: "Valid (PNPKI)",
          color: "success",
          reason: "Cryptographic signature verified with trusted certificate chain.",
        };
      }

      if (hasFingerprint && !trustBundleConfigured) {
        return {
          label: "Unverifiable", 
          color: "warning",
          reason: "Signature cryptographically valid, but trust bundle is not configured.",
        };
      }

      return {
        label: "Unverifiable",
        color: "warning",
        reason: "Digital signature metadata is incomplete for strict trust verification.",
      };
    }

    return {
      label: "No signature",
      color: "default",
      reason: "No signature data recorded for this action.",
    };
  };

  // Helper function to calculate displayed amounts for any proposal in the table
  const getDisplayAmounts = (proposal) => {
    // CRITICAL: Always use backend-calculated projectedSubsidy and proposedBudget
    // The backend calculations are authoritative and properly exclude charged-to-income
    return {
      projectedSubsidy: Number(proposal?.projectedSubsidy ?? proposal?.totalExpenses ?? 0),
      proposedBudget: Number(proposal?.proposedBudget ?? proposal?.amount ?? 0)
    };
  };

  // Calculate projected subsidy from MOOE + Personnel Services + Capital Outlay
  const calculateProjectedSubsidy = () => {
    // If we have detailed line items, compute from them (subsidy-only fields)
    if (proposalDetails) {
      let total = 0;

      // MOOE subsidy
      if (proposalDetails.mooe?.length) {
        total += proposalDetails.mooe.reduce((sum, item) => {
          const val = Number(item.subsidy || item.totalSubsidy || 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      // Personnel Services subsidy
      // Align with Personnel Services table and BudgetarySupportTable:
      // only NON charged-to-income personnel are counted as subsidy.
      if (proposalDetails.personnel?.length) {
        const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter((p) => p.division === selectedProposal.division && p.chargedToIncomeEligible !== true)
          : proposalDetails.personnel.filter((p) => p.chargedToIncomeEligible !== true);
          
        total += sameDivision.reduce((sum, item) => {
          return sum + (Number(item.Total) || 0);
        }, 0);
      }

      // Capital Outlay subsidy only (no income)
      if (proposalDetails.capitalOutlay?.length) {
        total += proposalDetails.capitalOutlay.reduce((sum, item) => {
          const val = Number(item.subsidy || item.totalSubsidy || 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      return total;
    }

    // Fallbacks when details are not yet loaded: use backend-calculated subsidy, else total expenses, else amount
    return Number(selectedProposal?.projectedSubsidy ?? selectedProposal?.totalExpenses ?? selectedProposal?.amount ?? 0);
  };

  // Calculate projected income from PS Charged + MOOE Income + CO Income (excluding Corporate Income)
  const calculateProjectedIncome = () => {
    // If we have detailed line items, compute from them
    if (proposalDetails) {
      let total = 0;
      
      // NOTE: Corporate Income (Income model) is NOT included in Projected Income
      
      // Personnel Services Charged to Income
      if (proposalDetails.personnel?.length) {
         const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter((p) => p.division === selectedProposal.division)
          : proposalDetails.personnel;
        total += sameDivision.reduce((sum, item) => sum + (Number(item.chargedToIncomeAmount) || 0), 0);
      }
      
      // MOOE Income
      if (proposalDetails.mooe?.length) {
        total += proposalDetails.mooe.reduce((sum, item) => sum + (Number(item.income) || 0), 0);
      }
      
      // Capital Outlay Income
      if (proposalDetails.capitalOutlay?.length) {
        total += proposalDetails.capitalOutlay.reduce((sum, item) => sum + (Number(item.income) || 0), 0);
      }
      
      return total;
    }
    
    // Fallback to backend value
    return Number(selectedProposal?.projectedCorporateIncome || 0);
  };

  // Calculate total proposed budget (Income + Subsidy)
  const getAuthoritativeProjectedIncome = () => {
    return Number(selectedProposal?.projectedCorporateIncome ?? calculateProjectedIncome() ?? 0);
  };

  const getAuthoritativeProjectedSubsidy = () => {
    return Number(selectedProposal?.projectedSubsidy ?? selectedProposal?.totalExpenses ?? calculateProjectedSubsidy() ?? 0);
  };

  const getAuthoritativeProposedBudget = () => {
    return Number(selectedProposal?.proposedBudget ?? (getAuthoritativeProjectedIncome() + getAuthoritativeProjectedSubsidy()));
  };

  const calculateTotalBudget = () => {
    return getAuthoritativeProposedBudget();
  };

  // Handle proposal actions
  const handleProposalAction = async () => {
    if (!selectedProposal || !actionType) return;

    const backendAction = mapActionToBackend(actionType);

    // Validate comment for return actions
    if (actionType?.includes("return") && !actionComment.trim()) {
      toast.error("Comment is required when returning a proposal");
      return;
    }

    setActionLoading(true);
    try {
      // Use backend-authoritative subsidy value when available
      const projectedSubsidy = getAuthoritativeProjectedSubsidy();
      
      const payload = {
        action: backendAction,
        comment: actionComment,
        projectedSubsidy, // Include calculated subsidy
      };

      if (backendAction === "submit-to-analyst" && targetAnalystId) {
        payload.targetAnalystId = targetAnalystId;
      }

      const digitalSignature = await createWorkflowDigitalSignature({
        proposal: selectedProposal,
        workflowAction: backendAction,
        comment: actionComment,
        userInfo: currentUser,
        p12File: actionP12File,
        p12Password: actionP12Password
      });

      if (digitalSignature) {
        payload.digitalSignature = digitalSignature;
      }

      await api.post(`${WORKFLOW_API_BASE}/${selectedProposal._id}/action`, payload);

      toast.success("Action completed successfully");
      setActionDialogOpen(false);
      setViewDetailsDialogOpen(false);
      setSelectedProposal(null);
      setActionType("");
      setActionComment("");
      setActionP12File(null);
      setActionP12Password("");
      setAnalystsForProposal([]);
      setTargetAnalystId(null);
      
      await fetchProposals({ forceAllRegions: showAllRegions });
      
      queryClient.invalidateQueries({ queryKey: ["workflowNotifications"] });
    } catch (error) {
      const backendMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        '';

      if (backendMessage) {
        toast.error(String(backendMessage));
      } else {
        handleApiError(error, toast, 'Performing workflow action');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle item amount changes for reviewers
  const handleEditItemAmount = (
    category,
    index,
    newAmount,
    fieldType = null,
    fieldName = null
  ) => {
    if (!canUserEdit()) return;

    setEditableItems((prev) => {
      const updated = { ...prev };
      if (updated[category] && updated[category][index]) {
        if (fieldType === "income" || fieldType === "subsidy") {
          updated[category][index][fieldType] = newAmount;
          // Update the calculated amount/cost field when income or subsidy changes
          const currentIncome =
            fieldType === "income"
              ? newAmount
              : updated[category][index].income || 0;
          const currentSubsidy =
            fieldType === "subsidy"
              ? newAmount
              : updated[category][index].subsidy || 0;
          const totalAmount = currentIncome + currentSubsidy;

          // Update the appropriate amount field based on category
          if ("amount" in updated[category][index]) {
            updated[category][index].amount = totalAmount;
          } else if ("cost" in updated[category][index]) {
            updated[category][index].cost = totalAmount;
          }
        } else if (category === "personnel" && fieldName) {
          // Handle individual personnel field editing
          updated[category][index][fieldName] = newAmount;

          // If monthlySalary or annualSalary changed, update the other one
          if (fieldName === "monthlySalary") {
            updated[category][index].annualSalary = newAmount * 12;
          } else if (fieldName === "annualSalary") {
            updated[category][index].monthlySalary = newAmount / 12;
          }

          // Recalculate Total when any compensation field changes
          const personnel = updated[category][index];
          personnel.Total = (
            (Number(personnel.annualSalary) || 0) +
            (Number(personnel.RATA) || 0) +
            (Number(personnel.PERA) || 0) +
            (Number(personnel.uniformALLOWANCE) || 0) +
            (Number(personnel.productivityIncentive) || 0) +
            (Number(personnel.medical) || 0) +
            (Number(personnel.childrenAllowance) || 0) +
            (Number(personnel.meal) || 0) +
            (Number(personnel.cashGift) || 0) +
            (Number(personnel.subsistenceAllowanceMDS) || 0) +
            (Number(personnel.subsistenceAllowanceST) || 0) +
            (Number(personnel.midyearBonus) || 0) +
            (Number(personnel.yearEndBonus) || 0) +
            (Number(personnel.gsisPremium) || 0) +
            (Number(personnel.philhealthPremium) || 0) +
            (Number(personnel.pagibigPremium) || 0) +
            (Number(personnel.employeeCompensation) || 0) +
            (Number(personnel.loyaltyAward) || 0) +
            (Number(personnel.overtimePay) || 0) +
            (Number(personnel.earnedLeaves) || 0) +
            (Number(personnel.retirementBenefits) || 0) +
            (Number(personnel.terminalLeave) || 0) +
            (Number(personnel.courtAppearance) || 0)
          );
        } else if ("amount" in updated[category][index]) {
          updated[category][index].amount = newAmount;
        } else if ("Total" in updated[category][index]) {
          updated[category][index].Total = newAmount;
        } else if ("cost" in updated[category][index]) {
          updated[category][index].cost = newAmount;
        }
      }
      return updated;
    });

    // Track changed items
    const itemKey = fieldName ? `${category}-${index}-${fieldName}` : `${category}-${index}`;
    const newChangedItems = new Set(changedItems);
    const originalItem = proposalDetails[category]?.[index];

    if (originalItem) {
      let originalValue;
      if (fieldType === "income" || fieldType === "subsidy") {
        // For income/subsidy, compare the actual field value
        originalValue = originalItem[fieldType] ?? 0;
      } else if (category === "personnel" && fieldName) {
        // For personnel fields, compare the specific field
        originalValue = originalItem[fieldName] ?? 0;
      } else {
        // For amount/cost, use the existing logic
        originalValue =
          originalItem.amount ?? originalItem.Total ?? originalItem.cost ?? 0;
      }

      if (originalValue !== newAmount) {
        newChangedItems.add(itemKey);
      } else {
        newChangedItems.delete(itemKey);
      }
    }
    setChangedItems(newChangedItems);
  };

  // Save proposal item changes
  const handleSaveChanges = async () => {
    try {
      if (changedItems.size === 0) {
        toast.info("No changes made");
        return;
      }

      setDetailsLoading(true);

      const changedByCategory = {};
      changedItems.forEach((itemKey) => {
        const [category, index] = itemKey.split("-");
        const idx = parseInt(index);
        if (!changedByCategory[category]) changedByCategory[category] = [];
        changedByCategory[category].push(editableItems[category][idx]);
      });

      const savePromises = [];
      const activeWorkflowRef =
        selectedProposal?._id ||
        (typeof window !== "undefined"
          ? sessionStorage.getItem("activeWorkflowRef") ||
            localStorage.getItem("activeWorkflowRef")
          : null);

      const headerOpt = activeWorkflowRef
        ? { headers: { "X-Workflow-Ref": activeWorkflowRef } }
        : {};
      const injectRef = (arr = []) =>
        arr.map((it) => ({
          ...it,
          proposalId: it.proposalId || activeWorkflowRef,
        }));

      if (changedByCategory.income) {
        savePromises.push(
          api.put(
            "/income/bulk-update",
            { items: injectRef(changedByCategory.income) },
            headerOpt
          )
        );
      }
      if (changedByCategory.personnel) {
        savePromises.push(
          api.put(
            "/api/personnel/bulk-update",
            { items: injectRef(changedByCategory.personnel) },
            headerOpt
          )
        );
      }
      if (changedByCategory.mooe) {
        savePromises.push(
          api.put(
            "/mooe/bulk-update",
            { items: injectRef(changedByCategory.mooe) },
            headerOpt
          )
        );
      }
      if (changedByCategory.capitalOutlay) {
        savePromises.push(
          api.put(
            "/capital-outlay/bulk-update",
            { items: injectRef(changedByCategory.capitalOutlay) },
            headerOpt
          )
        );
      }

      const results = await Promise.all(savePromises);

      toast.success(`Changes saved successfully`);
      setChangedItems(new Set());

      // Calculate the projected subsidy from saved items using subsidy-only values
      let calculatedSubsidy = 0;
      
      // Sum MOOE subsidies (avoid income fields)
      if (changedByCategory.mooe) {
        calculatedSubsidy += changedByCategory.mooe.reduce((sum, item) => sum + (item.subsidy || item.totalSubsidy || 0), 0);
      } else if (proposalDetails?.mooe) {
        calculatedSubsidy += proposalDetails.mooe.reduce((sum, item) => sum + (item.subsidy || item.totalSubsidy || 0), 0);
      }
      
      // Sum Personnel Services subsidy (exclude charged-to-income); if no division, include all
      if (changedByCategory.personnel) {
        const sameDivision = selectedProposal?.division
          ? changedByCategory.personnel.filter((p) => p.division === selectedProposal.division && !p.chargedToIncomeEligible)
          : changedByCategory.personnel.filter((p) => !p.chargedToIncomeEligible);
        calculatedSubsidy += sameDivision.reduce((sum, item) => sum + (item.subsidyAmount || item.subsidy || 0), 0);
      } else if (proposalDetails?.personnel) {
        const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter((p) => p.division === selectedProposal.division && !p.chargedToIncomeEligible)
          : proposalDetails.personnel.filter((p) => !p.chargedToIncomeEligible);
        calculatedSubsidy += sameDivision.reduce((sum, item) => sum + (item.subsidyAmount || item.subsidy || 0), 0);
      }
      
      // Sum Capital Outlay subsidy only (no income)
      if (changedByCategory.capitalOutlay) {
        calculatedSubsidy += changedByCategory.capitalOutlay.reduce((sum, item) => sum + (item.subsidy || item.totalSubsidy || 0), 0);
      } else if (proposalDetails?.capitalOutlay) {
        calculatedSubsidy += proposalDetails.capitalOutlay.reduce((sum, item) => sum + (item.subsidy || item.totalSubsidy || 0), 0);
      }

      // Update the proposal with the calculated subsidy (include __v for optimistic locking)
      try {
        await api.put(
          `/api/allproposal/proposals/${selectedProposal._id}`,
          { projectedSubsidy: calculatedSubsidy, __v: selectedProposal.__v }
        );
      } catch (error) {
        if (error?.response?.status === 409) {
          toast.warning("Proposal was modified by another user. Refreshing...");
          const refreshed = await api.get(`${WORKFLOW_API_BASE}/${selectedProposal._id}`);
          if (refreshed?.data?.proposal) setSelectedProposal(refreshed.data.proposal);
        } else {
          logger.warn("Failed to update projected subsidy", error);
        }
      }

      await fetchProposals({ forceAllRegions: showAllRegions });
      
      queryClient.invalidateQueries({ queryKey: ["workflowNotifications"] });

      const updatedProposalRes = await api.get(
        `${WORKFLOW_API_BASE}/${selectedProposal._id}`
      );
      if (updatedProposalRes.data.proposal) {
        const updatedProposal = updatedProposalRes.data.proposal;
        setSelectedProposal(updatedProposal);

        // Refresh line item details with the updated proposal
        setDetailsLoading(true);
        setDetailsTab("income");
        try {
          const queryParams = {
            proposalId: updatedProposal._id,
            _t: Date.now(),
            ...(updatedProposal.fiscalYear != null && { fiscalYear: String(updatedProposal.fiscalYear) }),
            ...(updatedProposal.budgetType && { budgetType: updatedProposal.budgetType }),
            ...((updatedProposal.division || updatedProposal.responsibilityCenter) && {
              division: updatedProposal.division || updatedProposal.responsibilityCenter,
            }),
          };

          const [incomeRes, personnelRes, mooeRes, capitalRes] =
            await Promise.all([
              api.get("/income/getByParams", { params: queryParams }),
              api.get("/personnel/getByParams", { params: queryParams }),
              api.get("/mooe/getByParams", { params: queryParams }),
              api.get("/capital-outlay/getByParams", { params: queryParams }),
            ]);

          const toArray = (res) => {
            const raw = res?.data;
            if (Array.isArray(raw)) return raw;
            if (raw && Array.isArray(raw.data)) return raw.data;
            return [];
          };

          const details = {
            income: toArray(incomeRes),
            personnel: toArray(personnelRes),
            mooe: toArray(mooeRes),
            capitalOutlay: toArray(capitalRes),
          };

          setProposalDetails(details);
          setEditableItems({
            income: JSON.parse(JSON.stringify(details.income)),
            personnel: JSON.parse(JSON.stringify(details.personnel)),
            mooe: JSON.parse(JSON.stringify(details.mooe)),
            capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay)),
          });
        } catch (error) {
          logger.error("Error refreshing proposal details", error);
        } finally {
          setDetailsLoading(false);
        }
      }
    } catch (_error) {
      // Toast already shown by global api interceptor; no console logging
    } finally {
      setDetailsLoading(false);
    }
  };

  // Helper function to determine the role/position from action or status
  const getRoleFromAction = (entry) => {
    const action = entry.action || "";
    const newStatus = entry.newStatus || entry.toStatus || "";

    // Map based on action
    if (
      action.includes("SUBMIT_TO_REVIEWER") ||
      action.includes("submit-to-reviewer")
    )
      return "BUDGET PREPARER";
    if (
      action.includes("SUBMIT_TO_APPROVER") ||
      action.includes("submit-to-approver")
    )
      return "BUDGET REVIEWER";
    if (
      action.includes("SUBMIT_TO_ANALYST") ||
      action.includes("submit-to-analyst")
    )
      return "BUDGET APPROVER";
    if (
      action.includes("FORWARD_TO_OFFICER") ||
      action.includes("forward-to-officer")
    )
      return "BUDGET PLANNING ANALYST";
    if (
      action.includes("FORWARD_TO_MANAGER") ||
      action.includes("forward-to-manager")
    )
      return "BUDGET OFFICER";
    if (action.includes("FINALIZE") || action.includes("finalize"))
      return "BUDGET MANAGER";
    if (action.includes("RETURN_TO")) return "RETURN ACTION";

    // Map based on new status if action is not clear
    if (newStatus.includes("Reviewer")) return "BUDGET PREPARER";
    if (newStatus.includes("Approver")) return "BUDGET REVIEWER";
    if (newStatus.includes("Analyst") || newStatus.includes("Planning"))
      return "BUDGET APPROVER";
    if (newStatus.includes("Officer")) return "BUDGET PLANNING ANALYST";
    if (newStatus.includes("Manager")) return "BUDGET OFFICER";
    if (newStatus.includes("Finalized")) return "BUDGET MANAGER";

    return action || "-";
  };

  // Get available actions based on user role and proposal status
  // analystsForMenu: optional - when provided and one analyst, shows "Send to [Name] ([id])" for Approver action
  const getAvailableActions = (proposal, analystsForMenu = []) => {
    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;
    const actions = [];

    // VIEW DETAILS (always available)
    actions.push({
      label: "View Details",
      value: "view-details",
      icon: <ViewIcon />,
      color: headerBg,
    });

    // VIEW HISTORY (always available)
    actions.push({
      label: "View History",
      value: "view-history",
      icon: <HistoryIcon />,
      color: headerBg,
    });

    // VIEW AUDIT TRAIL (always available)
    actions.push({
      label: "View Logs",
      value: "view-audit-trail",
      icon: <LogsIcon />,
      color: "#d97706",
    });

    // OPEN NEP PROPOSAL: for BRD-level users when the proposal is at BRD or finalized.
    const brdOrFinalizedStatuses = [
      "FORWARDED_TO_BRD_ANALYST",
      "Forwarded to Budget Planning Analyst",
      "FORWARDED_TO_BRD_OFFICER",
      "Forwarded to Budget Officer",
      "FORWARDED_TO_BRD_MANAGER",
      "Forwarded to Overall Budget Approver",
      "Forwarded to Manager",
      "FINALIZED",
      "Finalized",
    ];
    const isBRDOrFinalized = brdOrFinalizedStatuses.some((s) => String(currentStatus) === s);
    const isBRDStaffForTier = userRoles.some((r) =>
      ["BUDGET_PLANNING_ANALYST", "BUDGET PLANNING ANALYST", "BUDGET_OFFICER", "BUDGET OFFICER", "BUDGET_MANAGER", "BUDGET MANAGER", "SUPER_ADMIN", "SUPER ADMIN"].includes(String(r))
    );
    if (isBRDStaffForTier && isBRDOrFinalized) {
      actions.push({
        label: "Open NEP Proposal",
        value: "open-tier",
        icon: <TableChartIcon />,
        color: headerBg,
      });
    }

    // Check for SUPER_ADMIN
    const isSuperAdmin = userRoles.some((r) => 
      ["SUPER_ADMIN", "SUPER ADMIN"].includes(r)
    );

    // SUPER_ADMIN: Can perform ANY action at ANY step (full workflow control)
    if (isSuperAdmin) {
      const draftStatusVariants = [
        "DRAFT",
        "Draft",
        "draft",
        "Returned to Preparer",
        "RETURNED_TO_PREPARER",
        "Returned",
      ];

      // Super admin can create/submit if in draft
      if (draftStatusVariants.includes(currentStatus)) {
        actions.push({
          label: "Submit to Budget Reviewer",
          value: "submit-to-reviewer",
          icon: <SendIcon />,
          color: "primary",
        });
      }

      // Super admin can review
      if (
        [
          "Forwarded to Reviewer",
          "Returned to Reviewer",
          "FORWARDED_TO_REVIEWER",
          "RETURNED_TO_REVIEWER",
        ].includes(currentStatus)
      ) {
        actions.push(
          {
            label: "Approve & Forward to Budget Approver",
            value: "reviewer-approve-forward-approver",
            icon: <ApproveForwardIcon />,
            color: "primary",
          },
          {
            label: "Return to Budget Preparer",
            value: "reviewer-return",
            icon: <ReturnIcon />,
            color: "warning",
          }
        );
      }

      // Super admin can approve
      if (
        [
          "Forwarded to Approver",
          "Returned to Approver",
          "FORWARDED_TO_APPROVER",
          "RETURNED_TO_APPROVER",
        ].includes(currentStatus)
      ) {
        const analystLabelAdmin = analystsForMenu.length === 1
          ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${analystsForMenu[0]?.userId})`
          : "Approve & Forward to Budget/Planning Analyst";
        actions.push(
          {
            label: analystLabelAdmin,
            value: "approver-approve-forward-analyst",
            icon: <ApproveForwardIcon />,
            color: "primary",
          },
          {
            label: "Return to Budget Reviewer",
            value: "approver-return",
            icon: <ReturnIcon />,
            color: "warning",
          }
        );
      }

      // Super admin can do analyst actions (BRD return → Preparer only)
      if (
        [
          "Forwarded to Budget/Planning Analyst",
          "Returned to Budget/Planning Analyst",
          "Returned",
          "FORWARDED_TO_BRD_ANALYST",
          "RETURNED_TO_PLANNING_ANALYST",
        ].includes(currentStatus)
      ) {
        actions.push(
          {
            label: "Submit to Budget Officer",
            value: "analyst-submit-to-officer",
            icon: <SendIcon />,
            color: "primary",
          },
          {
            label: "Return to Budget Preparer",
            value: "analyst-return",
            icon: <ReturnIcon />,
            color: "warning",
          }
        );
      }

      // Super admin can do officer actions (BRD return → Preparer only)
      if (
        [
          "Forwarded to Budget Officer",
          "Returned to Budget Officer",
          "Returned",
          "FORWARDED_TO_BRD_OFFICER",
          "RETURNED_TO_OFFICER",
        ].includes(currentStatus)
      ) {
        actions.push(
          {
            label: "Submit to Budget Manager",
            value: "officer-submit-to-manager",
            icon: <SendIcon />,
            color: "primary",
          },
          {
            label: "Return to Budget Preparer",
            value: "officer-return",
            icon: <ReturnIcon />,
            color: "warning",
          }
        );
      }

      // Super admin can finalize (BRD return → Preparer only)
      if (
        [
          "Forwarded to Overall Budget Approver",
          "Forwarded to Manager",
          "FORWARDED_TO_BRD_MANAGER",
          "FORWARDED_TO_MANAGER",
        ].includes(currentStatus) ||
        (currentStatus === "Returned" && proposal?.currentAssigneeRole === "BUDGET_MANAGER") ||
        (currentStatus === "RETURNED" && proposal?.currentAssigneeRole === "BUDGET_MANAGER")
      ) {
        actions.push(
          {
            label: "Finalize Proposal",
            value: "manager-approve",
            icon: <ApproveIcon />,
            color: "success",
          },
          {
            label: "Return to Budget Preparer",
            value: "manager-return",
            icon: <ReturnIcon />,
            color: "warning",
          }
        );
      }

      return actions;
    }

    // BUDGET PREPARER actions
    // Note: BUDGET PREPARER can submit ANY Draft proposal, not just their own
    const userName =
      currentUser?.name ||
      `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`.trim();
    
    const currentUserId = currentUser?.id || currentUser?._id || currentUser?.UserId || currentUser?.Id;
    const proposalCreatedById = proposal?.createdBy;
    const proposalProcessById = proposal?.processBy;

    // For BUDGET PREPARER, allow submission of ANY Draft proposal (no ownership check)
    if (
      (userRoles.includes("BUDGET PREPARER") ||
        userRoles.includes("BUDGET_PREPARER"))
    ) {
      const draftStatusVariants = [
        "DRAFT",
        "Draft",
        "draft",
        "Returned to Preparer",
        "RETURNED_TO_PREPARER",
        "Returned",
      ];
      
      if (draftStatusVariants.includes(currentStatus)) {
        actions.push({
          label: "Submit to Budget Reviewer",
          value: "submit-to-reviewer",
          icon: <SendIcon />,
          color: "primary",
        });
      }
    }

    // BUDGET REVIEWER actions (IMO path: Forward to Analyst; RIO/CO path: Forward to Approver)
    if (
      (userRoles.includes("BUDGET REVIEWER") || userRoles.includes("BUDGET_REVIEWER")) &&
      (currentStatus === "Forwarded to Reviewer" ||
        currentStatus === "Returned to Reviewer" ||
        currentStatus === "FORWARDED_TO_REVIEWER" ||
        currentStatus === "RETURNED_TO_REVIEWER")
    ) {
      actions.push(
        {
          label: "Approve & Forward to Budget Approver",
          value: "reviewer-approve-forward-approver",
          icon: <ApproveForwardIcon />,
          color: "primary",
        },
        {
          label: analystsForMenu.length === 1
            ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${analystsForMenu[0]?.userId})`
            : "Forward to Budget/Planning Analyst (IMO path)",
          value: "reviewer-approve-forward-analyst",
          icon: <SendIcon />,
          color: "primary",
        },
        {
          label: "Return to Budget Preparer",
          value: "reviewer-return",
          icon: <ReturnIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET APPROVER actions
    const isApprover = userRoles.includes("BUDGET APPROVER") || userRoles.includes("BUDGET_APPROVER");
    if (isApprover) {
      if (
        currentStatus === "Forwarded to Approver" ||
        currentStatus === "Returned to Approver" ||
        currentStatus === "FORWARDED_TO_APPROVER" ||
        currentStatus === "RETURNED_TO_APPROVER"
      ) {
        const analystLabel = analystsForMenu.length === 1
          ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${analystsForMenu[0]?.userId})`
          : "Approve & Forward to Budget/Planning Analyst";
        actions.push(
          {
            label: analystLabel,
            value: "approver-approve-forward-analyst",
            icon: <ApproveForwardIcon />,
            color: "primary",
          }
        );
        
        if (!proposal.isConsolidated) {
          actions.push({
            label: "Return to Budget Reviewer",
            value: "approver-return",
            icon: <ReturnIcon />,
            color: "warning",
          });
        }
      }

    }

    if (proposal.isConsolidated && (isApprover || isSuperAdmin)) {
      actions.push({
        label: "Un-consolidate Proposal",
        value: "unconsolidate",
        icon: <UnconsolidateIcon />,
        color: "error",
      });
    }

    // BUDGET PLANNING ANALYST actions (BRD: return to Preparer only)
    if (
      (userRoles.includes("BUDGET PLANNING ANALYST") ||
        userRoles.includes("BUDGET_PLANNING_ANALYST")) &&
      (currentStatus === "Forwarded to Budget/Planning Analyst" ||
        currentStatus === "Returned to Budget/Planning Analyst" ||
        currentStatus === "Returned" ||
        currentStatus === "FORWARDED_TO_BRD_ANALYST" ||
        currentStatus === "RETURNED_TO_PLANNING_ANALYST")
    ) {
      actions.push(
        {
          label: "Submit to Budget Officer",
          value: "analyst-submit-to-officer",
          icon: <SendIcon />,
          color: "primary",
        },
        {
          label: "Return to Budget Preparer",
          value: "analyst-return",
          icon: <ReturnIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET OFFICER actions (BRD: return to Preparer only)
    if (
      (userRoles.includes("BUDGET OFFICER") || userRoles.includes("BUDGET_OFFICER")) &&
      (currentStatus === "Forwarded to Budget Officer" ||
        currentStatus === "Returned to Budget Officer" ||
        currentStatus === "Returned" ||
        currentStatus === "FORWARDED_TO_BRD_OFFICER" ||
        currentStatus === "RETURNED_TO_OFFICER")
    ) {
      actions.push(
        {
          label: "Submit to Budget Manager",
          value: "officer-submit-to-manager",
          icon: <SendIcon />,
          color: "primary",
        },
        {
          label: "Return to Budget Preparer",
          value: "officer-return",
          icon: <ReturnIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET MANAGER actions (BRD: return to Preparer only)
    if (
      (userRoles.includes("BUDGET MANAGER") || userRoles.includes("BUDGET_MANAGER") || userRoles.includes("OVERALL_BUDGET_APPROVER") || userRoles.includes("OVERALL BUDGET APPROVER")) &&
      (
        // Allow manager actions when it's forwarded to manager/overall approver
        [
          "Forwarded to Overall Budget Approver",
          "Forwarded to Manager",
          "FORWARDED_TO_BRD_MANAGER",
          "FORWARDED_TO_MANAGER",
        ].includes(currentStatus) ||
        // Allow manager actions if the record is Returned AND the returned-to assignee is the Budget Manager
        (currentStatus === "Returned" && proposal?.currentAssigneeRole === "BUDGET_MANAGER") ||
        (currentStatus === "RETURNED" && proposal?.currentAssigneeRole === "BUDGET_MANAGER")
      )
    ) {
      actions.push(
        {
          label: "Finalize Proposal",
          value: "manager-approve",
          icon: <ApproveIcon />,
          color: "success",
        },
        {
          label: "Return to Budget Preparer",
          value: "manager-return",
          icon: <ReturnIcon />,
          color: "warning",
        }
      );
    }

    return actions;
  };

  // Filter and search proposals
  const statusEnumToDbMap = {
    DRAFT: "Draft",
    FORWARDED_TO_REVIEWER: "Forwarded to Reviewer",
    FORWARDED_TO_APPROVER: "Forwarded to Approver",
    FORWARDED_TO_BRD_ANALYST: "Forwarded to Budget/Planning Analyst",
    FORWARDED_TO_BRD_OFFICER: "Forwarded to Budget Officer",
    FORWARDED_TO_BRD_MANAGER: "Forwarded to Overall Budget Approver",
    FINALIZED: "Finalized",
    RETURNED_TO_PREPARER: "Returned to Preparer",
    RETURNED_TO_REVIEWER: "Returned to Reviewer",
    RETURNED_TO_APPROVER: "Returned to Approver",
    RETURNED_TO_PLANNING_ANALYST: "Returned to Budget/Planning Analyst",
    RETURNED_TO_OFFICER: "Returned to Budget Officer",
    RETURNED: "Returned",
  };

  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      searchQuery === "" ||
      (proposal.responsibilityCenter && proposal.responsibilityCenter.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.division && proposal.division.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.budgetType && proposal.budgetType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.status && proposal.status.toLowerCase().includes(searchQuery.toLowerCase()));

    // Map the filter enum to actual database status and do case-insensitive comparison
    const filterDbStatus = statusEnumToDbMap[filterStatus];
    const matchesFilter =
      filterStatus === "all" || 
      (proposal.status && filterDbStatus && 
        proposal.status.toLowerCase() === filterDbStatus.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  const { topLevelProposals, childrenMap } = useMemo(() => {
    const parentMap = {};
    const childMap = {};
    
    proposals.forEach(p => {
      // 1. If child knows its parent
      if (p.mergedInto) {
        parentMap[String(p._id)] = String(p.mergedInto);
      }
      
      // 2. If parent knows its children
      if (p.isConsolidated && p.mergedFrom) {
        p.mergedFrom.forEach(childId => {
          parentMap[String(childId)] = String(p._id);
        });
      }
    });

    proposals.forEach(p => {
      const parentId = parentMap[String(p._id)];
      if (parentId) {
        if (!childMap[parentId]) childMap[parentId] = [];
        childMap[parentId].push(p);
      }
    });

    const topLevelAdded = new Set();
    const topLevel = [];

    filteredProposals.forEach(p => {
      const pId = String(p._id);
      const parentId = parentMap[pId];
      if (parentId) {
        const parentObj = proposals.find(parent => String(parent._id) === parentId);
        if (parentObj && !topLevelAdded.has(parentId)) {
          topLevel.push(parentObj);
          topLevelAdded.add(parentId);
        } else if (!parentObj && !topLevelAdded.has(pId)) {
          topLevel.push(p);
          topLevelAdded.add(pId);
        }
      } else {
        if (!topLevelAdded.has(pId)) {
          topLevel.push(p);
          topLevelAdded.add(pId);
        }
      }
    });
    
    return { topLevelProposals: topLevel, childrenMap: childMap };
  }, [proposals, filteredProposals]);

  // Render proposal status chip
  const renderStatusChip = (status) => {
    const statusColorMap = {
      DRAFT: { bg: "#ffb74d", text: "#fff" },
      FORWARDED_TO_REVIEWER: { bg: "#42a5f5", text: "#fff" },
      FORWARDED_TO_APPROVER: { bg: "#42a5f5", text: "#fff" },
      FORWARDED_TO_BRD_ANALYST: { bg: "#42a5f5", text: "#fff" },
      FORWARDED_TO_BRD_OFFICER: { bg: "#42a5f5", text: "#fff" },
      FORWARDED_TO_BRD_MANAGER: { bg: "#42a5f5", text: "#fff" },
      FINALIZED: { bg: "#66bb6a", text: "#fff" },
      RETURNED_TO_PREPARER: { bg: "#ef5350", text: "#fff" },
      RETURNED_TO_REVIEWER: { bg: "#ef5350", text: "#fff" },
      RETURNED_TO_APPROVER: { bg: "#ef5350", text: "#fff" },
      RETURNED_TO_PLANNING_ANALYST: { bg: "#ef5350", text: "#fff" },
      RETURNED_TO_OFFICER: { bg: "#ef5350", text: "#fff" },
      MERGED: { bg: "#9e9e9e", text: "#fff" },
    };

    const colors = statusColorMap[status] || { bg: "#999", text: "#fff" };
    const label = WORKFLOW_STATUSES[status]?.label || status;

    return (
      <Chip
        label={label}
        sx={{
          bgcolor: colors.bg,
          color: colors.text,
          fontWeight: "bold",
          fontSize: "0.75rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
        size="small"
      />
    );
  };

  // using shared prettyRole

  // ── Merge proposals: helpers and handler ────────────────────────────────────
  const MERGEABLE_STATUSES = new Set(["FORWARDED_TO_APPROVER", "RETURNED_TO_APPROVER"]);

  const isProposalMergeable = (proposal) =>
    isBudgetApprover &&
    MERGEABLE_STATUSES.has(proposal.status) &&
    !proposal.isMergedSource &&
    !proposal.isConsolidated &&
    proposal.status !== "MERGED";

  const handleToggleMergeSelect = (proposalId) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(proposalId)) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });
  };

  const handleSelectAllMergeable = () => {
    const mergeableIds = topLevelProposals
      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      .filter(isProposalMergeable)
      .map((p) => p._id);
    const allSelected = mergeableIds.every((id) => selectedForMerge.has(id));
    if (allSelected) {
      setSelectedForMerge(new Set());
    } else {
      setSelectedForMerge(new Set(mergeableIds));
    }
  };

  const handleMergeProposals = async () => {
    if (selectedForMerge.size < 2) {
      toast.error("Pumili ng hindi bababa sa 2 proposals para ma-consolidate.");
      return;
    }
    setMergeLoading(true);
    try {
      const response = await api.post(`${WORKFLOW_API_BASE}/merge`, {
        proposalIds: Array.from(selectedForMerge),
      });
      if (response.data?.success) {
        toast.success(response.data.message || "Matagumpay na na-consolidate ang mga proposal.");
        setMergeDialogOpen(false);
        setSelectedForMerge(new Set());
        fetchProposals();
      } else {
        toast.error(response.data?.message || "Hindi ma-consolidate ang mga proposal.");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error sa pag-consolidate ng proposals.";
      toast.error(msg);
    } finally {
      setMergeLoading(false);
    }
  };

  const handleUnconsolidate = async () => {
    setUnconsolidateLoading(true);
    try {
      const response = await api.post(`${WORKFLOW_API_BASE}/${selectedProposal._id}/unconsolidate`);
      if (response.data?.success) {
        toast.success(response.data.message || 'Matagumpay na na-unconsolidate ang proposal.');
        setUnconsolidateDialogOpen(false);
        fetchProposals();
      } else {
        toast.error(response.data?.message || 'Hindi ma-unconsolidate ang proposal.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error sa pag-unconsolidate.');
    } finally {
      setUnconsolidateLoading(false);
    }
  };

  const selectedMergeProposals = filteredProposals.filter((p) => selectedForMerge.has(p._id));
  const totalMergeAmount = selectedMergeProposals.reduce(
    (sum, p) => sum + (Number(p.amount) || Number(p.projectedSubsidy) || 0), 0
  );

  return (
    <Box sx={{ p: 0, bgcolor: "white", minHeight: "100vh" }}>
      {/* Header */}
      <Box sx={{ px: 0, py: 0, mb: 0 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 0,
            background: BRAND_COLORS.darkGreen,
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
              sx={{
                fontWeight: "bold",
                fontSize: "1.8rem",
                letterSpacing: 0.2,
              }}
            >
              Proposal Workflow
            </Typography>
            <Typography
              variant="body1"
              component="h2"
              sx={{ opacity: 0.9, fontSize: "0.9rem", letterSpacing: 0.3 }}
            >
              Manage budget proposals
            </Typography>
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
           
            <TextField
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                    borderColor: BRAND_COLORS.darkGreen,
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
            <Tooltip title="Refresh proposals" arrow>
              <IconButton
                onClick={() => fetchProposals({ forceAllRegions: showAllRegions })}
                sx={{
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.35)",
                    transform: "rotate(180deg)",
                  },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      </Box>


      {/* Tabs and Table Container */}
      <Box sx={{ mx: 2, mt: 2, mb: 0 }}>
        <Paper
          sx={{
            boxShadow: "0 10px 30px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(0, 0, 0, 0.06)",
            transition: "all 0.3s ease",
            bgcolor: "#ffffff",
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
              borderBottom: "none",
              borderTopLeftRadius: "12px",
              borderTopRightRadius: "12px",
            }}
          >
            <Box
              sx={{
                display: "flex",
                bgcolor: "transparent",
                borderRadius: "12px",
                p: 0.5,
                width: "100%",
                maxWidth: 560,
                boxShadow: "none",
                gap: 0.5,
              }}
            >
              {tabs
                .filter((tab) => {
                  // SUPER_ADMIN sees all tabs
                  if (isSuperAdmin) return true;
                  // BRD Users don't see "my-proposals" tab
                  if (tab.value === "my-proposals" && isBRDUser && !isBudgetPreparer) return false;
                  return true;
                })
                .map((tab, index) => {
                  const tabIndex = tabs.findIndex((t) => t.value === tab.value);
                  const isActive = activeTab === tabIndex;
                  
                  // Pick icon based on tab value
                  let TabIcon = FiLayers;
                  if (tab.value === "my-proposals") TabIcon = FiUser;
                  if (tab.value === "monitoring") TabIcon = FiActivity;
                  return (
                    <ButtonBase
                      key={index}
                      onClick={() => handleTabChange(null, tabIndex)}
                      sx={{
                        flex: 1,
                        bgcolor: isActive ? "#ffffff" : "transparent",
                        color: isActive 
                          ? (theme.palette.mode === "dark" ? "#0b2413" : "#2d5016") 
                          : "rgba(255, 255, 255, 0.75)",
                        fontSize: "0.8rem",
                        fontWeight: isActive ? 800 : 600,
                        py: 1,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        boxShadow: isActive ? "0 2px 6px rgba(0, 0, 0, 0.15)" : "none",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                          color: isActive 
                            ? (theme.palette.mode === "dark" ? "#0b2413" : "#2d5016") 
                            : "#ffffff",
                          bgcolor: isActive 
                            ? "#ffffff" 
                            : "rgba(255, 255, 255, 0.08)",
                        },
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "#ffffff",
                          outlineOffset: "2px",
                        }
                      }}
                    >
                      <TabIcon size={14} style={{ opacity: isActive ? 1 : 0.7 }} />
                      {tab.label}
                    </ButtonBase>
                  );
                })}
            </Box>
          </Box>
          {/* Monitoring Metrics Cards - Below Tabs, Auto-Adjusting */}
          {tabs[activeTab].value === "monitoring" && monitoringMetrics && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "stretch", p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'white', flexWrap: "nowrap", borderBottom: "1px solid", borderColor: "divider", justifyContent: "space-between", minHeight: "100px" }}>
              {Object.entries(monitoringMetrics.byStatus || {}).map(([status, count]) => {
                // Normalization: server may return human-readable labels OR enum codes as keys.
                // Normalize both into a stable enum-style key to let the UI map to icons & labels consistently.
                const normalizeStatusKey = (s) => {
                  const mapping = {
                    'Forwarded to Budget/Planning Analyst': 'FORWARDED_TO_BRD_ANALYST',
                    'Forwarded to Budget Officer': 'FORWARDED_TO_BRD_OFFICER',
                    'Forwarded to Overall Budget Approver': 'FORWARDED_TO_BRD_MANAGER',
                    'Returned to Budget/Planning Analyst': 'RETURNED_TO_PLANNING_ANALYST',
                    'Returned to Budget Officer': 'RETURNED_TO_OFFICER',
                    'Finalized': 'FINALIZED',
                    'Draft': 'DRAFT',
                    'Forwarded to Reviewer': 'FORWARDED_TO_REVIEWER',
                    'Forwarded to Approver': 'FORWARDED_TO_APPROVER',
                    'Returned to Preparer': 'RETURNED_TO_PREPARER',
                    'Returned to Reviewer': 'RETURNED_TO_REVIEWER',
                    'Returned to Approver': 'RETURNED_TO_APPROVER',
                  };
                  return mapping[s] || s;
                };
                const normalized = normalizeStatusKey(status);
                const statusLabels = {
                  'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Analyst',
                  'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Officer',
                  'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Manager',
                  'RETURNED_TO_PLANNING_ANALYST': 'Returned to Analyst',
                  'RETURNED_TO_OFFICER': 'Returned to Officer',
                  'FINALIZED': 'Finalized',
                  'FORWARDED_TO_REVIEWER': 'Forwarded to Reviewer',
                  'FORWARDED_TO_APPROVER': 'Forwarded to Approver',
                  'RETURNED_TO_PREPARER': 'Returned to Preparer',
                  'RETURNED_TO_REVIEWER': 'Returned to Reviewer',
                  'RETURNED_TO_APPROVER': 'Returned to Approver',
                  'DRAFT': 'Draft',
                };
                const statusIcons = {
                  'FORWARDED_TO_BRD_ANALYST': '→',
                  'FORWARDED_TO_BRD_OFFICER': '→',
                  'FORWARDED_TO_BRD_MANAGER': '→',
                  'RETURNED_TO_PLANNING_ANALYST': '↩',
                  'RETURNED_TO_OFFICER': '↩',
                  'FINALIZED': '✓',
                  'FORWARDED_TO_REVIEWER': '→',
                  'FORWARDED_TO_APPROVER': '→',
                  'RETURNED_TO_PREPARER': '↩',
                  'RETURNED_TO_REVIEWER': '↩',
                  'RETURNED_TO_APPROVER': '↩',
                  'DRAFT': '✎',
                };
                return (
                  <Box 
                    key={status} 
                    sx={{ 
                      display: "flex", 
                      flexDirection: "column",
                      alignItems: "center", 
                      justifyContent: "center",
                      flex: "1 1 0",
                      minWidth: "0",
                      py: 2,
                      px: 1,
                      bgcolor: "#f8f9fa",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      textAlign: "center",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        bgcolor: "#f0f7f0",
                        boxShadow: "0 2px 8px rgba(45, 80, 22, 0.1)"
                      }
                    }}
                  >
                    <Box sx={{ fontSize: "1.8rem", mb: 0.8, lineHeight: 1 }}>
                      {statusIcons[normalized] || statusIcons[status] || '•'}
                    </Box>
                    <Box sx={{ fontSize: "2rem", fontWeight: 700, color: titleColor, mb: 0.5, lineHeight: 1 }}>
                      {count}
                    </Box>
                    <Typography sx={{ fontSize: "0.7rem", color: theme.palette.mode === 'dark' ? 'text.secondary' : '#555', fontWeight: 500, lineHeight: 1.2, wordWrap: "break-word" }}>
                      {statusLabels[normalized] || statusLabels[status] || status}
                    </Typography>
                  </Box>
                );
              })}
              {/* Total Monitored - Auto Adjusts with Other Cards */}
              <Box 
                sx={{ 
                  display: "flex", 
                  flexDirection: "column",
                  alignItems: "center", 
                  justifyContent: "center",
                  flex: "1 1 0",
                  minWidth: "0",
                  py: 2,
                  px: 1,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : '#f0f8f0',
                  borderRadius: "6px",
                  border: "2px solid",
                  borderColor: titleColor,
                  textAlign: "center",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.25)' : '#e8f5e8',
                    boxShadow: theme.palette.mode === 'dark' ? 'none' : "0 2px 8px rgba(45, 80, 22, 0.15)"
                  }
                }}
              >
                <Box sx={{ fontSize: "1.8rem", mb: 0.8, lineHeight: 1 }}>
                  📊
                </Box>
                <Box sx={{ fontSize: "2rem", fontWeight: 700, color: titleColor, mb: 0.5, lineHeight: 1 }}>
                  {monitoringMetrics.total || 0}
                </Box>
                <Typography sx={{ fontSize: "0.7rem", color: titleColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", lineHeight: 1.2 }}>
                  Total
                </Typography>
              </Box>
            </Box>
          )}
          {/* If monitoringTab is active but there's no metrics or no activity, show a helpful message */}
          {tabs[activeTab].value === "monitoring" && monitoringMetrics && (!monitoringMetrics.total || Object.keys(monitoringMetrics.byStatus || {}).length === 0) && (
            <Box sx={{ p: 3, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <Typography sx={{ color: "#6e6e6e", fontSize: "1rem" }}>
                No monitored proposals — ensure you're signed in as a Budget Manager or SUPER ADMIN and that there are proposals that are not Draft.
              </Typography>
            </Box>
          )}
          {/* If monitoring shows metrics but no proposals in table, show hint + Refresh */}
          {tabs[activeTab].value === "monitoring" && monitoringMetrics && (monitoringMetrics.total > 0) && (!proposals || proposals.length === 0) && (
            <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#6e6e6e', fontSize: '0.95rem' }}>
                May nakitang {monitoringMetrics.total} na naka-monitor na proposal pero hindi ito lumalabas sa table. Siguruhing naka-sign in bilang Budget Manager o SUPER ADMIN at piliin ang tamang region. I-click ang "Refresh" para subukang muli.
              </Typography>
              <Button size='small' variant='outlined' startIcon={<RefreshIcon />} onClick={() => fetchProposals({ forceAllRegions: showAllRegions })}>
                Refresh
              </Button>
            </Box>
          )}

          {/* Search and Filter Bar */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
              p: 2.5,
              bgcolor: "white",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <TextField
              placeholder="Search by center, division, type, or status..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                debouncedSearch(value);
              }}
              size="small"
              sx={{
                flex: 1,
                minWidth: "250px",
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  transition: "all 0.2s ease",
                  "& fieldset": {
                    borderColor: "#e0e0e0",
                  },
                  "&:hover fieldset": {
                    borderColor: "#4CAF50",
                    borderWidth: "2px",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#4CAF50",
                    borderWidth: "2px",
                    boxShadow: "0 0 0 3px rgba(76, 175, 80, 0.1)",
                  },
                },
                "& .MuiInputBase-input::placeholder": {
                  opacity: 0.6,
                },
              }}
              InputProps={{
                startAdornment: (
                  <SearchIcon
                    sx={{ mr: 1.5, color: "#999", fontSize: "1.2rem" }}
                  />
                ),
              }}
            />
            {isBRDStaff && (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel sx={{ "&.Mui-focused": { color: "#4CAF50" } }}>
                  Filter by Status
                </InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Filter by Status"
                  sx={{
                    borderRadius: "8px",
                    transition: "all 0.2s ease",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: "#e0e0e0",
                      },
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: BRAND_COLORS.darkGreen,
                      borderWidth: "2px",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: BRAND_COLORS.darkGreen,
                      borderWidth: "2px",
                      boxShadow: "0 0 0 3px rgba(55, 94, 56, 0.15)",
                    },
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="FORWARDED_TO_REVIEWER">
                    Forwarded to Reviewer
                  </MenuItem>
                  <MenuItem value="FORWARDED_TO_APPROVER">
                    Forwarded to Approver
                  </MenuItem>
                  <MenuItem value="FORWARDED_TO_BRD_ANALYST">
                    Forwarded to Budget Planning Analyst
                  </MenuItem>
                  <MenuItem value="FORWARDED_TO_BRD_OFFICER">
                    Forwarded to Budget Officer
                  </MenuItem>
                  <MenuItem value="FORWARDED_TO_BRD_MANAGER">
                    Forwarded to Overall Budget Approver
                  </MenuItem>
                  <MenuItem value="FINALIZED">Finalized</MenuItem>
                  <MenuItem value="RETURNED_TO_PREPARER">
                    Returned to Preparer
                  </MenuItem>
                  <MenuItem value="RETURNED_TO_REVIEWER">
                    Returned to Reviewer
                  </MenuItem>
                  <MenuItem value="RETURNED_TO_APPROVER">
                    Returned to Approver
                  </MenuItem>
                  <MenuItem value="RETURNED_TO_PLANNING_ANALYST">
                    Returned to Budget Planning Analyst
                  </MenuItem>
                  <MenuItem value="RETURNED_TO_OFFICER">
                    Returned to Budget Officer
                  </MenuItem>
                </Select>
              </FormControl>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                ml: "auto",
                flexWrap: "wrap",
              }}
            >
              {(tabs[activeTab].value === "monitoring" || tabs[activeTab].value === "all-proposals") && (isBudgetManager || isSuperAdmin) && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={showAllRegions}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setShowAllRegions(v);
                        fetchProposals({ forceAllRegions: v });
                      }}
                      color="primary"
                      size="small"
                    />
                  }
                  label="Show all regions"
                />
              )}

              {/* Region badge - show on monitoring and all-proposals for BRD/SUPER ADMIN */}
              {(tabs[activeTab].value === "monitoring" || tabs[activeTab].value === "all-proposals") && (isBudgetManager || isSuperAdmin) ? (
                <Chip
                  label={showAllRegions ? 'Showing: All regions' : `Region: ${resolvedRegionString}`}
                  size="small"
                  sx={{
                    bgcolor: showAllRegions 
                      ? (theme.palette.mode === 'dark' ? 'rgba(3, 83, 136, 0.2)' : '#e7f6ff') 
                      : (theme.palette.mode === 'dark' ? 'rgba(45, 80, 22, 0.2)' : '#f1f8ed'),
                    color: showAllRegions 
                      ? (theme.palette.mode === 'dark' ? '#64b5f6' : '#035388') 
                      : titleColor,
                    fontWeight: 600,
                    ml: 1,
                  }}
                />
              ) : null}

              <Chip
                label={`${topLevelProposals.length} Result${
                  topLevelProposals.length !== 1 ? "s" : ""
                }`}
                sx={{
                  bgcolor: BRAND_COLORS.darkGreen,
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  boxShadow: "0 2px 4px rgba(55, 94, 56, 0.35)",
                }}
                icon={<Box sx={{ color: "white !important" }}>✓</Box>}
              />
            </Box>
            {/* Content (includes Monitoring metrics if active) */}
            {loading ? (
              <Box sx={{ p: 3 }}>
                <TableSkeleton rows={10} columns={6} />
              </Box>
            ) : topLevelProposals.length === 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 6,
                }}
              >
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No proposals found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery || filterStatus !== "all"
                    ? "Try adjusting your search or filters"
                    : "No proposals available"}
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer
                  sx={{ bgcolor: "white", border: "none", borderTop: "none" }}
                >
                  <Table sx={{ borderCollapse: "collapse", width: "100%" }}>
                    <TableHead>
                      <TableRow
                        sx={{
                          background: BRAND_COLORS.darkGreen,
                          position: "relative",
                          borderBottom: "1px solid #1b3a1b",
                        }}
                      >
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          RESPONSIBILITY CENTER
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          FISCAL YEAR
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          BUDGET TYPE
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          DATE
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          PROJECTED INCOME
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          PROJECTED SUBSIDY
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          PROPOSED BUDGET
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                            borderRight: "1px solid rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          STATUS
                        </TableCell>
                        <TableCell
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            p: 2,
                            fontSize: "0.75rem",
                            letterSpacing: "0.8px",
                            textTransform: "uppercase",
                          }}
                        >
                          ACTIONS
                        </TableCell>
                        {/* Consolidate checkbox column header — only for Budget Approver */}
                        {isBudgetApprover && (
                          <TableCell
                            sx={{
                              color: "white",
                              fontWeight: "bold",
                              p: 1,
                              width: 52,
                              textAlign: "center",
                            }}
                          >
                            <Tooltip title="Piliin lahat para sa consolidate">
                              <input
                                type="checkbox"
                                id="consolidate-select-all"
                                style={{ cursor: "pointer", accentColor: "#fff", width: 16, height: 16 }}
                                checked={
                                  topLevelProposals
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .filter(isProposalMergeable).length > 0 &&
                                  topLevelProposals
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .filter(isProposalMergeable)
                                    .every((p) => selectedForMerge.has(p._id))
                                }
                                onChange={handleSelectAllMergeable}
                              />
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topLevelProposals
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((topLevelObj, index) => {
                          const isParent = topLevelObj.isConsolidated && childrenMap[topLevelObj._id]?.length > 0;
                          const isExpanded = expandedConsolidated[topLevelObj._id];
                          const renderRow = (proposal, isChild = false) => (
                          <TableRow
                            key={proposal._id}
                            sx={{
                              bgcolor: "#f9f9f9",
                              borderBottom: "1px solid #e8e8e8",
                              transition:
                                "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                              "&:hover": {
                                bgcolor: "#f0f7ed",
                              },
                              ...(isChild ? { bgcolor: "#fdfdfd", "& > td": { borderBottom: "1px dashed #e8e8e8" } } : {})
                            }}
                          >
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Box display="flex" alignItems="center" gap={1}>
                                {!isChild && isParent && (
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleConsolidated(proposal._id); }}>
                                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                  </IconButton>
                                )}
                                {isChild && (
                                  <span style={{ marginLeft: 24, color: "#888" }}>└</span>
                                )}
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: isChild ? 400 : 600, color: isChild ? "#666" : "#333" }}
                                >
                                  {proposal.responsibilityCenter ||
                                    proposal.division ||
                                    "N/A"}
                                  <div style={{ fontSize: '10px', color: 'red', marginTop: '4px' }}>
                                    ID: {String(proposal._id)}<br/>
                                    mergedInto: {proposal.mergedInto ? String(proposal.mergedInto) : 'none'}<br/>
                                    mergedFrom: {proposal.mergedFrom ? proposal.mergedFrom.length : 'none'}
                                  </div>
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {proposal.fiscalYear}
                              </Typography>
                            </TableCell>
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Chip
                                label={proposal.budgetType?.toUpperCase()}
                                size="small"
                                sx={{
                                  bgcolor: "#012014ff",
                                  color: "white",
                                  fontWeight: "bold",
                                  fontSize: "0.75rem",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                }}
                              />
                            </TableCell>
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ color: "#666" }}
                              >
                                {new Date(
                                  proposal.createdAt
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, color: "#020b15" }}
                              >
                                ₱
                                {(proposal.projectedCorporateIncome || 0).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, color: "#020b15" }}
                              >
                                ₱
                                {getDisplayAmounts(proposal).projectedSubsidy.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: "bold",
                                  color: "#020b15",
                                  fontSize: "0.95rem",
                                }}
                              >
                                ₱
                                {getDisplayAmounts(proposal).proposedBudget.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {renderStatusChip(proposal.status)}
                                {/* Consolidated badge */}
                                {proposal.isConsolidated && (
                                  <Chip
                                    label="CONSOLIDATED"
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#ffb74d', color: '#fff', fontWeight: 700 }}
                                  />
                                )}
                                {/* Consolidate source badge */}
                                {proposal.isMergedSource && (
                                  <Chip
                                    label="CONSOLIDATED (SOURCE)"
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#9e9e9e', color: '#fff', fontWeight: 700 }}
                                  />
                                )}
                                {(/returned/i.test(String(proposal.status || '')) && proposal.currentAssigneeRole) && (
                                  <Chip
                                    label={`Returned to ${prettyRole(proposal.currentAssigneeRole)}`}
                                    size="small"
                                    sx={{ height: 22, fontSize: '0.68rem', bgcolor: '#f6f6f6', color: '#777' }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ p: 2, fontSize: "0.85rem" }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 0.5,
                                  alignItems: "center",
                                }}
                              >
                                {getAvailableActions(proposal).length > 0 && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      endIcon={
                                        <ExpandMoreIcon
                                          sx={{ fontSize: "1.1rem" }}
                                        />
                                      }
                                      sx={{
                                        bgcolor: BRAND_COLORS.darkGreen,
                                        color: "white",
                                        textTransform: "uppercase",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        letterSpacing: "0.5px",
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: "6px",
                                        boxShadow:
                                          "0 2px 4px rgba(55, 94, 56, 0.25)",
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                          bgcolor: "#2b4a2c",
                                          boxShadow:
                                            "0 4px 8px rgba(55, 94, 56, 0.35)",
                                        },
                                      }}
                                      onClick={(e) => {
                                        setSelectedProposal(proposal);
                                        setAvailableActionsForMenu(
                                          getAvailableActions(proposal)
                                        );
                                        setActionMenuAnchor(e.currentTarget);
                                      }}
                                    >
                                      Actions
                                    </Button>
                                    <Menu
                                      anchorEl={actionMenuAnchor}
                                      open={
                                        Boolean(actionMenuAnchor) &&
                                        selectedProposal?._id === proposal._id
                                      }
                                      onClose={() => {
                                        setActionMenuAnchor(null);
                                        setAnalystsForMenuProposal([]);
                                      }}
                                      PaperProps={{
                                        sx: {
                                          mt: 1,
                                          boxShadow:
                                            "0 4px 20px rgba(0,0,0,0.15)",
                                          borderRadius: "8px",
                                          minWidth: 220,
                                        },
                                      }}
                                    >
                                      {availableActionsForMenu.map((action) => {
                                        const isViewOnlyAction = ['view-details', 'view-history', 'view-audit-trail', 'open-tier'].includes(action.value);
                                        return (
                                        <MenuItem
                                          key={action.value}
                                          onClick={async () => {
                                            setActionType(action.value);
                                            setActionMenuAnchor(null);
                                            if (action.value === "view-details") {
                                              await handleViewDetails(proposal);
                                            } else if (action.value === "view-history") {
                                              setSelectedProposal(proposal);
                                              setHistoryPage(0);
                                              setHistoryDialogOpen(true);
                                            } else if (action.value === "view-audit-trail") {
                                              await handleViewAuditTrail(proposal);
                                            } else if (action.value === "open-tier") {
                                              navigate(`/nep-proposal/${proposal._id}`);
                                            } else if (action.value === "unconsolidate") {
                                              setSelectedProposal(proposal);
                                              setUnconsolidateDialogOpen(true);
                                            } else {
                                              // Real-time lock check before allowing any workflow action (submit/return/etc.)
                                              try {
                                                const lockCheck = await api.get(`/proposals/${proposal._id}/lock/status`, { hideErrorToast: true });
                                                const lockData = lockCheck.data;
                                                const myUserId = String(currentUser?.Username || currentUser?.Id || currentUser?.id || '');
                                                if (lockData?.isLocked && lockData?.lockedBy?.userId && String(lockData.lockedBy.userId) !== myUserId) {
                                                  toast.warning(
                                                    `Submission unavailable: This proposal is currently being edited by ${lockData.lockedBy.userName || 'other user'}. Please wait for them to finish.`,
                                                    { autoClose: 6000 }
                                                  );
                                                  return;
                                                }
                                              } catch (_) {
                                                // Lock check failed — proceed anyway (non-blocking)
                                              }
                                              setActionDialogOpen(true);
                                            }
                                          }}
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1.5,
                                            py: 1.5,
                                            px: 2,
                                            color:
                                              action.value === "view-details"
                                                ? titleColor
                                                : "inherit",
                                            fontWeight:
                                              action.value === "view-details"
                                                ? 600
                                                : 500,
                                            fontSize: "0.9rem",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                              bgcolor:
                                                action.color === "warning"
                                                  ? (theme.palette.mode === 'dark' ? 'rgba(245, 124, 0, 0.1)' : '#fff3e0')
                                                  : action.color === "success"
                                                  ? (theme.palette.mode === 'dark' ? 'rgba(56, 142, 60, 0.1)' : '#e8f5e9')
                                                  : (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.1)' : '#f0f7ed'),
                                              transform: "translateX(4px)",
                                            },
                                          }}
                                        >
                                          <Box
                                            sx={{
                                              display: "flex",
                                              alignItems: "center",
                                              color:
                                                action.color === "primary"
                                                  ? titleColor
                                                  : action.color === "warning"
                                                  ? "#f57c00"
                                                  : action.color === "success"
                                                  ? "#388e3c"
                                                  : titleColor,
                                            }}
                                          >
                                            {action.icon}
                                          </Box>
                                          {action.label}
                                        </MenuItem>
                                        );
                                      })}
                                    </Menu>
                                  </>
                                )}
                              </Box>
                            </TableCell>
                            {/* Consolidate checkbox column body — only for Budget Approver */}
                            {isBudgetApprover && (
                              <TableCell sx={{ p: 2, textAlign: "center" }}>
                                {isProposalMergeable(proposal) ? (
                                  <input
                                    type="checkbox"
                                    style={{ cursor: "pointer", width: 16, height: 16, accentColor: titleColor }}
                                    checked={selectedForMerge.has(proposal._id)}
                                    onChange={() => handleToggleMergeSelect(proposal._id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <Tooltip title="Hindi maaaring isama ito sa pag-consolidate (iba ang status o isa na itong consolidated proposal)">
                                    <Box
                                      sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: "3px",
                                        border: "1px solid #ccc",
                                        bgcolor: "#f0f0f0",
                                        display: "inline-block",
                                        cursor: "not-allowed",
                                        opacity: 0.5,
                                        margin: "0 auto"
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                          );
                          
                          return (
                            <React.Fragment key={topLevelObj._id}>
                              {renderRow(topLevelObj, false)}
                              {isExpanded && childrenMap[topLevelObj._id]?.map(child => renderRow(child, true))}
                            </React.Fragment>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 0.75, width: "100%" }}>
                  <TablePagination
                    component="div"
                    count={topLevelProposals.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    labelRowsPerPage="Rows per page:"
                    labelDisplayedRows={({ from, to, count }) =>
                      `${from}-${to} of ${count}`
                    }
                    sx={{
                      width: "100%",
                      backgroundColor: BRAND_COLORS.darkGreen,
                      color: "#fff",
                      borderRadius: "0 0 8px 8px",
                      borderTop: `2px solid ${BRAND_COLORS.darkGreen}`,
                      px: 2,
                      "& .MuiTablePagination-toolbar": {
                        p: 0,
                        minHeight: 36,
                      },
                      "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                        {
                          fontSize: "0.7rem",
                          color: "#fff",
                        },
                      "& .MuiSelect-select": {
                        color: "#fff",
                        fontSize: "0.7rem",
                      },
                      "& .MuiTablePagination-actions .MuiButtonBase-root": {
                        color: "#fff",
                      },
                      "& .MuiTablePagination-selectIcon": { color: "#fff" },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255,255,255,0.4)",
                      },
                      "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#fff",
                      },
                    }}
                  />
                </Box>
              </>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Action Dialog */}
      <Dialog
        open={actionDialogOpen}
        onClose={() => {
          setActionDialogOpen(false);
          setAnalystsForProposal([]);
          setTargetAnalystId(null);
          setActionP12File(null);
          setActionP12Password("");
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: headerBg,
            color: "white",
            fontWeight: "bold",
            fontSize: "1.25rem",
          }}
        >
          Confirm Action
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography
            variant="body1"
            sx={{ mb: 3, color: "#333", lineHeight: 1.6 }}
          >
            {isSubmitToAnalystAction && analystsForProposal.length > 0 ? (
              <>
                Approved and Forward to Central Office BRD
                {analystsForProposal.length > 1 && (
                  <>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                      <InputLabel>Select Analyst</InputLabel>
                      <Select
                        value={targetAnalystId || analystsForProposal[0]?.userId || ""}
                        onChange={(e) => setTargetAnalystId(e.target.value)}
                        label="Select Analyst"
                      >
                        {analystsForProposal.map((a) => (
                          <MenuItem key={a.userId} value={a.userId}>
                            {a.userName} ({a.userId})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                )}
              </>
            ) : (
              "Are you sure you want to perform this action on the proposal?"
            )}
          </Typography>
          <TextField
            fullWidth
            required={actionType?.includes("return")}
            label={
              actionType?.includes("return")
                ? "Comment (Required)"
                : "Comment (Optional)"
            }
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            multiline
            rows={4}
            placeholder={
              actionType?.includes("return")
                ? "Provide feedback for returning the proposal..."
                : "Add any comments or notes for this action..."
            }
            sx={{
              "& .MuiOutlinedInput-root": {
                "&:hover fieldset": {
                  borderColor: "#4a7c2c",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#4a7c2c",
                },
              },
              "& .MuiInputLabel-root.Mui-focused": {
                color: "#4a7c2c",
              },
            }}
          />



          {actionType && actionRequiresDigitalSignature(mapActionToBackend(actionType)) && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning">
                This action requires a digital signature. Signer mode: <strong>{signerMode}</strong>.
              </Alert>

              {signerMode === 'p12' && (
                <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fafafa' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: titleColor }}>
                    Digital Signature (P12 Mode)
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                        Select your .p12 or .pfx certificate file:
                      </Typography>
                      <input
                        type="file"
                        accept=".p12,.pfx"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setActionP12File(file);
                        }}
                        style={{ width: '100%' }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Certificate Password"
                        size="small"
                        value={actionP12Password}
                        onChange={(e) => setActionP12Password(e.target.value)}
                        placeholder="Enter password..."
                        disabled={actionLoading}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => {
              setActionDialogOpen(false);
              setActionP12File(null);
              setActionP12Password("");
            }}
            sx={{
              color: "#666",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProposalAction}
            variant="contained"
            disabled={
              actionLoading ||
              (actionType?.includes("return") && !actionComment.trim()) ||
              (signerMode === 'p12' && actionType && actionRequiresDigitalSignature(mapActionToBackend(actionType)) && (!actionP12File || !actionP12Password))
            }
            sx={{
              bgcolor: headerBg,
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 8px rgba(45,80,22,0.3)',
              "&:hover": {
                bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#4a7c2c',
                boxShadow: theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.6)' : '0 4px 12px rgba(45,80,22,0.4)',
              },
              "&:disabled": {
                bgcolor: "#ccc",
                color: "#666",
              },
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            {actionLoading && <CircularProgress size={20} sx={{ color: "white" }} />}
            {actionLoading ? "Processing..." : "Confirm Action"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsDialogOpen}
        onClose={() => {
          if (changedItems.size > 0) {
            const confirm = window.confirm(
              "You have unsaved changes. Close anyway?"
            );
            if (!confirm) return;
          }
          setViewDetailsDialogOpen(false);
          setChangedItems(new Set());
          // Refresh proposals list to show updated amounts (e.g., proposedBudget after items are added)
          fetchProposals({ forceAllRegions: showAllRegions });
        }}
        maxWidth="lg"
        fullWidth
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: "blur(6px)",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
            }
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            boxShadow: "0 20px 48px rgba(0,0,0,0.16)",
            border: "1px solid rgba(255,255,255,0.08)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: theme.palette.mode === 'dark' ? "linear-gradient(135deg, #0b2413 0%, #1e3d22 100%)" : "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
            background: theme.palette.mode === 'dark' ? "linear-gradient(135deg, #0b2413 0%, #1e3d22 100%)" : "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
            color: "white",
            fontWeight: "bold",
            fontSize: "1.25rem",
            p: 3,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Proposal Details</span>
            {canViewVersionHistory && selectedProposal?._id && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setVersionHistoryOpen(true)}
                sx={{ color: "white", borderColor: "rgba(255,255,255,0.7)", "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" } }}
              >
                Version history
              </Button>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {lockStatus?.isLocked && !hasLock && (
            <Alert severity="warning" sx={{ m: 2 }}>
              This proposal is currently being edited by {lockStatus.lockedBy?.userName || 'another user'} ({lockStatus.lockedBy?.userRole || 'User'}). You can only view the details.
            </Alert>
          )}
          {detailsLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 6,
              }}
            >
              <CircularProgress sx={{ color: titleColor }} size={20} />
            </Box>
          ) : (
            <>
              {/* Proposal Summary Dashboard */}
              <Box
                sx={{
                  p: 4,
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: '0.5px', mb: 0.5 }}
                      >
                        Responsibility Center
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: titleColor, fontSize: '1.05rem' }}>
                        {selectedProposal?.responsibilityCenter ||
                          selectedProposal?.division ||
                          selectedProposal?.department ||
                          proposalDetails?.income?.[0]?.division ||
                          proposalDetails?.income?.[0]?.department ||
                          proposalDetails?.income?.[0]?.responsibilityCenter ||
                          proposalDetails?.personnel?.[0]?.division ||
                          proposalDetails?.personnel?.[0]?.department ||
                          proposalDetails?.mooe?.[0]?.division ||
                          proposalDetails?.mooe?.[0]?.department ||
                          proposalDetails?.capitalOutlay?.[0]?.division ||
                          proposalDetails?.capitalOutlay?.[0]?.department ||
                          proposalDetails?.income?.[0]?.region ||
                          proposalDetails?.personnel?.[0]?.region ||
                          proposalDetails?.mooe?.[0]?.region ||
                          proposalDetails?.capitalOutlay?.[0]?.region ||
                          "N/A"}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: '0.5px', mb: 0.5 }}
                      >
                        Fiscal Year
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a1a' }}>
                        {selectedProposal?.fiscalYear}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: '0.5px', mb: 0.5 }}
                      >
                        Budget Type
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={selectedProposal?.budgetType?.toUpperCase() || selectedProposal?.modelType?.toUpperCase()}
                          size="small"
                          sx={{
                            bgcolor: headerBg,
                            color: "white",
                            fontWeight: "bold",
                            borderRadius: '6px',
                            px: 1,
                          }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  {/* Premium Cards Grid for Metrics */}
                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        bgcolor: "rgba(3, 83, 136, 0.03)",
                        border: "1px solid rgba(3, 83, 136, 0.08)",
                        boxShadow: "0 2px 8px rgba(3, 83, 136, 0.02)",
                        transition: "all 0.2s",
                        "&:hover": { boxShadow: "0 4px 16px rgba(3, 83, 136, 0.06)" }
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "#035388", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}
                      >
                        Projected Corporate Income
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, color: "#035388", mt: 0.5, fontSize: "1.25rem" }}
                      >
                        ₱
                        {getAuthoritativeProjectedIncome().toLocaleString(
                          "en-US",
                          { minimumFractionDigits: 2 }
                        )}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        bgcolor: "rgba(46, 125, 50, 0.03)",
                        border: "1px solid rgba(46, 125, 50, 0.08)",
                        boxShadow: "0 2px 8px rgba(46, 125, 50, 0.02)",
                        transition: "all 0.2s",
                        "&:hover": { boxShadow: "0 4px 16px rgba(46, 125, 50, 0.06)" }
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "#2e7d32", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}
                      >
                        Projected Subsidy
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, color: "#2e7d32", mt: 0.5, fontSize: "1.25rem" }}
                      >
                        ₱
                        {getAuthoritativeProjectedSubsidy().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: "12px",
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(45, 80, 22, 0.04)',
                        border: "1px solid",
                        borderColor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.25)' : 'rgba(45, 80, 22, 0.1)',
                        boxShadow: "0 2px 8px rgba(45, 80, 22, 0.02)",
                        transition: "all 0.2s",
                        "&:hover": { boxShadow: "0 4px 16px rgba(45, 80, 22, 0.07)" }
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: titleColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}
                      >
                        Proposed Budget (Grand Total)
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, color: titleColor, mt: 0.5, fontSize: "1.3rem" }}
                      >
                        ₱
                        {getAuthoritativeProposedBudget().toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>
                  </Grid>
                  {(() => {
                    const st = selectedProposal?.status;
                    const brdOrFinal = [
                      "FORWARDED_TO_BRD_ANALYST", "Forwarded to Budget/Planning Analyst",
                      "FORWARDED_TO_BRD_OFFICER", "Forwarded to Budget Officer",
                      "FORWARDED_TO_BRD_MANAGER", "Forwarded to Overall Budget Approver", "Forwarded to Manager",
                      "FINALIZED", "Finalized",
                    ].some((s) => String(st) === s);
                    const isBRD = currentUser?.Roles?.some((r) =>
                      ["BUDGET_PLANNING_ANALYST", "BUDGET PLANNING ANALYST", "BUDGET_OFFICER", "BUDGET OFFICER", "BUDGET_MANAGER", "BUDGET MANAGER", "SUPER_ADMIN", "SUPER ADMIN"].includes(String(r))
                    );
                    if (!brdOrFinal || !isBRD) return null;
                    return (
                      <Grid item xs={12}>
                        <Alert severity="info" sx={{ mt: 1 }}>
                          Open this NEP proposal to adjust its Income and Subsidy allocation against the approved BRD ceiling.
                          <Button
                            size="small"
                            variant="contained"
                            sx={{ ml: 2, mt: 0.5 }}
                            onClick={() => navigate(`/nep-proposal/${selectedProposal._id}`)}
                          >
                            Open NEP Proposal
                          </Button>
                        </Alert>
                      </Grid>
                    );
                  })()}
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Status
                    </Typography>
                    {renderStatusChip(selectedProposal?.status)}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Created Date
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {selectedProposal?.createdAt
                        ? new Date(
                            selectedProposal.createdAt
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "N/A"}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Inline Proposal Details Edit (Budget Preparer or Super Admin in Draft) */}
                {(() => {
                  if (!selectedProposal) return null;
                  const userRoles = currentUser?.Roles || [];
                  const isPreparer = userRoles.some((r) =>
                    ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(r)
                  );
                  const isSuperAdmin = userRoles.some((r) =>
                    ["SUPER_ADMIN", "SUPER ADMIN"].includes(r)
                  );
                  const draftStatuses = [
                    "DRAFT",
                    "Draft",
                    "Returned to Preparer",
                    "RETURNED_TO_PREPARER",
                  ];
                  // Budget Preparers or Super Admin can edit ANY Draft proposal (no ownership check needed)
                  const canEditMeta =
                    (isPreparer || isSuperAdmin) &&
                    draftStatuses.includes(selectedProposal.status);
                  if (!canEditMeta) return null;
                  return (
                    <Box sx={{ mt: 4, pt: 3, borderTop: "2px dashed #d0d0d0" }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, mb: 2, color: titleColor }}
                      >
                        Edit Proposal Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Title"
                            fullWidth
                            size="small"
                            value={proposalEditValues.title}
                            onChange={(e) => {
                              setProposalEditValues((v) => ({
                                ...v,
                                title: e.target.value,
                              }));
                              setProposalEditDirty(true);
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={12}>
                          <TextField
                            label="Description"
                            fullWidth
                            multiline
                            minRows={2}
                            value={proposalEditValues.description}
                            onChange={(e) => {
                              setProposalEditValues((v) => ({
                                ...v,
                                description: e.target.value,
                              }));
                              setProposalEditDirty(true);
                            }}
                          />
                        </Grid>
                      </Grid>
                      <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!proposalEditDirty}
                          sx={{
                            bgcolor: proposalEditDirty ? headerBg : "text.disabled",
                            "&:hover": {
                              bgcolor: proposalEditDirty
                                ? (theme.palette.mode === 'dark' ? '#14331d' : '#1e3a0f')
                                : "text.disabled",
                            },
                          }}
                          onClick={async () => {
                            try {
                              const payload = {
                                title: proposalEditValues.title,
                                description: proposalEditValues.description,
                                __v: selectedProposal.__v,
                              };
                              const res = await api.put(
                                `/api/allproposal/proposals/${selectedProposal._id}`,
                                payload
                              );
                              const updated = res?.data?.data || res?.data;
                              toast.success("Proposal details updated");
                              setSelectedProposal((prev) =>
                                prev ? { ...prev, ...payload, __v: updated?.__v ?? prev.__v } : prev
                              );
                              queryClient.invalidateQueries({ queryKey: ["workflowProposals"] });
                              setProposalEditDirty(false);
                              queryClient.invalidateQueries({ queryKey: ["workflowNotifications"] });
                            } catch (err) {
                              if (err?.response?.status === 409) {
                                toast.warning("Proposal was modified by another user. Please refresh and try again.");
                                const refreshed = await api.get(`${WORKFLOW_API_BASE}/${selectedProposal._id}`);
                                if (refreshed?.data?.proposal) setSelectedProposal(refreshed.data.proposal);
                              } else {
                                console.error("Error updating proposal details", err);
                                toast.error("Failed to update proposal details");
                              }
                            }
                          }}
                        >
                          Save Details
                        </Button>
                        {proposalEditDirty && (
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => {
                              setProposalEditValues({
                                title: selectedProposal.title || "",
                                description: selectedProposal.description || "",
                              });
                              setProposalEditDirty(false);
                            }}
                          >
                            Reset
                          </Button>
                        )}
                      </Box>
                    </Box>
                  );
                })()}
              </Box>

              {/* Tabs for different sections */}
              {!selectedProposal?.isConsolidated && (
                <>
                  <Tabs
                    value={detailsTab}
                    onChange={(e, newValue) => setDetailsTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      mb: 0.5,
                      borderBottom: "none",
                    }}
                  >
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'income' ? '#43a047' : 'inherit' }}>
                          <FiTrendingUp size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="Income" 
                      value="income" 
                    />
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'ps-permanent' ? headerBg : 'inherit' }}>
                          <FiUserCheck size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="PS-Permanent" 
                      value="ps-permanent" 
                    />
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'ps-casual' ? '#f57c00' : 'inherit' }}>
                          <FiUsers size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="PS-Casual" 
                      value="ps-casual" 
                    />
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'ps-charged' ? '#9c27b0' : 'inherit' }}>
                          <FiCreditCard size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="PS-Charged" 
                      value="ps-charged" 
                    />
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'mooe' ? '#00b0ff' : 'inherit' }}>
                          <FiBriefcase size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="MOOE" 
                      value="mooe" 
                    />
                    <Tab 
                      icon={
                        <Box className="tab-icon-wrapper" sx={{ display: 'flex', alignItems: 'center', transition: 'transform 0.2s', color: detailsTab === 'capital-outlay' ? '#009688' : 'inherit' }}>
                          <FiCpu size={16} />
                        </Box>
                      } 
                      iconPosition="start" 
                      label="Capital Outlay" 
                      value="capital-outlay" 
                    />
                  </Tabs>

              {/* Tab Content */}
              <Box
                sx={{ p: 3, minHeight: 300, maxHeight: 500, overflow: "auto", overflowX: "auto" }}
              >
                {/* Income Tab */}
                {detailsTab === "income" &&
                  (proposalDetails?.income?.length > 0 ? (
                    <>
                      {(() => {
                        const items = proposalDetails.income || [];
                        const discountType = discountSettings?.discountType || "percentage";
                        const discountValue = toNumber(discountSettings?.discountValue || 0);
                        const applyDiscount = Boolean(discountSettings?.applyDiscount);

                        let irrigationGross = 0;
                        let irrigationNet = 0;
                        let currentAccountTotal = 0;

                        items.forEach((item) => {
                          const categoryRaw =
                            item.category ||
                            item.categoryName ||
                            item.type ||
                            item.incomecategory?.name ||
                            item.incomecategory?.incomeCategoryName ||
                            "Uncategorized";
                          const category = normalizeName(categoryRaw);
                          const amount = toNumber(item.amount || 0);
                          const subcategory = normalizeName(
                            item.subcategory || item.subCategory || ""
                          );

                          if (category.includes("net irrigation service fees")) {
                            irrigationNet += amount;
                            return;
                          }
                          if (category.includes("irrigation service fees")) {
                            irrigationGross += amount;
                            if (subcategory.includes("current account")) {
                              currentAccountTotal += amount;
                            }
                          }
                        });

                        let discountAmount = 0;
                        const discountBase =
                          currentAccountTotal > 0 ? currentAccountTotal : irrigationGross;
                        if (applyDiscount && discountValue > 0 && discountBase > 0) {
                          discountAmount =
                            discountType === "percentage"
                              ? discountBase * (discountValue / 100)
                              : Math.min(discountValue, discountBase);
                        }

                        const hasGrossIrrigation = irrigationGross > 0;
                        const useNet = irrigationNet > 0 || (applyDiscount && discountAmount > 0);
                        const irrigationLabel = useNet
                          ? "Net Irrigation Service Fees"
                          : "Irrigation Service Fees";
                        const irrigationTotal = useNet
                          ? (irrigationNet || Math.max(0, irrigationGross - discountAmount))
                          : irrigationGross;

                        const shouldHideNetRow = useNet && hasGrossIrrigation;

                        const groupedIncome = items.reduce((acc, item) => {
                          const rawCategory =
                            item.category ||
                            item.categoryName ||
                            item.type ||
                            item.incomecategory?.name ||
                            item.incomecategory?.incomeCategoryName ||
                            "Uncategorized";
                          const normalized = normalizeName(rawCategory);
                          const isNetRow =
                            normalized.includes("net irrigation service fees") ||
                            Boolean(item.isComputed);
                          if (shouldHideNetRow && isNetRow) {
                            return acc;
                          }
                          const category =
                            normalized.includes("irrigation service fees") && useNet
                              ? irrigationLabel
                              : rawCategory;
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(item);
                          return acc;
                        }, {});

                        const groupedEntries = Object.entries(groupedIncome);
                        const grandTotal = groupedEntries.reduce(
                          (sum, [category, groupItems]) => {
                            const categoryTotal =
                              normalizeName(category).includes("irrigation service fees") && useNet
                                ? irrigationTotal
                                : groupItems.reduce(
                                    (groupSum, item) => groupSum + toNumber(item.amount || 0),
                                    0
                                  );
                            return sum + categoryTotal;
                          },
                          0
                        );

                        return (
                          <>
                            {groupedEntries.map(([category, groupItems]) => {
                              const categoryTotal =
                                normalizeName(category).includes("irrigation service fees") && useNet
                                  ? irrigationTotal
                                  : groupItems.reduce(
                                      (sum, item) => sum + toNumber(item.amount || 0),
                                      0
                                    );
                              const isExpanded =
                                expandedGroups[`income-${category}`];

                              return (
                                <Box key={category} sx={{ mb: 2 }}>
                                <Box
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [`income-${category}`]:
                                        !prev[`income-${category}`],
                                    }))
                                  }
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 2,
                                    bgcolor: headerBg,
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#3d6026' },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )}
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {category} ({groupItems.length}{" "}
                                      {groupItems.length === 1 ? "item" : "items"})
                                    </Typography>
                                  </Box>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    ₱
                                    {categoryTotal.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </Typography>
                                </Box>

                                  {isExpanded && (
                                    <TableContainer sx={{ mt: 1 }}>
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                                            <TableCell
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Item
                                            </TableCell>
                                            {/* <TableCell
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Description
                                            </TableCell> */}
                                            <TableCell
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Category
                                            </TableCell>
                                            <TableCell
                                              align="right"
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Amount
                                            </TableCell>
                                            <TableCell
                                              align="right"
                                              sx={{ fontWeight: "bold" }}
                                            >
                                              Total
                                            </TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {groupItems.map((item, idx) => {
                                            const globalIndex =
                                              proposalDetails.income.indexOf(
                                                item
                                              );
                                            const itemKey = `income-${globalIndex}`;
                                            const isChanged =
                                              changedItems.has(itemKey);
                                            const editedItem =
                                              editableItems.income[globalIndex];
                                            const itemAmount =
                                              editedItem?.amount || 0;
                                            return (
                                              <TableRow
                                                key={idx}
                                                hover
                                                sx={{
                                                  bgcolor: isChanged
                                                    ? "#fff3cd"
                                                    : "transparent",
                                                  transition:
                                                    "background-color 0.3s ease",
                                                }}
                                              >
                                                <TableCell>
                                                  {item.particulars ||
                                                    item.itemName ||
                                                    item.title ||
                                                    "N/A"}
                                                </TableCell>
                                                {/* <TableCell>
                                                  {item.description || "N/A"}
                                                </TableCell> */}
                                                <TableCell>
                                                  {item.categoryName ||
                                                    item.category ||
                                                    item.type ||
                                                    item.subcategory ||
                                                    "N/A"}
                                                </TableCell>
                                                <TableCell align="right">
                                                  {canUserEdit() ? (
                                                    <TextField
                                                      type="text"
                                                      size="small"
                                                      value={itemAmount.toLocaleString(
                                                        "en-US",
                                                        {
                                                          minimumFractionDigits: 2,
                                                          maximumFractionDigits: 2,
                                                        }
                                                      )}
                                                      onKeyDown={preventNegativeNumericKey}
                                                      onChange={(e) => {
                                                        const numValue = toNonNegativeNumber(e.target.value);
                                                        handleEditItemAmount(
                                                          "income",
                                                          globalIndex,
                                                          numValue
                                                        );
                                                      }}
                                                      inputProps={{
                                                        style: {
                                                          textAlign: "right",
                                                        },
                                                      }}
                                                      sx={{
                                                        width: 120,
                                                        "& .MuiOutlinedInput-root":
                                                          {
                                                            bgcolor: isChanged
                                                              ? "#fff9e6"
                                                              : "white",
                                                            borderColor: isChanged
                                                              ? "#ffc107"
                                                              : undefined,
                                                          },
                                                      }}
                                                    />
                                                  ) : (
                                                    `₱${itemAmount.toLocaleString(
                                                      "en-US",
                                                      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                                    )}`
                                                  )}
                                                </TableCell>
                                                <TableCell
                                                  align="right"
                                                  sx={{
                                                    fontWeight: "bold",
                                                    bgcolor: "#f0f0f0",
                                                  }}
                                                >
                                                  ₱
                                                  {itemAmount.toLocaleString(
                                                    "en-US",
                                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                           {normalizeName(category).includes("irrigation service fees") && useNet && discountAmount > 0 && (
                                             <TableRow sx={{ bgcolor: "#fff3f3" }}>
                                               <TableCell sx={{ color: "#d32f2f", fontWeight: "bold", pl: 2 }}>
                                                 Less: {discountType === "percentage" ? `${discountValue}%` : "₱" + discountValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Discount on Current Account
                                               </TableCell>
                                               <TableCell sx={{ color: "#d32f2f", fontWeight: 500 }}>
                                                 ISF Discount
                                               </TableCell>
                                               <TableCell align="right" sx={{ color: "#d32f2f", fontWeight: "bold" }}>
                                                 -₱{discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                               </TableCell>
                                               <TableCell align="right" sx={{ color: "#d32f2f", fontWeight: "bold", bgcolor: "#ffebeb" }}>
                                                 -₱{discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                               </TableCell>
                                             </TableRow>
                                           )}
                                        </TableBody>
                                      </Table>
                                    </TableContainer>
                                  )}
                                </Box>
                              );
                            })}
                            <Box
                              sx={{
                                mt: 3,
                                p: 2,
                                bgcolor: "#f5f5f5",
                                borderRadius: "8px",
                              }}
                            >
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: "bold", color: headerBg }}
                              >
                                Grand Total: ₱
                                {grandTotal.toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Typography>
                            </Box>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="income"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                              <TableCell sx={{ fontWeight: "bold" }}>Item</TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>Category</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Amount</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No income data available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  ))}

                {/* Attachments (Income) - when has data, shown inside tab content above */}
                {detailsTab === "income" && proposalDetails?.income?.length > 0 && (
                  <Box sx={{ mt: 2, mb: 2 }}>
                    <ProposalAttachments
                      proposal={selectedProposal}
                      moduleName="income"
                      userInfo={currentUser}
                      onChange={() => handleViewDetails(selectedProposal)}
                    />
                  </Box>
                )}

                {/* PS-Permanent Tab */}
                {detailsTab === "ps-permanent" && (() => {
                  const permanentPersonnel = proposalDetails?.personnel?.filter(
                    person =>
                      String(person.statusOfAppointment || person.StatusOfAppointment || '').trim().toUpperCase() === 'PERMANENT' &&
                      person.chargedToIncomeEligible !== true
                  ) || [];
                  
                  const grandTotal = permanentPersonnel.reduce((sum, item) => {
                    const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                    const editedItem = originalIndex !== -1 ? editableItems.personnel[originalIndex] : item;
                    return sum + (Number(editedItem?.Total) || Number(editedItem?.total) || Number(item?.Total) || Number(item?.total) || 0);
                  }, 0);
                  
                  const paginatedPermanentPersonnel = permanentPersonnel.slice(
                    permanentPersonnelPage * permanentPersonnelRowsPerPage,
                    permanentPersonnelPage * permanentPersonnelRowsPerPage + permanentPersonnelRowsPerPage
                  );

                  return permanentPersonnel.length > 0 ? (
                    <>
                      {/* Attachments (Personnel) */}
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            {paginatedPermanentPersonnel.map((item, index) => {
                              const globalIndex = permanentPersonnelPage * permanentPersonnelRowsPerPage + index;
                              const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                              const finalIndex = originalIndex !== -1 ? originalIndex : globalIndex;
                              const itemKey = `permanent-${finalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel ? editableItems.personnel[finalIndex] : item;
                              const isExpanded = expandedPersonnel[index];
                              
                              return (
                                <React.Fragment key={index}>
                                  <TableRow
                                    hover
                                    sx={{
                                      cursor: "pointer",
                                      bgcolor: item.subsidyEligible
                                        ? "#fffde7"
                                        : isChanged
                                        ? "#fff3cd"
                                        : "transparent",
                                      transition: "background-color 0.3s ease",
                                    }}
                                  >
                                    <TableCell>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          setExpandedPersonnel((prev) => ({
                                            ...prev,
                                            [index]: !prev[index],
                                          }))
                                        }
                                      >
                                        {isExpanded ? (
                                          <ExpandLessIcon />
                                        ) : (
                                          <ExpandMoreIcon />
                                        )}
                                      </IconButton>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>
                                      {item.employeeFullName || item.EmployeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || item.PositionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || item.SG || item.sg || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || item.Step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || item.JG || item.jg || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {item.noOfDependent || item.NoOfDependent || 0}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.monthlySalary || item.MonthlySalary || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.annualSalary || item.AnnualSalary || (item.monthlySalary || item.MonthlySalary || 0) * 12).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.PERA || item.pera || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onKeyDown={preventNegativeNumericKey}
                                          onChange={(e) => {
                                            const numValue = toNonNegativeNumber(e.target.value);
                                            handleEditItemAmount("personnel", finalIndex, numValue, null, "RATA");
                                          }}
                                          inputProps={{
                                            style: { textAlign: "right" },
                                          }}
                                          sx={{
                                            width: 120,
                                            "& .MuiOutlinedInput-root": {
                                              bgcolor: isChanged ? "#fff9e6" : "white",
                                              borderColor: isChanged ? "#ffc107" : undefined,
                                            },
                                          }}
                                        />
                                      ) : (
                                        `₱${(item.RATA || item.rata || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.subsistenceAllowance || item.SubsistenceAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.uniformALLOWANCE || item.uniformAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.productivityIncentive || item.ProductivityIncentive || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.honoraria || item.Honoraria || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.medical || item.Medical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.additionalMedical || item.AdditionalMedical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.childrenAllowance || item.ChildrenAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.meal || item.Meal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.hazardPay || item.HazardPay || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.cashGift || item.CashGift || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.midyearBonus || item.MidyearBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.yearEndBonus || item.YearEndBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.gsisPremium || item.GsisPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.providentFund || item.ProvidentFund || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.pagibigPremium || item.PagibigPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.philhealthPremium || item.PhilhealthPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.employeeCompensation || item.EmployeeCompensation || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.loyaltyAward || item.LoyaltyAward || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.earnedLeaves || item.EarnedLeaves || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.retirementBenefits || item.RetirementBenefits || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.terminalLeave || item.TerminalLeave || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {`₱${(editedItem?.Total || editedItem?.total || item.Total || item.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={33} sx={{ bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fafafa', p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: titleColor }}>
                                              Employee Information
                                            </Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Item Number</Typography>
                                            <Typography variant="body2">{item.itemNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Employee Number</Typography>
                                            <Typography variant="body2">{item.employeeNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Status</Typography>
                                            <Typography variant="body2">{item.employeeStatus || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Appointment Status</Typography>
                                            <Typography variant="body2">{item.statusOfAppointment || "N/A"}</Typography>
                                          </Grid>
                                        </Grid>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={permanentPersonnel.length}
                        page={permanentPersonnelPage}
                        onPageChange={(e, newPage) => setPermanentPersonnelPage(newPage)}
                        rowsPerPage={permanentPersonnelRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setPermanentPersonnelRowsPerPage(parseInt(e.target.value, 10));
                          setPermanentPersonnelPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                      />
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          bgcolor: "#f5f5f5",
                          borderRadius: "8px",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", color: headerBg }}
                        >
                          Grand Total (PS-Permanent): ₱
                          {grandTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={33} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No permanent personnel services data available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  );
                })()}
                {/* PS-Casual Tab */}
                {detailsTab === "ps-casual" && (() => {
                  const casualPersonnel = proposalDetails?.personnel?.filter(
                    person =>
                      String(person.statusOfAppointment || person.StatusOfAppointment || '').trim().toUpperCase() === 'CASUAL' &&
                      person.chargedToIncomeEligible !== true
                  ) || [];
                  
                  const grandTotal = casualPersonnel.reduce((sum, item) => {
                    const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                    const editedItem = originalIndex !== -1 ? editableItems.personnel[originalIndex] : item;
                    return sum + (Number(editedItem?.Total) || Number(editedItem?.total) || Number(item?.Total) || Number(item?.total) || 0);
                  }, 0);
                  const totalFetched = proposalDetails?.personnel?.length || 0;
                  const permanentCount = proposalDetails?.personnel?.filter(
                    p => String(p.statusOfAppointment || p.StatusOfAppointment || '').trim().toUpperCase() === 'PERMANENT' && p.chargedToIncomeEligible !== true
                  ).length || 0;
                  const casualCount = casualPersonnel.length;
                  const chargedCount = proposalDetails?.personnel?.filter(
                    p => p.chargedToIncomeEligible === true
                  ).length || 0;
                  const otherCount = totalFetched - (permanentCount + casualCount + chargedCount);
                  
                  const paginatedCasualPersonnel = casualPersonnel.slice(
                    casualPersonnelPage * casualPersonnelRowsPerPage,
                    casualPersonnelPage * casualPersonnelRowsPerPage + casualPersonnelRowsPerPage
                  );

                  return casualPersonnel.length > 0 ? (
                    <>
                      {/* Attachments (Personnel) */}
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            {paginatedCasualPersonnel.map((item, index) => {
                              const globalIndex = casualPersonnelPage * casualPersonnelRowsPerPage + index;
                              const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                              const finalIndex = originalIndex !== -1 ? originalIndex : globalIndex;
                              const itemKey = `casual-${finalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel ? editableItems.personnel[finalIndex] : item;
                              const isExpanded = expandedPersonnel[index];
                              
                              return (
                                <React.Fragment key={index}>
                                  <TableRow
                                    hover
                                    sx={{
                                      cursor: "pointer",
                                      bgcolor: item.subsidyEligible
                                        ? "#fffde7"
                                        : isChanged
                                        ? "#fff3cd"
                                        : "transparent",
                                      transition: "background-color 0.3s ease",
                                    }}
                                  >
                                    <TableCell>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          setExpandedPersonnel((prev) => ({
                                            ...prev,
                                            [index]: !prev[index],
                                          }))
                                        }
                                      >
                                        {isExpanded ? (
                                          <ExpandLessIcon />
                                        ) : (
                                          <ExpandMoreIcon />
                                        )}
                                      </IconButton>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>
                                      {item.employeeFullName || item.EmployeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || item.PositionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || item.SG || item.sg || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || item.Step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || item.JG || item.jg || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {item.noOfDependent || item.NoOfDependent || 0}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.monthlySalary || item.MonthlySalary || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.annualSalary || item.AnnualSalary || (item.monthlySalary || item.MonthlySalary || 0) * 12).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.PERA || item.pera || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onKeyDown={preventNegativeNumericKey}
                                          onChange={(e) => {
                                            const numValue = toNonNegativeNumber(e.target.value);
                                            handleEditItemAmount("personnel", finalIndex, numValue, null, "RATA");
                                          }}
                                          inputProps={{
                                            style: { textAlign: "right" },
                                          }}
                                          sx={{
                                            width: 120,
                                            "& .MuiOutlinedInput-root": {
                                              bgcolor: isChanged ? "#fff9e6" : "white",
                                              borderColor: isChanged ? "#ffc107" : undefined,
                                            },
                                          }}
                                        />
                                      ) : (
                                        `₱${(item.RATA || item.rata || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.subsistenceAllowance || item.SubsistenceAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.uniformALLOWANCE || item.uniformAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.productivityIncentive || item.ProductivityIncentive || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.honoraria || item.Honoraria || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.medical || item.Medical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.additionalMedical || item.AdditionalMedical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.childrenAllowance || item.ChildrenAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.meal || item.Meal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.hazardPay || item.HazardPay || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.cashGift || item.CashGift || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.midyearBonus || item.MidyearBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.yearEndBonus || item.YearEndBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.gsisPremium || item.GsisPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.providentFund || item.ProvidentFund || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.pagibigPremium || item.PagibigPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.philhealthPremium || item.PhilhealthPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.employeeCompensation || item.EmployeeCompensation || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.loyaltyAward || item.LoyaltyAward || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.earnedLeaves || item.EarnedLeaves || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.retirementBenefits || item.RetirementBenefits || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.terminalLeave || item.TerminalLeave || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {`₱${(editedItem?.Total || editedItem?.total || item.Total || item.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={33} sx={{ bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fafafa', p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: titleColor }}>
                                              Employee Information
                                            </Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Item Number</Typography>
                                            <Typography variant="body2">{item.itemNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Employee Number</Typography>
                                            <Typography variant="body2">{item.employeeNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Status</Typography>
                                            <Typography variant="body2">{item.employeeStatus || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Appointment Status</Typography>
                                            <Typography variant="body2">{item.statusOfAppointment || "N/A"}</Typography>
                                          </Grid>
                                        </Grid>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={casualPersonnel.length}
                        page={casualPersonnelPage}
                        onPageChange={(e, newPage) => setCasualPersonnelPage(newPage)}
                        rowsPerPage={casualPersonnelRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setCasualPersonnelRowsPerPage(parseInt(e.target.value, 10));
                          setCasualPersonnelPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                      />
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          bgcolor: "#f5f5f5",
                          borderRadius: "8px",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", color: headerBg }}
                        >
                          Grand Total (PS-Casual): ₱
                          {grandTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={33} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No casual personnel services data available
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, fontSize: "0.8rem", fontStyle: "italic" }}>
                                  Diagnostics (Total Match = {totalFetched}: Permanent = {permanentCount}, Casual = {casualCount}, Charged = {chargedCount}, Others = {otherCount})
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  );
                })()}

                {/* PS-Charged to Income Tab */}
                {detailsTab === "ps-charged" && (() => {
                  const chargedToIncomePersonnel = proposalDetails?.personnel?.filter(
                    person => person.chargedToIncomeEligible === true
                  ) || [];
                  
                  const grandTotal = chargedToIncomePersonnel.reduce((sum, item) => {
                    const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                    const editedItem = originalIndex !== -1 ? editableItems.personnel[originalIndex] : item;
                    return sum + (Number(editedItem?.Total) || Number(editedItem?.total) || Number(item?.Total) || Number(item?.total) || 0);
                  }, 0);
                  
                  const paginatedChargedPersonnel = chargedToIncomePersonnel.slice(
                    chargedPersonnelPage * chargedPersonnelRowsPerPage,
                    chargedPersonnelPage * chargedPersonnelRowsPerPage + chargedPersonnelRowsPerPage
                  );

                  return chargedToIncomePersonnel.length > 0 ? (
                    <>
                      {/* Attachments (Personnel - Charged) */}
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            {paginatedChargedPersonnel.map((item, index) => {
                              const globalIndex = chargedPersonnelPage * chargedPersonnelRowsPerPage + index;
                              const originalIndex = editableItems.personnel ? editableItems.personnel.findIndex(p => String(p._id) === String(item._id)) : -1;
                              const finalIndex = originalIndex !== -1 ? originalIndex : globalIndex;
                              const itemKey = `charged-${finalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel ? editableItems.personnel[finalIndex] : item;
                              const isExpanded = expandedPersonnel[index];
                              
                              return (
                                <React.Fragment key={index}>
                                  <TableRow
                                    hover
                                    sx={{
                                      cursor: "pointer",
                                      bgcolor: item.subsidyEligible
                                        ? "#fffde7"
                                        : isChanged
                                        ? "#fff3cd"
                                        : "transparent",
                                      transition: "background-color 0.3s ease",
                                    }}
                                  >
                                    <TableCell>
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          setExpandedPersonnel((prev) => ({
                                            ...prev,
                                            [index]: !prev[index],
                                          }))
                                        }
                                      >
                                        {isExpanded ? (
                                          <ExpandLessIcon />
                                        ) : (
                                          <ExpandMoreIcon />
                                        )}
                                      </IconButton>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>
                                      {item.employeeFullName || item.EmployeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || item.PositionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || item.SG || item.sg || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || item.Step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || item.JG || item.jg || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {item.noOfDependent || item.NoOfDependent || 0}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.monthlySalary || item.MonthlySalary || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.annualSalary || item.AnnualSalary || (item.monthlySalary || item.MonthlySalary || 0) * 12).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.PERA || item.pera || 0).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                      })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onKeyDown={preventNegativeNumericKey}
                                          onChange={(e) => {
                                            const numValue = toNonNegativeNumber(e.target.value);
                                            handleEditItemAmount("personnel", finalIndex, numValue, null, "RATA");
                                          }}
                                          inputProps={{
                                            style: { textAlign: "right" },
                                          }}
                                          sx={{
                                            width: 120,
                                            "& .MuiOutlinedInput-root": {
                                              bgcolor: isChanged ? "#fff9e6" : "white",
                                              borderColor: isChanged ? "#ffc107" : undefined,
                                            },
                                          }}
                                        />
                                      ) : (
                                        `₱${(item.RATA || item.rata || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.subsistenceAllowance || item.SubsistenceAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.uniformALLOWANCE || item.uniformAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.productivityIncentive || item.ProductivityIncentive || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.honoraria || item.Honoraria || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.medical || item.Medical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.additionalMedical || item.AdditionalMedical || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.childrenAllowance || item.ChildrenAllowance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.meal || item.Meal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.hazardPay || item.HazardPay || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.cashGift || item.CashGift || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.midyearBonus || item.MidyearBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.yearEndBonus || item.YearEndBonus || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.gsisPremium || item.GsisPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.providentFund || item.ProvidentFund || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.pagibigPremium || item.PagibigPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.philhealthPremium || item.PhilhealthPremium || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.employeeCompensation || item.EmployeeCompensation || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.loyaltyAward || item.LoyaltyAward || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.earnedLeaves || item.EarnedLeaves || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.retirementBenefits || item.RetirementBenefits || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right">
                                      {`₱${(item.terminalLeave || item.TerminalLeave || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {`₱${(editedItem?.Total || editedItem?.total || item.Total || item.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={33} sx={{ bgcolor: theme.palette.mode === 'dark' ? 'background.default' : '#fafafa', p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: titleColor }}>
                                              Employee Information
                                            </Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Item Number</Typography>
                                            <Typography variant="body2">{item.itemNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Employee Number</Typography>
                                            <Typography variant="body2">{item.employeeNumber || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Status</Typography>
                                            <Typography variant="body2">{item.employeeStatus || "N/A"}</Typography>
                                          </Grid>
                                          <Grid item xs={6} md={3}>
                                            <Typography variant="caption" color="text.secondary">Appointment Status</Typography>
                                            <Typography variant="body2">{item.statusOfAppointment || "N/A"}</Typography>
                                          </Grid>
                                        </Grid>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={chargedToIncomePersonnel.length}
                        page={chargedPersonnelPage}
                        onPageChange={(e, newPage) => setChargedPersonnelPage(newPage)}
                        rowsPerPage={chargedPersonnelRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          setChargedPersonnelRowsPerPage(parseInt(e.target.value, 10));
                          setChargedPersonnelPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                      />
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          bgcolor: "#f5f5f5",
                          borderRadius: "8px",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", color: headerBg }}
                        >
                          Grand Total (PS-Charged to Income): ₱
                          {grandTotal.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="personnel"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER_PS}>
                        <Table size="small" sx={{ minWidth: PS_TABLE_MIN_WIDTH }}>
                          {renderPSTableHead(headerBg)}
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={33} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No personnel services charged to income available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  );
                })()}

                {/* MOOE Tab */}
                {detailsTab === "mooe" &&
                  (proposalDetails?.mooe?.length > 0 ? (
                    <>
                      {/* Attachments (MOOE) - Render ONCE before categories, not inside loop */}
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="mooe"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      {(() => {
                        const groupedMOOE = proposalDetails.mooe.reduce(
                          (acc, item) => {
                            const category =
                              item.sublineItem || "Uncategorized";
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(item);
                            return acc;
                          },
                          {}
                        );

                        return Object.entries(groupedMOOE).map(
                          ([category, items]) => {
                            const isExpanded =
                              expandedGroups[`mooe-${category}`];

                            return (
                              <Box key={category} sx={{ mb: 2 }}>
                                <Box
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [`mooe-${category}`]:
                                        !prev[`mooe-${category}`],
                                    }))
                                  }
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 2,
                                    bgcolor: headerBg,
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#3d6026' },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )}
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {category} ({items.length}{" "}
                                      {items.length === 1 ? "item" : "items"})
                                    </Typography>
                                  </Box>
                                </Box>

                                {isExpanded && (
                                  <TableContainer sx={{ mt: 1 }}>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Subline Item
                                          </TableCell>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Accounting Title
                                          </TableCell>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            UACS Code
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Income
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Subsidy
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Total
                                          </TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {(() => {
                                          const groupedBySubline = items.reduce(
                                            (acc, item) => {
                                              const sublineKey =
                                                item.sublineItem ||
                                                item.sublimeItem ||
                                                "N/A";
                                              if (!acc[sublineKey])
                                                acc[sublineKey] = [];
                                              acc[sublineKey].push(item);
                                              return acc;
                                            },
                                            {}
                                          );

                                          return Object.entries(
                                            groupedBySubline
                                          ).map(
                                            ([sublineKey, sublineItems]) => {
                                              const sublineTotal =
                                                sublineItems.reduce(
                                                  (sum, item) => {
                                                    return (
                                                      sum +
                                                      (item.income || 0) +
                                                      (item.subsidy || 0)
                                                    );
                                                  },
                                                  0
                                                );

                                              return (
                                                <React.Fragment
                                                  key={sublineKey}
                                                >
                                                  {sublineItems.map(
                                                    (item, itemIdx) => {
                                                      const globalIndex =
                                                        proposalDetails.mooe.indexOf(
                                                          item
                                                        );
                                                      const itemKey = `mooe-${globalIndex}`;
                                                      const isChanged =
                                                        changedItems.has(
                                                          itemKey
                                                        );
                                                      const editedItem =
                                                        editableItems.mooe[
                                                          globalIndex
                                                        ];
                                                      const income =
                                                        editedItem?.income ||
                                                        item.income ||
                                                        0;
                                                      const subsidy =
                                                        editedItem?.subsidy ||
                                                        item.subsidy ||
                                                        0;
                                                      const itemTotal =
                                                        income + subsidy;
                                                      return (
                                                        <TableRow
                                                          key={itemIdx}
                                                          hover
                                                          sx={{
                                                            bgcolor: isChanged
                                                              ? "#fff3cd"
                                                              : "transparent",
                                                            transition:
                                                              "background-color 0.3s ease",
                                                          }}
                                                        >
                                                          <TableCell
                                                            sx={{
                                                              fontSize:
                                                                itemIdx === 0
                                                                  ? "0.9rem"
                                                                  : "0.85rem",
                                                              fontWeight:
                                                                itemIdx === 0
                                                                  ? 600
                                                                  : 400,
                                                            }}
                                                          >
                                                            {itemIdx === 0
                                                              ? item.sublineItem ||
                                                                item.sublimeItem ||
                                                                "N/A"
                                                              : ""}
                                                          </TableCell>
                                                          <TableCell>
                                                            {item.accountingTitle ||
                                                              item.particulars ||
                                                              "N/A"}
                                                          </TableCell>
                                                          <TableCell>
                                                            {item.uacsCode ||
                                                              "N/A"}
                                                          </TableCell>
                                                          <TableCell
                                                            align="right"
                                                            sx={{
                                                              minWidth: 120,
                                                            }}
                                                          >
                                                            {canUserEdit() ? (
                                                              <TextField
                                                                type="text"
                                                                size="small"
                                                                value={income.toLocaleString(
                                                                  "en-US",
                                                                  {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                  }
                                                                )}
                                                                onKeyDown={preventNegativeNumericKey}
                                                                onChange={(e) => {
                                                                  const numValue = toNonNegativeNumber(e.target.value);
                                                                  handleEditItemAmount(
                                                                    "mooe",
                                                                    globalIndex,
                                                                    numValue,
                                                                    "income"
                                                                  );
                                                                }}
                                                                inputProps={{
                                                                  style: {
                                                                    textAlign:
                                                                      "right",
                                                                  },
                                                                }}
                                                                sx={{
                                                                  width: "100%",
                                                                  "& .MuiOutlinedInput-root":
                                                                    {
                                                                      bgcolor:
                                                                        isChanged
                                                                          ? "#fff9e6"
                                                                          : "white",
                                                                      borderColor:
                                                                        isChanged
                                                                          ? "#ffc107"
                                                                          : undefined,
                                                                    },
                                                                }}
                                                              />
                                                            ) : (
                                                              `₱${income.toLocaleString(
                                                                "en-US",
                                                                {
                                                                  minimumFractionDigits: 2,
                                                                }
                                                              )}`
                                                            )}
                                                          </TableCell>
                                                          <TableCell
                                                            align="right"
                                                            sx={{
                                                              minWidth: 120,
                                                            }}
                                                          >
                                                            {canUserEdit() ? (
                                                              <TextField
                                                                type="text"
                                                                size="small"
                                                                value={subsidy.toLocaleString(
                                                                  "en-US",
                                                                  {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                  }
                                                                )}
                                                                onKeyDown={preventNegativeNumericKey}
                                                                onChange={(e) => {
                                                                  const numValue = toNonNegativeNumber(e.target.value);
                                                                  handleEditItemAmount(
                                                                    "mooe",
                                                                    globalIndex,
                                                                    numValue,
                                                                    "subsidy"
                                                                  );
                                                                }}
                                                                inputProps={{
                                                                  style: {
                                                                    textAlign:
                                                                      "right",
                                                                  },
                                                                }}
                                                                sx={{
                                                                  width: "100%",
                                                                  "& .MuiOutlinedInput-root":
                                                                    {
                                                                      bgcolor:
                                                                        isChanged
                                                                          ? "#fff9e6"
                                                                          : "white",
                                                                      borderColor:
                                                                        isChanged
                                                                          ? "#ffc107"
                                                                          : undefined,
                                                                    },
                                                                }}
                                                              />
                                                            ) : (
                                                              `₱${subsidy.toLocaleString(
                                                                "en-US",
                                                                {
                                                                  minimumFractionDigits: 2,
                                                                }
                                                              )}`
                                                            )}
                                                          </TableCell>
                                                          <TableCell
                                                            align="right"
                                                            sx={{
                                                              fontWeight:
                                                                "bold",
                                                              bgcolor:
                                                                "#e8f5e9",
                                                              minWidth: 130,
                                                            }}
                                                          >
                                                            ₱
                                                            {itemTotal.toLocaleString(
                                                              "en-US",
                                                              {
                                                                minimumFractionDigits: 2,
                                                              }
                                                            )}
                                                          </TableCell>
                                                        </TableRow>
                                                      );
                                                    }
                                                  )}
                                                  {sublineItems.length > 1 && (
                                                    <TableRow
                                                      sx={{
                                                        bgcolor: "#e8f5e9",
                                                      }}
                                                    >
                                                      <TableCell
                                                        colSpan={3}
                                                        sx={{
                                                          fontWeight: "bold",
                                                          textAlign: "right",
                                                          pr: 2,
                                                        }}
                                                      >
                                                        Subtotal ({sublineKey}):
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          fontWeight: "bold",
                                                          bgcolor: "#c8e6c9",
                                                          minWidth: 120,
                                                        }}
                                                      >
                                                        ₱
                                                        {sublineItems
                                                          .reduce(
                                                            (sum, item) =>
                                                              sum +
                                                              (item.income ||
                                                                0),
                                                            0
                                                          )
                                                          .toLocaleString(
                                                            "en-US",
                                                            {
                                                              minimumFractionDigits: 2,
                                                            }
                                                          )}
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          fontWeight: "bold",
                                                          bgcolor: "#c8e6c9",
                                                          minWidth: 120,
                                                        }}
                                                      >
                                                        ₱
                                                        {sublineItems
                                                          .reduce(
                                                            (sum, item) =>
                                                              sum +
                                                              (item.subsidy ||
                                                                0),
                                                            0
                                                          )
                                                          .toLocaleString(
                                                            "en-US",
                                                            {
                                                              minimumFractionDigits: 2,
                                                            }
                                                          )}
                                                      </TableCell>
                                                      <TableCell
                                                        align="right"
                                                        sx={{
                                                          fontWeight: "bold",
                                                          bgcolor: "#a5d6a7",
                                                          minWidth: 130,
                                                        }}
                                                      >
                                                        ₱
                                                        {(
                                                          sublineItems.reduce(
                                                            (sum, item) =>
                                                              sum +
                                                              (item.income ||
                                                                0),
                                                            0
                                                          ) +
                                                          sublineItems.reduce(
                                                            (sum, item) =>
                                                              sum +
                                                              (item.subsidy ||
                                                                0),
                                                            0
                                                          )
                                                        ).toLocaleString(
                                                          "en-US",
                                                          {
                                                            minimumFractionDigits: 2,
                                                          }
                                                        )}
                                                      </TableCell>
                                                    </TableRow>
                                                  )}
                                                </React.Fragment>
                                              );
                                            }
                                          );
                                        })()}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                )}
                              </Box>
                            );
                          }
                        );
                      })()}
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          bgcolor: "#f5f5f5",
                          borderRadius: "8px",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", color: "#d32f2f" }}
                        >
                          Grand Total: ₱
                          {editableItems.mooe
                            .reduce(
                              (sum, item) =>
                                sum +
                                ((item.income || 0) + (item.subsidy || 0)),
                              0
                            )
                            .toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="mooe"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                              <TableCell sx={{ fontWeight: "bold" }}>Subline Item</TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>Accounting Title</TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>UACS Code</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Income</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Subsidy</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={6} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No MOOE data available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  ))}

                {/* Capital Outlay Tab */}
                {detailsTab === "capital-outlay" &&
                  (proposalDetails?.capitalOutlay?.length > 0 ? (
                    <>
                      {(() => {
                        const groupedCapital =
                          proposalDetails.capitalOutlay.reduce((acc, item) => {
                            let category = "Uncategorized";
                            if (item.categoryName) {
                              category = item.categoryName;
                            } else if (item.category) {
                              if (
                                typeof item.category === "object" &&
                                item.category.categoryName
                              ) {
                                category = item.category.categoryName;
                              } else if (
                                typeof item.category === "object" &&
                                item.category.name
                              ) {
                                category = item.category.name;
                              } else if (
                                typeof item.category === "string" &&
                                item.category.trim() &&
                                item.category.length > 20
                              ) {
                                category =
                                  item.sublineItem ||
                                  item.type ||
                                  item.classification ||
                                  item.categoryTitle ||
                                  "Uncategorized";
                              } else if (
                                typeof item.category === "string" &&
                                item.category.trim()
                              ) {
                                category = item.category;
                              } else {
                                category =
                                  item.type ||
                                  item.classification ||
                                  item.categoryTitle ||
                                  "Uncategorized";
                              }
                            } else {
                              category =
                                item.sublineItem ||
                                item.type ||
                                item.classification ||
                                item.categoryTitle ||
                                "Uncategorized";
                            }
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(item);
                            return acc;
                          }, {});

                        return Object.entries(groupedCapital).map(
                          ([category, items]) => {
                            const isExpanded =
                              expandedGroups[`capital-${category}`];

                            return (
                              <Box key={category} sx={{ mb: 2 }}>
                                {/* Attachments (Capital Outlay) */}
                                <Box sx={{ mb: 1 }}>
                                  <ProposalAttachments
                                    proposal={selectedProposal}
                                    moduleName="capital"
                                    userInfo={currentUser}
                                    onChange={() => handleViewDetails(selectedProposal)}
                                  />
                                </Box>
                                <Box
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [`capital-${category}`]:
                                        !prev[`capital-${category}`],
                                    }))
                                  }
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 2,
                                    bgcolor: headerBg,
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#3d6026' },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ExpandLessIcon />
                                    ) : (
                                      <ExpandMoreIcon />
                                    )}
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ fontWeight: 600 }}
                                    >
                                      {category} ({items.length}{" "}
                                      {items.length === 1 ? "item" : "items"})
                                    </Typography>
                                  </Box>
                                </Box>

                                {isExpanded && (
                                  <TableContainer sx={{ mt: 1 }}>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Subline Item
                                          </TableCell>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Accounting Title
                                          </TableCell>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            UACS Code
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Income
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Subsidy
                                          </TableCell>
                                          <TableCell
                                            align="right"
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Total
                                          </TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {items.map((item, idx) => {
                                          const globalIndex =
                                            proposalDetails.capitalOutlay.indexOf(
                                              item
                                            );
                                          const itemKey = `capitalOutlay-${globalIndex}`;
                                          const isChanged =
                                            changedItems.has(itemKey);
                                          const editedItem =
                                            editableItems.capitalOutlay[
                                              globalIndex
                                            ];
                                          const income =
                                            editedItem?.income ||
                                            item.income ||
                                            0;
                                          const subsidy =
                                            editedItem?.subsidy ||
                                            item.subsidy ||
                                            0;
                                          const itemTotal = income + subsidy;
                                          return (
                                            <TableRow
                                              key={idx}
                                              hover
                                              sx={{
                                                bgcolor: isChanged
                                                  ? "#fff3cd"
                                                  : "transparent",
                                                transition:
                                                  "background-color 0.3s ease",
                                              }}
                                            >
                                              <TableCell>
                                                {item.sublineItem ||
                                                  item.sublimeItem ||
                                                  "N/A"}
                                              </TableCell>
                                              <TableCell>
                                                {item.accountingTitle ||
                                                  item.particulars ||
                                                  "N/A"}
                                              </TableCell>
                                              <TableCell>
                                                {displayUacs(item.uacsCode, item.sublineItem)}
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={{ minWidth: 130 }}
                                              >
                                                {canUserEdit() ? (
                                                  <TextField
                                                    type="text"
                                                    size="small"
                                                    value={income.toLocaleString(
                                                      "en-US",
                                                      {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                      }
                                                    )}
                                                    onKeyDown={preventNegativeNumericKey}
                                                    onChange={(e) => {
                                                      const numValue = toNonNegativeNumber(e.target.value);
                                                      handleEditItemAmount(
                                                        "capitalOutlay",
                                                        globalIndex,
                                                        numValue,
                                                        "income"
                                                      );
                                                    }}
                                                    inputProps={{
                                                      style: {
                                                        textAlign: "right",
                                                      },
                                                    }}
                                                    sx={{
                                                      width: "100%",
                                                      "& .MuiOutlinedInput-root":
                                                        {
                                                          bgcolor: isChanged
                                                            ? "#fff9e6"
                                                            : "white",
                                                          borderColor: isChanged
                                                            ? "#ffc107"
                                                            : undefined,
                                                        },
                                                    }}
                                                  />
                                                ) : (
                                                  <Box
                                                    sx={{
                                                      textAlign: "right",
                                                      p: 0.5,
                                                    }}
                                                  >
                                                    ₱
                                                    {income.toLocaleString(
                                                      "en-US",
                                                      {
                                                        minimumFractionDigits: 2,
                                                      }
                                                    )}
                                                  </Box>
                                                )}
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={{ minWidth: 120 }}
                                              >
                                                {canUserEdit() ? (
                                                  <TextField
                                                    type="text"
                                                    size="small"
                                                    value={subsidy.toLocaleString(
                                                      "en-US",
                                                      {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                      }
                                                    )}
                                                    onKeyDown={preventNegativeNumericKey}
                                                    onChange={(e) => {
                                                      const numValue = toNonNegativeNumber(e.target.value);
                                                      handleEditItemAmount(
                                                        "capitalOutlay",
                                                        globalIndex,
                                                        numValue,
                                                        "subsidy"
                                                      );
                                                    }}
                                                    inputProps={{
                                                      style: {
                                                        textAlign: "right",
                                                      },
                                                    }}
                                                    sx={{
                                                      width: "100%",
                                                      "& .MuiOutlinedInput-root":
                                                        {
                                                          bgcolor: isChanged
                                                            ? "#fff9e6"
                                                            : "white",
                                                          borderColor: isChanged
                                                            ? "#ffc107"
                                                            : undefined,
                                                        },
                                                    }}
                                                  />
                                                ) : (
                                                  `₱${subsidy.toLocaleString(
                                                    "en-US",
                                                    { minimumFractionDigits: 2 }
                                                  )}`
                                                )}
                                              </TableCell>
                                              <TableCell
                                                align="right"
                                                sx={{
                                                  fontWeight: "bold",
                                                  bgcolor: "#e8f5e9",
                                                  minWidth: 130,
                                                }}
                                              >
                                                ₱
                                                {itemTotal.toLocaleString(
                                                  "en-US",
                                                  { minimumFractionDigits: 2 }
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                )}
                              </Box>
                            );
                          }
                        );
                      })()}
                      <Box
                        sx={{
                          mt: 3,
                          p: 2,
                          bgcolor: "#f5f5f5",
                          borderRadius: "8px",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: "bold", color: "#d32f2f" }}
                        >
                          Grand Total: ₱
                          {editableItems.capitalOutlay
                            .reduce(
                              (sum, item) =>
                                sum + (item.cost || item.amount || 0),
                              0
                            )
                            .toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box sx={{ mb: 2 }}>
                        <ProposalAttachments
                          proposal={selectedProposal}
                          moduleName="capital"
                          userInfo={currentUser}
                          onChange={() => handleViewDetails(selectedProposal)}
                        />
                      </Box>
                      <TableContainer sx={TABLE_CONTAINER}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                              <TableCell sx={{ fontWeight: "bold" }}>Subline Item</TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>Accounting Title</TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>UACS Code</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Income</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Subsidy</TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={6} align="center" sx={{ py: 5, borderBottom: "none", bgcolor: "grey.50" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.9rem" }}>
                                  No capital outlay data available
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  ))}
              </Box>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: "1px solid #e0e0e0", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            {canUserEdit() && changedItems.size > 0 && (
              <>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: headerBg,
                    "&:hover": { bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#1e3a0f' },
                  }}
                  onClick={handleSaveChanges}
                >
                  Save Changes ({changedItems.size})
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditableItems({
                      income: JSON.parse(
                        JSON.stringify(proposalDetails.income || [])
                      ),
                      personnel: JSON.parse(
                        JSON.stringify(proposalDetails.personnel || [])
                      ),
                      mooe: JSON.parse(
                        JSON.stringify(proposalDetails.mooe || [])
                      ),
                      capitalOutlay: JSON.parse(
                        JSON.stringify(proposalDetails.capitalOutlay || [])
                      ),
                    });
                    setChangedItems(new Set());
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </Box>
          <Button
            onClick={() => {
              if (changedItems.size > 0) {
                const confirm = window.confirm(
                  "You have unsaved changes. Close anyway?"
                );
                if (!confirm) return;
              }
              setViewDetailsDialogOpen(false);
              setChangedItems(new Set());
            }}
            variant="contained"
            sx={{
              bgcolor: headerBg,
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              "&:hover": {
                bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#4a7c2c',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <ProposalVersionHistoryDialog
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        proposalId={selectedProposal?._id ? String(selectedProposal._id) : undefined}
      />

      {/* Proposal History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: headerBg,
            color: "white",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            fontSize: "1.1rem",
            py: 2.5,
            px: 3,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              bgcolor: "rgba(255,255,255,0.2)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ExpandMoreIcon sx={{ fontSize: "1.2rem" }} />
          </Box>
          Proposal History
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedProposal?.workflowHistory &&
          selectedProposal.workflowHistory.length > 0 ? (
            <>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        PROCESSOR NAME
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        POSITION
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        OLD STATUS
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        NEW STATUS
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        REMARK
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        DATE
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        TIME
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                        }}
                      >
                        TIER VERSION
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "#333",
                          fontSize: "0.85rem",
                          letterSpacing: "0.5px",
                          minWidth: 260,
                        }}
                      >
                        SIGNATURE
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedProposal.workflowHistory
                      .slice(
                        historyPage * historyRowsPerPage,
                        (historyPage + 1) * historyRowsPerPage
                      )
                      .map((entry, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            "&:nth-of-type(odd)": { bgcolor: "#f9f9f9" },
                            "&:hover": { bgcolor: "#f0f7ed" },
                            transition: "background-color 0.2s ease",
                          }}
                        >
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#333" }}
                          >
                            {entry.performedByName || entry.userName || "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}
                          >
                            {entry.position || getRoleFromAction(entry)}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}
                          >
                            {entry.fromStatus || entry.previousStatus || "-"}
                          </TableCell>
                          <TableCell
                            sx={{
                              py: 1.5,
                              fontSize: "0.85rem",
                              color: "#333",
                              fontWeight: 500,
                            }}
                          >
                            {entry.toStatus || entry.newStatus || "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#555" }}
                          >
                            {entry.comment || "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}
                          >
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )
                              : "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}
                          >
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  }
                                )
                              : "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#333" }}
                          >
                            {typeof entry.tierVersion === "number" && entry.tierVersion > 0
                              ? `v${entry.tierVersion}`
                              : "—"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.8rem", color: "#333" }}>
                            {entry.digitalSignature ? (
                              <Box>
                                {(() => {
                                  const verification = getSignatureVerificationState(entry);
                                  return (
                                    <Tooltip title={verification.reason}>
                                      <Chip
                                        size="small"
                                        color={verification.color}
                                        label={verification.label}
                                        sx={{ mb: 0.75, mr: 0.75, fontWeight: 600 }}
                                      />
                                    </Tooltip>
                                  );
                                })()}
                                <Chip
                                  size="small"
                                  color="success"
                                  label={entry.digitalSignature.signatureAlgorithm || "Signed"}
                                  sx={{ mb: 0.75, fontWeight: 600 }}
                                />
                                <Typography variant="caption" display="block" sx={{ color: "#555" }}>
                                  {entry.digitalSignature.signedAt
                                    ? `Signed: ${new Date(entry.digitalSignature.signedAt).toLocaleString("en-US")}`
                                    : "Signed"}
                                </Typography>
                                {entry.digitalSignature.certificateFingerprint256 && (
                                  <Tooltip title={entry.digitalSignature.certificateFingerprint256}>
                                    <Typography variant="caption" display="block" sx={{ color: "#777" }}>
                                      FP: {String(entry.digitalSignature.certificateFingerprint256).slice(0, 20)}...
                                    </Typography>
                                  </Tooltip>
                                )}
                              </Box>
                            ) : entry.eSignature ? (
                              <Box>
                                {(() => {
                                  const verification = getSignatureVerificationState(entry);
                                  return (
                                    <Tooltip title={verification.reason}>
                                      <Chip
                                        size="small"
                                        color={verification.color}
                                        label={verification.label}
                                        sx={{ mb: 0.75, mr: 0.75, fontWeight: 600 }}
                                      />
                                    </Tooltip>
                                  );
                                })()}
                                <Chip
                                  size="small"
                                  color="primary"
                                  label="E-signature"
                                  sx={{ mb: 0.75, fontWeight: 600 }}
                                />
                                <Typography variant="caption" display="block" sx={{ color: "#555" }}>
                                  {entry.eSignature.signedAt
                                    ? `Signed: ${new Date(entry.eSignature.signedAt).toLocaleString("en-US")}`
                                    : "Signed"}
                                </Typography>
                                {entry.eSignature.signerName && (
                                  <Typography variant="caption" display="block" sx={{ color: "#777" }}>
                                    By: {entry.eSignature.signerName}
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Tooltip title={getSignatureVerificationState(entry).reason}>
                                <Chip size="small" variant="outlined" label="Not signed" />
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#fafafa",
                  borderTop: "1px solid #e0e0e0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "#666", fontWeight: 500 }}
                  >
                    Rows per page:
                  </Typography>
                  <Select
                    value={historyRowsPerPage}
                    onChange={(e) => {
                      setHistoryRowsPerPage(e.target.value);
                      setHistoryPage(0);
                    }}
                    size="small"
                    sx={{ width: 70 }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                  </Select>
                </Box>
                <Typography variant="body2" sx={{ color: "#666" }}>
                  {selectedProposal.workflowHistory.length > 0
                    ? `${historyPage * historyRowsPerPage + 1}–${Math.min(
                        (historyPage + 1) * historyRowsPerPage,
                        selectedProposal.workflowHistory.length
                      )} of ${selectedProposal.workflowHistory.length}`
                    : "0 of 0"}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                    disabled={historyPage === 0}
                  >
                    <Box sx={{ transform: "rotate(90deg)" }}>‹</Box>
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setHistoryPage(historyPage + 1)}
                    disabled={
                      (historyPage + 1) * historyRowsPerPage >=
                      selectedProposal.workflowHistory.length
                    }
                  >
                    <Box sx={{ transform: "rotate(-90deg)" }}>›</Box>
                  </IconButton>
                </Box>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 6,
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No history available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This proposal has no workflow history yet
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: "1px solid #e0e0e0" }}>
          <Button
            onClick={() => setHistoryDialogOpen(false)}
            variant="contained"
            sx={{
              bgcolor: headerBg,
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              "&:hover": {
                bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#4a7c2c',
              },
            }}
          >
            Back
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audit Trail Dialog */}
      <Dialog
        open={auditTrailDialogOpen}
        onClose={() => setAuditTrailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: headerBg,
            color: "white",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            fontSize: "1.1rem",
            py: 2.5,
            px: 3,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              bgcolor: "rgba(255,255,255,0.15)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ExpandMoreIcon sx={{ fontSize: "1.2rem" }} />
          </Box>
          Change Log
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: "#f8fafb" }}>
          {auditTrailLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 6,
              }}
            >
              <CircularProgress />
            </Box>
          ) : auditTrailData && auditTrailData.length > 0 ? (
            <Box sx={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f5f5f5",
                      borderBottom: "2px solid #ddd",
                    }}
                  >
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      Date/Time
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      User
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      Proposal Type
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      Category
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        borderRight: "1px solid #ddd",
                      }}
                    >
                      Field Changed
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      Old Value → New Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrailData.map((change, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #e0e0e0",
                        backgroundColor:
                          index % 2 === 0 ? "#ffffff" : "#fafafa",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          borderRight: "1px solid #ddd",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(change.timestamp).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          borderRight: "1px solid #ddd",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {change.performedBy || "System"}
                        </div>
                        {/* <div style={{ color: "#666" }}>
                          {change.role?.replace(/_/g, " ") || "N/A"}
                        </div> */}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          borderRight: "1px solid #ddd",
                        }}
                      >
                        {change.proposalType || "-"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          borderRight: "1px solid #ddd",
                        }}
                      >
                        {change.actionType?.replace(/([A-Z])/g, " $1").trim() ||
                          "-"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          borderRight: "1px solid #ddd",
                        }}
                      >
                        {change.changedFields && change.changedFields.length > 0
                          ? change.changedFields.join(", ")
                          : "-"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          fontSize: "0.75rem",
                          maxWidth: "200px",
                        }}
                      >
                        {change.details && change.details.length > 0 ? (
                          <div>
                            {change.details.map((detail, i) => (
                              <div key={i} style={{ marginBottom: "4px" }}>
                                <span style={{ color: "#d32f2f" }}>
                                  {detail.oldValue != null
                                    ? Number(detail.oldValue)
                                        .toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                        .substring(0, 20)
                                    : "-"}
                                </span>

                                {" → "}
                                <span style={{ color: "#388e3c" }}>
                                  {detail.newValue != null
                                    ? Number(detail.newValue)
                                        .toLocaleString(undefined, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })
                                        .substring(0, 20)
                                    : "-"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          ) : (
            <Box sx={{ textAlign: "center", p: 4 }}>
              <Typography sx={{ color: "#666" }}>
                No changes recorded
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{ p: 3, borderTop: "1px solid #e0e0e0", bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#f9fafb' }}
        >
          <Button
            onClick={() => setAuditTrailDialogOpen(false)}
            variant="contained"
            sx={{
              bgcolor: headerBg,
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              py: 1.2,
              borderRadius: "6px",
              "&:hover": {
                bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#1e3a0f',
                boxShadow: theme.palette.mode === 'dark' ? 'none' : "0 4px 12px rgba(45, 80, 22, 0.2)",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Consolidate Proposals floating toolbar ──────────────────────────────────── */}
      {isBudgetApprover && selectedForMerge.size > 0 && (
        <Box
          sx={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1400,
            bgcolor: "#1b3a1b",
            color: "#fff",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            minWidth: 340,
            animation: "slideUp 0.25s ease",
            "@keyframes slideUp": {
              from: { opacity: 0, transform: "translateX(-50%) translateY(20px)" },
              to: { opacity: 1, transform: "translateX(-50%) translateY(0)" },
            },
          }}
        >
          <Box sx={{ fontSize: "1.4rem" }}>🔗</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
              {selectedForMerge.size} proposals selected
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", opacity: 0.8 }}>
              Piliin ang "Consolidate" para pagsamahin bilang isang consolidated proposal
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSelectedForMerge(new Set())}
            sx={{
              color: "#fff",
              borderColor: "rgba(255,255,255,0.4)",
              textTransform: "none",
              fontSize: "0.8rem",
              "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            Alisin
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => setMergeDialogOpen(true)}
            disabled={selectedForMerge.size < 2}
            sx={{
              bgcolor: "#4caf50",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              fontSize: "0.85rem",
              px: 2.5,
              "&:hover": { bgcolor: "#388e3c" },
            }}
          >
            🔗 Consolidate Selected ({selectedForMerge.size})
          </Button>
        </Box>
      )}

      {/* ── Consolidate Confirmation Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={mergeDialogOpen}
        onClose={() => !mergeLoading && setMergeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: "12px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#1b3a1b",
            color: "#fff",
            fontWeight: 700,
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          🔗 I-consolidate ang mga Proposal
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Typography variant="body2" sx={{ color: "#555", mb: 2 }}>
            Ang mga sumusunod na proposals ay pagsasamahin sa isang{" "}
            <strong>Consolidated Proposal</strong>. Ang mga ito ay
            mai-archive (status: MERGED) at hindi na mababago nang
            individual pagkatapos ng merge.
          </Typography>

          {selectedMergeProposals.map((p, i) => (
            <Box
              key={p._id}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                px: 2,
                py: 1.2,
                mb: 1,
                bgcolor: i % 2 === 0 ? "#f8f9fa" : "#fff",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box>
                <Typography
                  sx={{ fontWeight: 600, fontSize: "0.88rem", color: "text.primary" }}
                >
                  {p.responsibilityCenter || p.division || p.title || "Untitled"}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {p.department && `${p.department} · `}FY{p.fiscalYear} ·{" "}
                  {p.budgetType || p.modelType}
                </Typography>
              </Box>
              <Typography
                sx={{ fontWeight: 700, fontSize: "0.9rem", color: titleColor, whiteSpace: "nowrap", ml: 1 }}
              >
                ₱
                {(
                  Number(p.amount) ||
                  Number(p.projectedSubsidy) ||
                  0
                ).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Box>
          ))}

          <Box
            sx={{
              mt: 2,
              px: 2,
              py: 1.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : '#e8f5e9',
              borderRadius: "8px",
              border: "2px solid",
              borderColor: "success.main",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography sx={{ fontWeight: 700, color: titleColor }}>
              Kabuuang Halaga ng Consolidated Proposal:
            </Typography>
            <Typography sx={{ fontWeight: 800, color: titleColor, fontSize: "1.05rem" }}>
              ₱
              {totalMergeAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
          </Box>

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: "#fff8e1",
              borderRadius: "8px",
              border: "1px solid #ffc107",
            }}
          >
            <Typography sx={{ fontSize: "0.8rem", color: "#795548" }}>
              ⚠️ <strong>Paalala:</strong> Ang consolidated na proposals ay
              mananatili sa listahan pero <strong>locked at CONSOLIDATED</strong>{" "}
              na ang status — hindi na sila maaaring i-submit nang
              hiwalay. Ang bagong Consolidated Proposal ay maaari mong
              i-submit sa BRD Planning Analyst.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ p: 2.5, borderTop: "1px solid #e0e0e0", gap: 1 }}
        >
          <Button
            onClick={() => setMergeDialogOpen(false)}
            disabled={mergeLoading}
            sx={{
              color: "#666",
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Kanselahin
          </Button>
          <Button
            variant="contained"
            onClick={handleMergeProposals}
            disabled={mergeLoading || selectedForMerge.size < 2}
            startIcon={mergeLoading ? null : <span>🔗</span>}
            sx={{
              bgcolor: headerBg,
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              px: 3,
              "&:hover": { bgcolor: theme.palette.mode === 'dark' ? '#14331d' : '#1b3a1b' },
            }}
          >
            {mergeLoading
              ? "Kino-consolidate..."
              : `Kumpirmahin ang Consolidation (${selectedForMerge.size})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Un-consolidate Confirmation Dialog */}
      <Dialog
        open={unconsolidateDialogOpen}
        onClose={() => !unconsolidateLoading && setUnconsolidateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "12px" },
        }}
      >
        <DialogTitle sx={{ bgcolor: "#fdf3f2", color: "#c62828", fontWeight: 700, display: "flex", alignItems: "center", gap: 1.5 }}>
          <UnconsolidateIcon />
          Kumpirmahin ang Paghihiwalay (Un-consolidate)
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 4 }}>
          <Typography sx={{ mb: 2, fontSize: "0.95rem" }}>
            Sigurado ka ba na gusto mong i-<strong>unconsolidate</strong> ang proposal na ito?
          </Typography>
          <Box sx={{ bgcolor: "#fff4e5", p: 2, borderRadius: "8px", border: "1px solid #ffcc80" }}>
            <Typography sx={{ fontSize: "0.85rem", color: "#ed6c02", fontWeight: 600, mb: 0.5 }}>
              Ano ang mangyayari?
            </Typography>
            <Typography sx={{ fontSize: "0.8rem", color: "#666" }}>
              Made-delete ang consolidated proposal na ito, at ang lahat ng original na pinagsamang proposals ay babalik nang hiwa-hiwalay sa iyong inbox (Forwarded to Approver) upang maaari mo silang i-review at aksyunan isa-isa.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: "1px solid #e0e0e0", gap: 1 }}>
          <Button
            onClick={() => setUnconsolidateDialogOpen(false)}
            disabled={unconsolidateLoading}
            sx={{ color: "#666", textTransform: "none", fontWeight: 600 }}
          >
            Kanselahin
          </Button>
          <Button
            variant="contained"
            onClick={handleUnconsolidate}
            disabled={unconsolidateLoading}
            sx={{
              bgcolor: "#d32f2f",
              color: "#fff",
              fontWeight: 700,
              textTransform: "none",
              px: 3,
              "&:hover": { bgcolor: "#c62828" },
            }}
          >
            {unconsolidateLoading ? "Inaayos..." : "Oo, I-unconsolidate"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewProposalWorkflowPage;
