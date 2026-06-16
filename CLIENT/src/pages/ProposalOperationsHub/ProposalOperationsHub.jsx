import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
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
  Menu,
  MenuItem,
  Select,
  TextField,
  InputAdornment,
  ButtonBase,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Send as SendIcon,
  ThumbDown as RejectIcon,
  ThumbUp as ApproveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import HistoryIcon from "@mui/icons-material/History";
import { FiLayers, FiUser, FiActivity } from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../../context/UserContext";
import { useRegion } from "../../context/RegionContext";
import api from "../../config/api";
import { toast } from "react-toastify";
import { useWorkflowRef } from "../../hooks/useWorkflowRef";
import { prettyRole } from "../../utils/role-utils";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import logger from "../../utils/logger";
import { handleApiError } from "../../utils/errorHandler";
import { useDebouncedCallback } from "../../hooks/useDebounce";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import { useProposalLock } from "../../hooks/useProposalLock";
import { WORKFLOW_STATUS_UI_METADATA } from "../../constants/workflowConstants";

// Standing custom hooks created in Step 1
import { useProposalCalculations } from "./hooks/useProposalCalculations";
import { useProposalPermissions } from "./hooks/useProposalPermissions";

// Extracted UI dialogs from Step 2 - Lazily loaded for bundle efficiency
const ActionConfirmDialog = React.lazy(() => import("./components/dialogs/ActionConfirmDialog"));
const AuditTrailDialog = React.lazy(() => import("./components/dialogs/AuditTrailDialog"));
const ConsolidateDialog = React.lazy(() => import("./components/dialogs/ConsolidateDialog"));
const ProposalDetailsDialog = React.lazy(() => import("./components/dialogs/ProposalDetailsDialog"));
import ProposalVersionHistoryDialog from "../../components/myproposal/ProposalVersionHistoryDialog";

// Brand colors
const BRAND_COLORS = {
  darkGreen: "#375e38",
  deepGreen: "#2d5016",
};

const TABLE_HEADER_ROW = {
  bgcolor: BRAND_COLORS.deepGreen,
  "& .MuiTableCell-root": {
    color: "white",
    fontWeight: 600,
    fontSize: "0.8125rem",
    py: 1.25,
    borderBottom: "none",
  },
};

const TABLE_CONTAINER = {
  borderRadius: 2,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "divider",
};

const BASE_TABS = [
  { label: "All Proposals", value: "all-proposals" },
  { label: "My Proposals", value: "my-proposals" },
  { label: "Pending Review", value: "pending-review" },
];

const WORKFLOW_API_BASE = "/api/allproposal/proposals";

const ProposalOperationsHub = () => {
  const theme = useTheme();
  const headerBg = theme.palette.mode === "dark" ? "#0b2413" : "#2d5016";
  const titleColor = theme.palette.mode === "dark" ? "#a5d6a7" : "#2d5016";
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [searchParams] = useSearchParams();
  const { setWorkflowRef } = useWorkflowRef();
  const queryClient = useQueryClient();
  const signerMode =
    String(import.meta.env.VITE_PNPKI_SIGNER_MODE || "").toLowerCase() || "disabled";

  // Init calculations & permissions hooks
  const {
    calculateProjectedSubsidy,
    calculateProjectedIncome,
    getAuthoritativeProjectedIncome,
    getAuthoritativeProjectedSubsidy,
    getAuthoritativeProposedBudget,
    getDisplayAmounts,
    getOtherCompensation,
    getGovernmentShare,
  } = useProposalCalculations();

  const {
    isBRDUser,
    isBRDStaff,
    isBudgetManager,
    isSuperAdmin,
    isBudgetPreparer,
    isBudgetApprover,
    isBudgetReviewer,
    canViewVersionHistory,
    canUserEdit: checkCanUserEdit,
    canUserEditProposal,
    getAvailableActions: fetchAvailableActions,
  } = useProposalPermissions();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const hasInitializedDefaultTabRef = useRef(false);

  const tabs = useMemo(() => {
    return isBudgetManager || isSuperAdmin
      ? [...BASE_TABS, { label: "Monitoring", value: "monitoring" }]
      : BASE_TABS;
  }, [isBudgetManager, isSuperAdmin]);

  const [targetProposalId, setTargetProposalId] = useState(null);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
  const [auditTrailData, setAuditTrailData] = useState([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const [expandedRows, setExpandedRows] = useState({});
  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  const toggleConsolidated = toggleRow;
  const [actionType, setActionType] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [actionP12File, setActionP12File] = useState(null);
  const [actionP12Password, setActionP12Password] = useState("");
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [availableActionsForMenu, setAvailableActionsForMenu] = useState([]);
  const [proposalDetails, setProposalDetails] = useState(null);

  // Merge proposals state
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
  const [actionLoading, setActionLoading] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [analystsForProposal, setAnalystsForProposal] = useState([]);
  const [targetAnalystId, setTargetAnalystId] = useState(null);
  const [analystsForMenuProposal, setAnalystsForMenuProposal] = useState([]);

  // Proposal Lock Management
  const lockOptions = useMemo(() => ({ autoRenew: true, showNotifications: true }), []);
  const { lockStatus, acquireLock, releaseLock, hasLock } = useProposalLock(
    selectedProposal?._id,
    lockOptions
  );

  // SUPER ADMIN defaults to show all regions
  useEffect(() => {
    if (isSuperAdmin) setShowAllRegions(true);
  }, [isSuperAdmin]);

  // Edit mode tracking for reviewers
  const [editableItems, setEditableItems] = useState({
    income: [],
    personnel: [],
    mooe: [],
    capitalOutlay: [],
  });
  const [changedItems, setChangedItems] = useState(new Set());

  // Inline proposal metadata edits
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

  // Fetch regional discount settings
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
      const region =
        regionRaw && typeof regionRaw === "object"
          ? regionRaw.RegionName ||
            regionRaw.Region ||
            regionRaw.regionName ||
            regionRaw.region ||
            regionRaw.name ||
            ""
          : String(regionRaw || "");
      if (!fiscalYear || !budgetType || !region) {
        setDiscountSettings(null);
        return;
      }
      try {
        const response = await api.get("/api/discount-settings", {
          params: { fiscalYear, budgetType, region },
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
    proposalDetails?.income,
  ]);

  // Fetch analysts for dynamic "Send to" actions
  useEffect(() => {
    if (!actionMenuAnchor || !selectedProposal?._id) {
      setAnalystsForMenuProposal([]);
      return;
    }
    setAnalystsForMenuProposal([]);
    const atApproverStep = [
      "Forwarded to Approver",
      "Returned to Approver",
      "FORWARDED_TO_APPROVER",
      "RETURNED_TO_APPROVER",
    ].includes(selectedProposal?.status);
    const atReviewerStep = [
      "Forwarded to Reviewer",
      "Returned to Reviewer",
      "FORWARDED_TO_REVIEWER",
      "RETURNED_TO_REVIEWER",
    ].includes(selectedProposal?.status);

    if (!(atApproverStep && isBudgetApprover) && !(atReviewerStep && isBudgetReviewer)) {
      setAnalystsForMenuProposal([]);
      return;
    }
    let cancelled = false;
    api
      .get(`${WORKFLOW_API_BASE}/${selectedProposal._id}/analysts-for-proposal`)
      .then((res) => {
        if (!cancelled) setAnalystsForMenuProposal(res?.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setAnalystsForMenuProposal([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    actionMenuAnchor,
    selectedProposal?._id,
    selectedProposal?.status,
    isBudgetApprover,
    isBudgetReviewer,
  ]);

  // Update actions menu
  useEffect(() => {
    if (actionMenuAnchor && selectedProposal) {
      setAvailableActionsForMenu(
        fetchAvailableActions(selectedProposal, analystsForMenuProposal, headerBg)
      );
    }
  }, [analystsForMenuProposal, actionMenuAnchor, selectedProposal, fetchAvailableActions, headerBg]);

  // Fetch analysts for target assignment dialog
  const isSubmitToAnalystAction = [
    "approver-approve-forward-analyst",
    "reviewer-approve-forward-analyst",
    "approver-approve-forward-officer",
  ].includes(actionType);

  useEffect(() => {
    if (!actionDialogOpen || !isSubmitToAnalystAction || !selectedProposal?._id) {
      setAnalystsForProposal([]);
      setTargetAnalystId(null);
      return;
    }
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await api.get(
          `${WORKFLOW_API_BASE}/${selectedProposal._id}/analysts-for-proposal`
        );
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
    return () => {
      cancelled = true;
    };
  }, [actionDialogOpen, isSubmitToAnalystAction, selectedProposal?._id]);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const resolvedRegion =
    activeRegion && typeof activeRegion === "object"
      ? activeRegion._id ||
        activeRegion.id ||
        activeRegion.Region ||
        activeRegion.regionName ||
        activeRegion.name
      : activeRegion;

  const activeTabView = tabs[activeTab]?.value || "all-proposals";

  // Tanstack React Query proposals fetcher
  const {
    data: proposalsData,
    isLoading: proposalsLoading,
    refetch: refetchProposals,
  } = useQuery({
    queryKey: ["workflowProposals", activeTabView, showAllRegions ? null : resolvedRegion],
    queryFn: async () => {
      const params = {
        region: showAllRegions ? undefined : resolvedRegion,
        view: activeTabView,
      };
      const response = await api.get(WORKFLOW_API_BASE, { params });
      return response.data;
    },
    staleTime: 5000,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const proposals = proposalsData?.proposals || [];
  const loading = proposalsLoading;

  const fetchProposals = useCallback(
    async (options = {}) => {
      refetchProposals();
    },
    [refetchProposals]
  );

  const debouncedSearch = useDebouncedCallback((query) => {
    if (query !== searchQuery) {
      fetchProposals({ forceAllRegions: showAllRegions });
    }
  }, 300);

  const keyboardShortcuts = useMemo(() => ({
    "ctrl+k": (e) => {
      e.preventDefault();
      const searchInput = document.querySelector('input[placeholder*="Search"]');
      if (searchInput) searchInput.focus();
    },
    "ctrl+r": (e) => {
      e.preventDefault();
      fetchProposals({ forceAllRegions: showAllRegions });
    },
  }), [fetchProposals, showAllRegions]);

  useKeyboardShortcuts(keyboardShortcuts);

  // Sync notifications and cache
  useEffect(() => {
    if (activeTabView === "monitoring") return;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        (event.type === "removed" || event.type === "updated") &&
        (event.query.queryKey?.[0] === "proposals" ||
          event.query.queryKey?.[0] === "allProposals" ||
          event.query.queryKey?.[0] === "personnelServices")
      ) {
        refetchProposals();
      }
    });
    return unsubscribe;
  }, [queryClient, refetchProposals, activeTabView]);

  // Deep-linking handle
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const proposalIdParam = searchParams.get("proposalId");

    if (tabParam) {
      const tabIndex = tabs.findIndex((tab) => tab.value === tabParam);
      if (tabIndex !== -1) {
        setActiveTab(tabIndex);
        hasInitializedDefaultTabRef.current = true;
      }
    }

    if (proposalIdParam) {
      setTargetProposalId(proposalIdParam);
    }
  }, [searchParams, tabs]);

  useEffect(() => {
    if (hasInitializedDefaultTabRef.current) return;
    const tabParam = searchParams.get("tab");
    if (tabParam) return;

    const preferredTabValue = isBudgetPreparer ? "my-proposals" : "all-proposals";
    const preferredIndex = tabs.findIndex((tab) => tab.value === preferredTabValue);

    if (preferredIndex !== -1) {
      setActiveTab(preferredIndex);
      hasInitializedDefaultTabRef.current = true;
    }
  }, [searchParams, tabs, isBudgetPreparer]);

  // Deep link select auto-loader
  useEffect(() => {
    if (targetProposalId && proposals.length > 0) {
      const proposal = proposals.find((p) => p._id === targetProposalId);
      if (proposal) {
        setSelectedProposal(proposal);
        setViewDetailsDialogOpen(true);
        setTargetProposalId(null);
      }
    }
  }, [proposals, targetProposalId]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const canUserEdit = () => {
    return checkCanUserEdit(selectedProposal, lockStatus, hasLock);
  };

  // Acquire locks on view details load
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
  }, [viewDetailsDialogOpen, selectedProposal, acquireLock, releaseLock, hasLock, canUserEditProposal]);

  const mapActionToBackend = (frontendAction) => {
    const actionMapping = {
      "submit-to-reviewer": "submit-to-reviewer",
      "reviewer-approve-forward-approver": "submit-to-approver",
      "reviewer-approve-forward-analyst": "submit-to-analyst",
      "reviewer-return": "return-to-preparer",
      "reviewer-save-edits": "reviewer-save-edits",
      "approver-approve-forward-analyst": "submit-to-analyst",
      "approver-approve-forward-officer": "submit-to-analyst",
      "approver-return": "return-to-reviewer",
      "approver-save-edits": "approver-save-edits",
      "analyst-submit-to-officer": "forward-to-officer",
      "analyst-return": "return-to-preparer",
      "analyst-save-edits": "analyst-save-edits",
      "officer-approve": "forward-to-manager",
      "officer-return": "return-to-preparer",
      "officer-save-edits": "officer-save-edits",
      "officer-submit-to-manager": "forward-to-manager",
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

  // View Details fetcher
  const handleViewDetails = async (proposal) => {
    setDetailsLoading(true);
    setViewDetailsDialogOpen(true);
    setSelectedProposal(proposal);
    if (proposal?._id) {
      setWorkflowRef(proposal._id);
    }
    setDetailsTab("income");
    setChangedItems(new Set());

    try {
      const queryParams = {
        proposalId: proposal._id,
        _t: Date.now(),
        ...(proposal.fiscalYear != null && { fiscalYear: String(proposal.fiscalYear) }),
        budgetType: proposal.budgetType || proposal.modelType || "",
        region:
          proposal.regionName ||
          (proposal.region && typeof proposal.region === "object"
            ? proposal.region.Region || proposal.region.RegionName || proposal.region.region
            : proposal.region) ||
          "",
        ...((proposal.division || proposal.responsibilityCenter) && {
          division: proposal.division || proposal.responsibilityCenter,
        }),
      };

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

      setProposalDetails(details);

      try {
        const [proposalRes, totalsRes] = await Promise.all([
          api.get(`/api/allproposal/proposals/${proposal._id}`),
          api
            .get(`/api/allproposal/proposals/${proposal._id}/totals`, { hideErrorToast: true })
            .catch(() => null),
        ]);

        const proposalData = proposalRes.data?.data || proposalRes.data;
        const totalsData = totalsRes?.data?.data || null;

        if (proposalData) {
          setSelectedProposal({
            ...proposalData,
            ...(totalsData
              ? {
                  projectedSubsidy: totalsData.projectedSubsidy,
                  projectedCorporateIncome: totalsData.projectedCorporateIncome,
                  proposedBudget: totalsData.proposedBudget,
                  totalIncome: totalsData.totalIncome,
                  totalExpenses: totalsData.totalExpenses,
                }
              : {}),
          });
        }
      } catch (err) {
        logger.warn("Failed to fetch full proposal details for attachments", err);
      }

      setEditableItems({
        income: JSON.parse(JSON.stringify(details.income)),
        personnel: JSON.parse(JSON.stringify(details.personnel)),
        mooe: JSON.parse(JSON.stringify(details.mooe)),
        capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay)),
      });

      // Update inline forms
      setProposalEditValues({
        title: proposal.title || "",
        description: proposal.description || "",
      });
      setProposalEditDirty(false);
    } catch (error) {
      handleApiError(error, toast, "Loading proposal details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // View Audit Trail fetcher
  const handleViewAuditTrail = async (proposal) => {
    setAuditTrailLoading(true);
    setSelectedProposal(proposal);

    try {
      const response = await api.get(`${WORKFLOW_API_BASE}/${proposal._id}/audit-trail`);

      if (response.data.success) {
        const changes = response.data.data.changes || [];
        setAuditTrailData(changes);
        if (changes.length === 0) {
          toast.info("No changes recorded for this proposal yet");
        }
        setAuditTrailDialogOpen(true);
      } else {
        toast.error("Failed to fetch audit trail");
      }
    } catch (error) {
      handleApiError(error, toast, "Loading audit trail");
    } finally {
      setAuditTrailLoading(false);
    }
  };

  // Post proposal actions handler
  const handleProposalAction = async () => {
    if (!selectedProposal || !actionType) return;

    const backendAction = mapActionToBackend(actionType);

    if (actionType?.includes("return") && !actionComment.trim()) {
      toast.error("Comment is required when returning a proposal");
      return;
    }

    setActionLoading(true);
    try {
      const projectedSubsidy = getAuthoritativeProjectedSubsidy(
        selectedProposal,
        proposalDetails
      );

      const payload = {
        action: backendAction,
        comment: actionComment,
        projectedSubsidy,
      };

      if (backendAction === "submit-to-analyst" && targetAnalystId) {
        payload.targetAnalystId = targetAnalystId;
      }

      const { createWorkflowDigitalSignature } = await import(
        "../../utils/digitalSignature"
      );
      const digitalSignature = await createWorkflowDigitalSignature({
        proposal: selectedProposal,
        workflowAction: backendAction,
        comment: actionComment,
        userInfo: currentUser,
        p12File: actionP12File,
        p12Password: actionP12Password,
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
        error?.response?.data?.message || error?.response?.data?.error || "";
      if (backendMessage) {
        toast.error(String(backendMessage));
      } else {
        handleApiError(error, toast, "Performing workflow action");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Edit item handler
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
          const currentIncome =
            fieldType === "income" ? newAmount : updated[category][index].income || 0;
          const currentSubsidy =
            fieldType === "subsidy" ? newAmount : updated[category][index].subsidy || 0;
          const totalAmount = currentIncome + currentSubsidy;

          if ("amount" in updated[category][index]) {
            updated[category][index].amount = totalAmount;
          } else if ("cost" in updated[category][index]) {
            updated[category][index].cost = totalAmount;
          }
        } else if (category === "personnel" && fieldName) {
          updated[category][index][fieldName] = newAmount;
          if (fieldName === "monthlySalary") {
            updated[category][index].annualSalary = newAmount * 12;
          } else if (fieldName === "annualSalary") {
            updated[category][index].monthlySalary = newAmount / 12;
          }

          const personnel = updated[category][index];
          personnel.Total =
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
            (Number(personnel.courtAppearance) || 0);
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

    const itemKey = fieldName ? `${category}-${index}-${fieldName}` : `${category}-${index}`;
    const newChangedItems = new Set(changedItems);
    const originalItem = proposalDetails[category]?.[index];

    if (originalItem) {
      let originalValue;
      if (fieldType === "income" || fieldType === "subsidy") {
        originalValue = originalItem[fieldType] ?? 0;
      } else if (category === "personnel" && fieldName) {
        originalValue = originalItem[fieldName] ?? 0;
      } else {
        originalValue = originalItem.amount ?? originalItem.Total ?? originalItem.cost ?? 0;
      }

      if (originalValue !== newAmount) {
        newChangedItems.add(itemKey);
      } else {
        newChangedItems.delete(itemKey);
      }
    }
    setChangedItems(newChangedItems);
  };

  // Save changes handler
  // Tanstack Query Mutation for bulk updates
  const saveMutation = useMutation({
    mutationFn: async ({ changedByCategory, activeWorkflowRef }) => {
      const savePromises = [];
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

      await Promise.all(savePromises);
      return { changedByCategory };
    },
    onSuccess: async ({ changedByCategory }) => {
      toast.success("Changes saved successfully");
      setChangedItems(new Set());

      let calculatedSubsidy = 0;

      if (changedByCategory.mooe) {
        calculatedSubsidy += changedByCategory.mooe.reduce(
          (sum, item) => sum + (item.subsidy || item.totalSubsidy || 0),
          0
        );
      } else if (proposalDetails?.mooe) {
        calculatedSubsidy += proposalDetails.mooe.reduce(
          (sum, item) => sum + (item.subsidy || item.totalSubsidy || 0),
          0
        );
      }

      if (changedByCategory.personnel) {
        const sameDivision = selectedProposal?.division
          ? changedByCategory.personnel.filter(
              (p) => p.division === selectedProposal.division && !p.chargedToIncomeEligible
            )
          : changedByCategory.personnel.filter((p) => !p.chargedToIncomeEligible);
        calculatedSubsidy += sameDivision.reduce(
          (sum, item) => sum + (item.subsidyAmount || item.subsidy || 0),
          0
        );
      } else if (proposalDetails?.personnel) {
        const sameDivision = selectedProposal?.division
          ? proposalDetails.personnel.filter(
              (p) => p.division === selectedProposal.division && !p.chargedToIncomeEligible
            )
          : proposalDetails.personnel.filter((p) => !p.chargedToIncomeEligible);
        calculatedSubsidy += sameDivision.reduce(
          (sum, item) => sum + (item.subsidyAmount || item.subsidy || 0),
          0
        );
      }

      if (changedByCategory.capitalOutlay) {
        calculatedSubsidy += changedByCategory.capitalOutlay.reduce(
          (sum, item) => sum + (item.subsidy || item.totalSubsidy || 0),
          0
        );
      } else if (proposalDetails?.capitalOutlay) {
        calculatedSubsidy += proposalDetails.capitalOutlay.reduce(
          (sum, item) => sum + (item.subsidy || item.totalSubsidy || 0),
          0
        );
      }

      try {
        await api.put(`/api/allproposal/proposals/${selectedProposal._id}`, {
          projectedSubsidy: calculatedSubsidy,
          __v: selectedProposal.__v,
        });
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

          const [incomeRes, personnelRes, mooeRes, capitalRes] = await Promise.all([
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
    },
    onError: (error) => {
      handleApiError(error, toast, "Saving changes");
    },
    onSettled: () => {
      setDetailsLoading(false);
    }
  });

  // Save changes handler (invokes mutation)
  const handleSaveChanges = async () => {
    if (changedItems.size === 0) {
      toast.info("No changes made");
      return;
    }

    const changedByCategory = {};
    changedItems.forEach((itemKey) => {
      const [category, index] = itemKey.split("-");
      const idx = parseInt(index);
      if (!changedByCategory[category]) changedByCategory[category] = [];
      changedByCategory[category].push(editableItems[category][idx]);
    });

    const activeWorkflowRef =
      selectedProposal?._id ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("activeWorkflowRef") ||
          localStorage.getItem("activeWorkflowRef")
        : null);

    setDetailsLoading(true);
    saveMutation.mutate({ changedByCategory, activeWorkflowRef });
  };

  // Helper mapping for roles to actions
  const getRoleFromAction = (entry) => {
    const action = entry.action || "";
    const newStatus = entry.newStatus || entry.toStatus || "";

    if (action.includes("SUBMIT_TO_REVIEWER") || action.includes("submit-to-reviewer"))
      return "BUDGET PREPARER";
    if (action.includes("SUBMIT_TO_APPROVER") || action.includes("submit-to-approver"))
      return "BUDGET REVIEWER";
    if (action.includes("SUBMIT_TO_ANALYST") || action.includes("submit-to-analyst"))
      return "BUDGET APPROVER";
    if (action.includes("FORWARD_TO_OFFICER") || action.includes("forward-to-officer"))
      return "BUDGET PLANNING ANALYST";
    if (action.includes("FORWARD_TO_MANAGER") || action.includes("forward-to-manager"))
      return "BUDGET OFFICER";
    if (action.includes("FINALIZE") || action.includes("finalize")) return "BUDGET MANAGER";
    if (action.includes("RETURN_TO")) return "RETURN ACTION";

    if (newStatus.includes("Reviewer")) return "BUDGET PREPARER";
    if (newStatus.includes("Approver")) return "BUDGET REVIEWER";
    if (newStatus.includes("Analyst") || newStatus.includes("Planning"))
      return "BUDGET APPROVER";
    if (newStatus.includes("Officer")) return "BUDGET PLANNING ANALYST";
    if (newStatus.includes("Manager")) return "BUDGET OFFICER";
    if (newStatus.includes("Finalized")) return "BUDGET MANAGER";

    return action || "-";
  };

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
      (proposal.responsibilityCenter &&
        proposal.responsibilityCenter.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.division && proposal.division.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.budgetType &&
        proposal.budgetType.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (proposal.status && proposal.status.toLowerCase().includes(searchQuery.toLowerCase()));

    const filterDbStatus = statusEnumToDbMap[filterStatus];
    const matchesFilter =
      filterStatus === "all" ||
      (proposal.status &&
        filterDbStatus &&
        proposal.status.toLowerCase() === filterDbStatus.toLowerCase());

    return matchesSearch && matchesFilter;
  });

  const { topLevelProposals, childrenMap } = useMemo(() => {
    const parentMap = {};
    const childMap = {};

    proposals.forEach((p) => {
      if (p.mergedInto) {
        parentMap[String(p._id)] = String(p.mergedInto);
      }
      if (p.mergedFrom && p.mergedFrom.length > 0) {
        p.mergedFrom.forEach((childId) => {
          parentMap[String(childId)] = String(p._id);
        });
      }
    });

    proposals.forEach((p) => {
      const parentId = parentMap[String(p._id)];
      if (parentId) {
        if (!childMap[parentId]) childMap[parentId] = [];
        childMap[parentId].push(p);
      }
    });

    const topLevel = [];
    const topLevelAdded = new Set();

    filteredProposals.forEach((p) => {
      const pId = String(p._id);
      const parentId = parentMap[pId];

      if (parentId) {
        const parentObj = proposals.find(
          (parent) => String(parent._id) === parentId
        );
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
  }, [filteredProposals, proposals]);

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
    const mergeableIds = filteredProposals
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
      const msg =
        err?.response?.data?.message || err?.message || "Error sa pag-consolidate ng proposals.";
      toast.error(msg);
    } finally {
      setMergeLoading(false);
    }
  };

  const handleUnconsolidate = async () => {
    setUnconsolidateLoading(true);
    try {
      const response = await api.post(
        `${WORKFLOW_API_BASE}/${selectedProposal._id}/unconsolidate`
      );
      if (response.data?.success) {
        toast.success(response.data.message || "Matagumpay na na-unconsolidate ang proposal.");
        setUnconsolidateDialogOpen(false);
        fetchProposals();
      } else {
        toast.error(response.data?.message || "Hindi ma-unconsolidate ang proposal.");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Error sa pag-unconsolidate ng proposal.";
      toast.error(msg);
    } finally {
      setUnconsolidateLoading(false);
    }
  };

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
    const label = WORKFLOW_STATUS_UI_METADATA[status]?.label || status;

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

  const getAvailableActions = (proposal) => {
    return fetchAvailableActions(proposal, analystsForMenuProposal, headerBg);
  };

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
              sx={{ fontWeight: "bold", fontSize: "1.8rem", letterSpacing: 0.2 }}
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
                  "& fieldset": { borderColor: "#e0e0e0" },
                  "&:hover fieldset": { borderColor: "#e0e0e0" },
                  "&.Mui-focused fieldset": {
                    borderColor: BRAND_COLORS.darkGreen,
                    borderWidth: "2px",
                  },
                },
                "& .MuiOutlinedInput-input": {
                  "&::placeholder": { opacity: 0.6, color: "#999" },
                },
                "& .MuiSvgIcon-root": { color: "#999" },
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
          {/* Tabs Header */}
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
                  if (isSuperAdmin) return true;
                  if (tab.value === "my-proposals" && isBRDUser && !isBudgetPreparer) return false;
                  return true;
                })
                .map((tab, index) => {
                  const tabIndex = tabs.findIndex((t) => t.value === tab.value);
                  const isActive = activeTab === tabIndex;

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
                          ? theme.palette.mode === "dark"
                            ? "#0b2413"
                            : "#2d5016"
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
                            ? theme.palette.mode === "dark"
                              ? "#0b2413"
                              : "#2d5016"
                            : "#ffffff",
                          bgcolor: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.08)",
                        },
                      }}
                    >
                      <TabIcon size={14} />
                      {tab.label}
                    </ButtonBase>
                  );
                })}
            </Box>
          </Box>

          {/* Proposals List Table */}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
              <CircularProgress sx={{ color: headerBg }} />
            </Box>
          ) : filteredProposals.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={TABLE_HEADER_ROW}>
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
                      FY
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
                      MODEL
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
                              filteredProposals
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .filter(isProposalMergeable).length > 0 &&
                              filteredProposals
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
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((proposal, index) => {
                      const isExpanded = expandedRows[String(proposal._id)];
                      const isParent = proposal.isConsolidated;
                      const children = childrenMap[String(proposal._id)] || [];

                      const renderRow = (p, isChild = false) => (
                        <TableRow
                          key={p._id}
                          sx={{
                            bgcolor: isChild ? "#fdfdfd" : "#f9f9f9",
                            borderBottom: "1px solid #e8e8e8",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": { bgcolor: "#f0f7ed" },
                            ...(isChild ? { "& > td": { borderBottom: "1px dashed #e8e8e8" } } : {})
                          }}
                        >
                          <TableCell sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              {!isChild && isParent && (
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleConsolidated(p._id); }}>
                                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </IconButton>
                              )}
                              {isChild && (
                                <span style={{ marginLeft: 24, color: "#888" }}>└</span>
                              )}
                              <Typography variant="body2" sx={{ fontWeight: isChild ? 400 : 600, color: isChild ? "#666" : "#333" }}>
                                {p.responsibilityCenter || p.division || "N/A"}
                              </Typography>
                            </Box>
                          </TableCell>
                        <TableCell sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {p.fiscalYear}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}>
                          <Chip
                            label={p.budgetType?.toUpperCase()}
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
                        <TableCell sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}>
                          <Typography variant="body2" sx={{ color: "#666" }}>
                            {new Date(p.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#020b15" }}>
                            ₱
                            {(p.projectedCorporateIncome || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "#020b15" }}>
                            ₱
                            {getDisplayAmounts(p).projectedSubsidy.toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "bold", color: "#020b15", fontSize: "0.95rem" }}
                          >
                            ₱
                            {getDisplayAmounts(p).proposedBudget.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 2, fontSize: "0.85rem", borderRight: "1px solid #e8e8e8" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {renderStatusChip(p.status)}
                            {p.isConsolidated && (
                              <Chip
                                label="CONSOLIDATED"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: "0.65rem",
                                  bgcolor: "#ffb74d",
                                  color: "#fff",
                                  fontWeight: 700,
                                }}
                              />
                            )}
                            {p.isMergedSource && (
                              <Chip
                                label="CONSOLIDATED (SOURCE)"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: "0.65rem",
                                  bgcolor: "#9e9e9e",
                                  color: "#fff",
                                  fontWeight: 700,
                                }}
                              />
                            )}
                            {/returned/i.test(String(p.status || "")) &&
                              p.currentAssigneeRole && (
                                <Chip
                                  label={`Returned to ${prettyRole(p.currentAssigneeRole)}`}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: "0.68rem",
                                    bgcolor: "#f6f6f6",
                                    color: "#777",
                                  }}
                                />
                              )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ p: 2, fontSize: "0.85rem" }}>
                          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                            {getAvailableActions(p).length > 0 && (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  endIcon={<ExpandMoreIcon sx={{ fontSize: "1.1rem" }} />}
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
                                    boxShadow: "0 2px 4px rgba(55, 94, 56, 0.25)",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                      bgcolor: "#2b4a2c",
                                      boxShadow: "0 4px 8px rgba(55, 94, 56, 0.35)",
                                    },
                                  }}
                                  onClick={(e) => {
                                    setSelectedProposal(p);
                                    setAvailableActionsForMenu(getAvailableActions(p));
                                    setActionMenuAnchor(e.currentTarget);
                                  }}
                                >
                                  Actions
                                </Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
                        {isBudgetApprover && (
                          <TableCell sx={{ p: 2, textAlign: "center" }}>
                            {isProposalMergeable(p) ? (
                              <input
                                type="checkbox"
                                style={{ cursor: "pointer", width: 16, height: 16, accentColor: titleColor }}
                                checked={selectedForMerge.has(p._id)}
                                onChange={() => handleToggleMergeSelect(p._id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <Tooltip title="Hindi maaaring isama sa pag-consolidate">
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
                                    margin: "0 auto",
                                  }}
                                />
                              </Tooltip>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );

                    return (
                      <React.Fragment key={proposal._id}>
                        {renderRow(proposal, false)}
                        {isExpanded && children.map(child => renderRow(child, true))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary">
                No proposals found
              </Typography>
            </Box>
          )}

          <TablePagination
            component="div"
            count={filteredProposals.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Rows per page:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
            sx={{
              width: "100%",
              backgroundColor: BRAND_COLORS.darkGreen,
              color: "#fff",
              borderRadius: "0 0 8px 8px",
              borderTop: `2px solid ${BRAND_COLORS.darkGreen}`,
              px: 2,
              "& .MuiTablePagination-toolbar": { p: 0, minHeight: 36 },
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": {
                fontSize: "0.7rem",
                color: "#fff",
              },
              "& .MuiSelect-select": { color: "#fff", fontSize: "0.7rem" },
              "& .MuiTablePagination-actions .MuiButtonBase-root": { color: "#fff" },
              "& .MuiTablePagination-selectIcon": { color: "#fff" },
            }}
          />
        </Paper>
      </Box>

      {/* Floating Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => {
          setActionMenuAnchor(null);
          setAnalystsForMenuProposal([]);
        }}
        PaperProps={{
          sx: {
            mt: 1,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            borderRadius: "8px",
            minWidth: 220,
          },
        }}
      >
        {availableActionsForMenu.map((action) => (
          <MenuItem
            key={action.value}
            onClick={async () => {
              setActionType(action.value);
              setActionMenuAnchor(null);
              if (action.value === "view-details") {
                await handleViewDetails(selectedProposal);
              } else if (action.value === "view-history") {
                setHistoryPage(0);
                setHistoryDialogOpen(true);
              } else if (action.value === "view-audit-trail") {
                await handleViewAuditTrail(selectedProposal);
              } else if (action.value === "open-tier") {
                const params = new URLSearchParams();
                if (selectedProposal.fiscalYear != null)
                  params.set("fiscalYear", String(selectedProposal.fiscalYear));
                if (selectedProposal.region) params.set("region", String(selectedProposal.region));
                if (selectedProposal.department)
                  params.set("department", String(selectedProposal.department));
                if (selectedProposal.division || selectedProposal.responsibilityCenter)
                  params.set(
                    "division",
                    String(selectedProposal.division || selectedProposal.responsibilityCenter)
                  );
                navigate(`/tier?${params.toString()}`);
              } else if (action.value === "unconsolidate") {
                setUnconsolidateDialogOpen(true);
              } else {
                try {
                  const lockCheck = await api.get(
                    `/proposals/${selectedProposal._id}/lock/status`,
                    { hideErrorToast: true }
                  );
                  const lockData = lockCheck.data;
                  const myUserId = String(currentUser?.Username || currentUser?.Id || currentUser?.id || "");
                  if (
                    lockData?.isLocked &&
                    lockData?.lockedBy?.userId &&
                    String(lockData.lockedBy.userId) !== myUserId
                  ) {
                    toast.warning(
                      `Submission unavailable: This proposal is currently being edited by ${
                        lockData.lockedBy.userName || "other user"
                      }. Please wait for them to finish.`,
                      { autoClose: 6000 }
                    );
                    return;
                  }
                } catch (_) {}
                setActionDialogOpen(true);
              }
            }}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              py: 1.5,
              px: 2,
              color: action.value === "view-details" ? titleColor : "inherit",
              fontWeight: action.value === "view-details" ? 600 : 500,
              fontSize: "0.9rem",
              transition: "all 0.2s ease",
              "&:hover": {
                bgcolor:
                  action.color === "warning"
                    ? theme.palette.mode === "dark"
                      ? "rgba(245, 124, 0, 0.1)"
                      : "#fff3e0"
                    : action.color === "success"
                    ? theme.palette.mode === "dark"
                      ? "rgba(56, 142, 60, 0.1)"
                      : "#e8f5e9"
                    : theme.palette.mode === "dark"
                    ? "rgba(76, 175, 80, 0.1)"
                    : "#f0f7ed",
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
        ))}
      </Menu>

      {/* Extracted Sub-dialogs rendering - Wrapped in Suspense for code-splitting */}
      <Suspense fallback={null}>
        <ProposalDetailsDialog
          open={viewDetailsDialogOpen}
          onClose={() => setViewDetailsDialogOpen(false)}
          selectedProposal={selectedProposal}
          setSelectedProposal={setSelectedProposal}
          proposalDetails={proposalDetails}
          setProposalDetails={setProposalDetails}
          detailsLoading={detailsLoading}
          canUserEdit={canUserEdit}
          canViewVersionHistory={canViewVersionHistory}
          versionHistoryOpen={versionHistoryOpen}
          setVersionHistoryOpen={setVersionHistoryOpen}
          detailsTab={detailsTab}
          setDetailsTab={setDetailsTab}
          changedItems={changedItems}
          setChangedItems={setChangedItems}
          editableItems={editableItems}
          setEditableItems={setEditableItems}
          proposalEditValues={proposalEditValues}
          setProposalEditValues={setProposalEditValues}
          proposalEditDirty={proposalEditDirty}
          setProposalEditDirty={setProposalEditDirty}
          discountSettings={discountSettings}
          handleSaveChanges={handleSaveChanges}
          handleEditItemAmount={handleEditItemAmount}
          lockStatus={lockStatus}
          hasLock={hasLock}
          showAllRegions={showAllRegions}
          fetchProposals={fetchProposals}
        />

        <ActionConfirmDialog
          open={actionDialogOpen}
          onClose={() => setActionDialogOpen(false)}
          actionType={actionType}
          actionComment={actionComment}
          setActionComment={setActionComment}
          actionLoading={actionLoading}
          isSubmitToAnalystAction={isSubmitToAnalystAction}
          analystsForProposal={analystsForProposal}
          targetAnalystId={targetAnalystId}
          setTargetAnalystId={setTargetAnalystId}
          signerMode={signerMode}
          actionP12File={actionP12File}
          setActionP12File={setActionP12File}
          actionP12Password={actionP12Password}
          setActionP12Password={setActionP12Password}
          onConfirm={handleProposalAction}
        />

        <AuditTrailDialog
          open={auditTrailDialogOpen}
          onClose={() => setAuditTrailDialogOpen(false)}
          auditTrailLoading={auditTrailLoading}
          auditTrailData={auditTrailData}
        />

        <ConsolidateDialog
          isBudgetApprover={isBudgetApprover}
          selectedForMerge={selectedForMerge}
          setSelectedForMerge={setSelectedForMerge}
          filteredProposals={filteredProposals}
          mergeDialogOpen={mergeDialogOpen}
          setMergeDialogOpen={setMergeDialogOpen}
          mergeLoading={mergeLoading}
          handleMergeProposals={handleMergeProposals}
          unconsolidateDialogOpen={unconsolidateDialogOpen}
          setUnconsolidateDialogOpen={setUnconsolidateDialogOpen}
          unconsolidateLoading={unconsolidateLoading}
          handleUnconsolidate={handleUnconsolidate}
          selectedProposal={selectedProposal}
        />
      </Suspense>

      {/* Standalone Proposal Version History Dialog */}
      <ProposalVersionHistoryDialog
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        proposalId={selectedProposal?._id ? String(selectedProposal._id) : undefined}
      />

      {/* Proposal History (Transition Log Timeline) Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" },
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
          {selectedProposal?.workflowHistory && selectedProposal.workflowHistory.length > 0 ? (
            <>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow sx={{ ...TABLE_HEADER_ROW, bgcolor: headerBg }}>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        PROCESSOR NAME
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        POSITION
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        OLD STATUS
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        NEW STATUS
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        REMARK
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        DATE
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        TIME
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem" }}>
                        TIER VERSION
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: "#333", fontSize: "0.85rem", minWidth: 260 }}
                      >
                        SIGNATURE
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedProposal.workflowHistory
                      .slice(historyPage * historyRowsPerPage, (historyPage + 1) * historyRowsPerPage)
                      .map((entry, index) => (
                        <TableRow
                          key={index}
                          sx={{
                            "&:nth-of-type(odd)": { bgcolor: "#f9f9f9" },
                            "&:hover": { bgcolor: "#f0f7ed" },
                            transition: "background-color 0.2s ease",
                          }}
                        >
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#333" }}>
                            {entry.performedByName || entry.userName || "-"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}>
                            {entry.position || getRoleFromAction(entry)}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}>
                            {entry.fromStatus || entry.previousStatus || "-"}
                          </TableCell>
                          <TableCell
                            sx={{ py: 1.5, fontSize: "0.85rem", color: "#333", fontWeight: 500 }}
                          >
                            {entry.toStatus || entry.newStatus || "-"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#555" }}>
                            {entry.comment || "-"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}>
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#666" }}>
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : "-"}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, fontSize: "0.85rem", color: "#333" }}>
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
                                    ? `Signed: ${new Date(
                                        entry.digitalSignature.signedAt
                                      ).toLocaleString("en-US")}`
                                    : "Signed"}
                                </Typography>
                                {entry.digitalSignature.certificateFingerprint256 && (
                                  <Tooltip title={entry.digitalSignature.certificateFingerprint256}>
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      sx={{ color: "#777" }}
                                    >
                                      FP:{" "}
                                      {String(
                                        entry.digitalSignature.certificateFingerprint256
                                      ).slice(0, 20)}
                                      ...
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
                                    ? `Signed: ${new Date(entry.eSignature.signedAt).toLocaleString(
                                        "en-US"
                                      )}`
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
                  <Typography variant="body2" sx={{ color: "#666", fontWeight: 500 }}>
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
              "&:hover": { bgcolor: theme.palette.mode === "dark" ? "#14331d" : "#4a7c2c" },
            }}
          >
            Back
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProposalOperationsHub;
