import React, { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import {
  Send as SendIcon,
  ThumbDown as RejectIcon,
  ThumbUp as ApproveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import api from "../config/api";
import { toast } from "react-toastify";
import { useWorkflowRef } from "../hooks/useWorkflowRef";
import { useNotifications } from "../global/components/NotificationsContext";
import { prettyRole } from '../utils/role-utils';
import { useQueryClient } from "@tanstack/react-query";

// Brand colors aligned to Transactions Processing UI
const BRAND_COLORS = {
  darkGreen: "#375e38", // primary header/table color from screenshot
  deepGreen: "#2d5016",
};

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
};

// Base tabs; Monitoring tab will be injected dynamically for Budget Manager
const BASE_TABS = [
  { label: "All Proposals", value: "all-proposals" },
  { label: "My Proposals", value: "my-proposals" },
  { label: "Pending Review", value: "pending-review" },
];

// Centralize the workflow API base path to avoid mismatched endpoints
const WORKFLOW_API_BASE = "/api/new-proposal-workflow/proposals";

const NewProposalWorkflowPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const [searchParams] = useSearchParams();
  const { setWorkflowRef } = useWorkflowRef();
  const { serverNotifications, markNotificationsAsRead } = useNotifications();
  const queryClient = useQueryClient();

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

  // Build tabs dynamically (include Monitoring for Budget Manager)
  const isBudgetManager =
    currentUser?.Roles?.includes("BUDGET MANAGER") ||
    currentUser?.Roles?.includes("BUDGET_MANAGER");
  const tabs = isBudgetManager
    ? [...BASE_TABS, { label: "Monitoring", value: "monitoring" }]
    : BASE_TABS;

  // Handle tab and proposalId parameters from query string (e.g., notifications deep link)
  // Format: /new-proposal-workflow?tab=<tab>&proposalId=<id>
  const [targetProposalId, setTargetProposalId] = useState(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const proposalIdParam = searchParams.get("proposalId");

    // Handle tab parameter
    if (tabParam) {
      const tabIndex = tabs.findIndex((tab) => tab.value === tabParam);
      if (tabIndex !== -1) setActiveTab(tabIndex);
    }

    // Store proposalId to auto-select it once proposals load
    if (proposalIdParam) {
      setTargetProposalId(proposalIdParam);
    }
  }, [searchParams, tabs]);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
  const [auditTrailData, setAuditTrailData] = useState([]);
  const [auditTrailLoading, setAuditTrailLoading] = useState(false);
  const [actionType, setActionType] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [availableActionsForMenu, setAvailableActionsForMenu] = useState([]);
  const [proposalDetails, setProposalDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState("income");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(20);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [personnelPage, setPersonnelPage] = useState(0);
  const [personnelRowsPerPage, setPersonnelRowsPerPage] = useState(10);
  const [expandedPersonnel, setExpandedPersonnel] = useState({});
  const [permanentPersonnelPage, setPermanentPersonnelPage] = useState(0);
  const [permanentPersonnelRowsPerPage, setPermanentPersonnelRowsPerPage] = useState(10);
  const [casualPersonnelPage, setCasualPersonnelPage] = useState(0);
  const [casualPersonnelRowsPerPage, setCasualPersonnelRowsPerPage] = useState(10);
  const [chargedPersonnelPage, setChargedPersonnelPage] = useState(0);
  const [chargedPersonnelRowsPerPage, setChargedPersonnelRowsPerPage] = useState(10);

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

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Determine user's workflow role
  const userWorkflowRole =
    currentUser?.hierarchicalAssignment?.userRole ||
    (currentUser?.Roles?.includes("BUDGET PREPARER")
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

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const activeTabView = tabs[activeTab].value;
      const params = {
        region: activeRegion,
        view: activeTabView, // Pass the active tab's value to the API
      };
      const response = await api.get(WORKFLOW_API_BASE, { params });
      setProposals(response.data.proposals || []);
      if (activeTabView === "monitoring") {
        setMonitoringMetrics(response.data.metrics || {});
      } else {
        setMonitoringMetrics(null);
      }
    } catch (error) {
      console.error("Error fetching proposals:", error);
      toast.error("Failed to fetch proposals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeRegion, activeTab]);

  // tabs already built above

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Auto-select proposal from deep link (notification)
  useEffect(() => {
    if (targetProposalId && proposals.length > 0) {
      const proposal = proposals.find((p) => p._id === targetProposalId);
      if (proposal) {
        setSelectedProposal(proposal);
        setViewDetailsDialogOpen(true);
        // Clear the target so we don't auto-select again
        setTargetProposalId(null);
        // Also mark related notifications as read (if any) on load
        (async () => {
          try {
            if (targetProposalId && typeof window !== 'undefined') {
              const matching = (serverNotifications || []).filter(n => String(n?.metadata?.proposalId) === String(targetProposalId));
              if (matching.length > 0) {
                await markNotificationsAsRead(matching.map(n => n._id));
              }
            }
          } catch (e) {
            console.debug('Auto-mark notifications read failed:', e?.message || e);
          }
        })();
      }
    }
  }, [proposals, targetProposalId, serverNotifications, markNotificationsAsRead]);

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

    const userRoles = currentUser?.Roles || [];
    const status = selectedProposal.status;

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
        "Returned",
        "Returned to Preparer",
        "RETURNED_TO_PREPARER",
      ];
      const isOwnerByName =
        selectedProposal?.processBy &&
        userName &&
        selectedProposal.processBy === userName;
      const isOwnerById =
        selectedProposal?.createdBy && (currentUser?.id || currentUser?._id)
          ? String(selectedProposal.createdBy) ===
            String(currentUser.id || currentUser?._id)
          : false;
      if (draftStatuses.includes(status) && (isOwnerByName || isOwnerById)) {
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
      };

      const [incomeRes, personnelRes, mooeRes, capitalRes] = await Promise.all([
        api.get("/income/getByParams", { params: queryParams }),
        api.get("/api/personnel/getByParams", { params: queryParams }),
        api.get("/mooe/getByParams", { params: queryParams }),
        api.get("/capital-outlay/getByParams", { params: queryParams }),
      ]);

      const details = {
        income: incomeRes.data || [],
        personnel: personnelRes.data || [],
        mooe: mooeRes.data || [],
        capitalOutlay: capitalRes.data || [],
      };

      setProposalDetails(details);

      setEditableItems({
        income: JSON.parse(JSON.stringify(details.income)),
        personnel: JSON.parse(JSON.stringify(details.personnel)),
        mooe: JSON.parse(JSON.stringify(details.mooe)),
        capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay)),
      });
    } catch (error) {
      console.error("Error fetching proposal details:", error);
      toast.error("Failed to load proposal details");
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
      console.error("Error fetching audit trail:", error);
      toast.error("Failed to load audit trail");
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

  const mapActionToBackend = (frontendAction) => {
    const actionMapping = {
      // Budget Preparer actions
      "submit-to-reviewer": "submit-to-reviewer",

      // Budget Reviewer actions
      "reviewer-approve-forward-approver": "submit-to-approver",
      "reviewer-return": "return-to-preparer",
      "reviewer-save-edits": "reviewer-save-edits",

      // Budget Approver actions
      "approver-approve-forward-analyst": "submit-to-analyst",
      "approver-approve-forward-officer": "submit-to-analyst",
      "approver-return": "return-to-reviewer",
      "approver-save-edits": "approver-save-edits",

      // Budget Planning Analyst actions
      "analyst-submit-to-officer": "forward-to-officer",
      "analyst-return": "return-to-approver",
      "analyst-save-edits": "analyst-save-edits",

      // Budget Officer actions
      "officer-approve": "forward-to-manager",
      "officer-return": "return-to-analyst",
      "officer-save-edits": "officer-save-edits",
      "officer-submit-to-manager": "forward-to-manager",

      // Budget Manager actions
      "manager-approve": "finalize",
      "manager-return": "return-to-officer",
      "manager-save-edits": "manager-save-edits",
    };

    return actionMapping[frontendAction] || frontendAction;
  };

  // Handle proposal actions
  const handleProposalAction = async () => {
    if (!selectedProposal || !actionType) return;

    // Validate comment for return actions
    if (actionType?.includes("return") && !actionComment.trim()) {
      toast.error("Comment is required when returning a proposal");
      return;
    }

    try {
      const backendAction = mapActionToBackend(actionType);
      await api.post(`${WORKFLOW_API_BASE}/${selectedProposal._id}/action`, {
        action: backendAction,
        comment: actionComment,
      });

      toast.success("Action completed successfully");
      setActionDialogOpen(false);
      setViewDetailsDialogOpen(false);
      setSelectedProposal(null);
      setActionType("");
      setActionComment("");
      
      await fetchProposals();
      
      queryClient.invalidateQueries({ queryKey: ["serverNotifications"] });
    } catch (error) {
      console.error("Error performing action:", error);
      toast.error("Failed to perform action");
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

      console.log("[DEBUG] Changed items by category:", changedByCategory);

      const savePromises = [];
      const activeWorkflowRef =
        selectedProposal?._id ||
        (typeof window !== "undefined"
          ? sessionStorage.getItem("activeWorkflowRef") ||
            localStorage.getItem("activeWorkflowRef")
          : null);
      console.log("[DEBUG] Active workflow ref:", activeWorkflowRef);

      const headerOpt = activeWorkflowRef
        ? { headers: { "X-Workflow-Ref": activeWorkflowRef } }
        : {};
      const injectRef = (arr = []) =>
        arr.map((it) => ({
          ...it,
          proposalId: it.proposalId || activeWorkflowRef,
        }));

      if (changedByCategory.income) {
        console.log(
          "[DEBUG] Saving income items:",
          injectRef(changedByCategory.income)
        );
        savePromises.push(
          api.put(
            "/income/bulk-update",
            { items: injectRef(changedByCategory.income) },
            headerOpt
          )
        );
      }
      if (changedByCategory.personnel) {
        console.log(
          "[DEBUG] Saving personnel items:",
          injectRef(changedByCategory.personnel)
        );
        savePromises.push(
          api.put(
            "/api/personnel/bulk-update",
            { items: injectRef(changedByCategory.personnel) },
            headerOpt
          )
        );
      }
      if (changedByCategory.mooe) {
        console.log(
          "[DEBUG] Saving mooe items:",
          injectRef(changedByCategory.mooe)
        );
        savePromises.push(
          api.put(
            "/mooe/bulk-update",
            { items: injectRef(changedByCategory.mooe) },
            headerOpt
          )
        );
      }
      if (changedByCategory.capitalOutlay) {
        console.log(
          "[DEBUG] Saving capitalOutlay items:",
          injectRef(changedByCategory.capitalOutlay)
        );
        savePromises.push(
          api.put(
            "/capital-outlay/bulk-update",
            { items: injectRef(changedByCategory.capitalOutlay) },
            headerOpt
          )
        );
      }

      const results = await Promise.all(savePromises);
      console.log("[DEBUG] Save results:", results);

      toast.success(`Changes saved successfully`);
      setChangedItems(new Set());

      await fetchProposals();
      
      queryClient.invalidateQueries({ queryKey: ["serverNotifications"] });

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
          };
          const [incomeRes, personnelRes, mooeRes, capitalRes] =
            await Promise.all([
              api.get("/income/getByParams", { params: queryParams }),
              api.get("/api/personnel/getByParams", { params: queryParams }),
              api.get("/mooe/getByParams", { params: queryParams }),
              api.get("/capital-outlay/getByParams", { params: queryParams }),
            ]);

          const details = {
            income: incomeRes.data || [],
            personnel: personnelRes.data || [],
            mooe: mooeRes.data || [],
            capitalOutlay: capitalRes.data || [],
          };

          setProposalDetails(details);
          setEditableItems({
            income: JSON.parse(JSON.stringify(details.income)),
            personnel: JSON.parse(JSON.stringify(details.personnel)),
            mooe: JSON.parse(JSON.stringify(details.mooe)),
            capitalOutlay: JSON.parse(JSON.stringify(details.capitalOutlay)),
          });
        } catch (error) {
          console.error("Error refreshing proposal details:", error);
        } finally {
          setDetailsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      console.error("Error response:", error.response?.data);
      toast.error(error.response?.data?.message || "Failed to save changes");
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
  const getAvailableActions = (proposal) => {
    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;
    const actions = [];

    // VIEW DETAILS (always available)
    actions.push({
      label: "View Details",
      value: "view-details",
      icon: <ViewIcon />,
      color: "#2d5016",
    });

    // VIEW HISTORY (always available)
    actions.push({
      label: "View History",
      value: "view-history",
      icon: <ExpandMoreIcon />,
      color: "#1976d2",
    });

    // VIEW AUDIT TRAIL (always available)
    actions.push({
      label: "View Audit Trail",
      value: "view-audit-trail",
      icon: <ExpandMoreIcon />,
      color: "#d97706",
    });

    // BUDGET PREPARER actions
    const userName =
      currentUser?.name ||
      `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`.trim();
    console.log("[DEBUG] User Roles:", userRoles);
    console.log(
      "[DEBUG] Has BUDGET PREPARER role:",
      userRoles.includes("BUDGET PREPARER")
    );
    console.log(
      "[DEBUG] Has BUDGET_PREPARER role:",
      userRoles.includes("BUDGET_PREPARER")
    );
    console.log("[DEBUG] Current User Name:", userName);
    console.log("[DEBUG] Proposal processBy:", proposal.processBy);
    console.log("[DEBUG] Proposal status:", currentStatus);
    console.log("[DEBUG] Match:", proposal.processBy === userName);

    if (
      (userRoles.includes("BUDGET PREPARER") ||
        userRoles.includes("BUDGET_PREPARER")) &&
      proposal.processBy === userName
    ) {
      console.log("[DEBUG] Passed role and processBy check!");
      console.log("[DEBUG] Checking status:", currentStatus);
      if (
        currentStatus === "DRAFT" ||
        currentStatus === "Draft" ||
        currentStatus === "Returned to Preparer" ||
        currentStatus === "RETURNED_TO_PREPARER"
      ) {
        console.log("[DEBUG] Adding Submit to Budget Reviewer action!");
        actions.push({
          label: "Submit to Budget Reviewer",
          value: "submit-to-reviewer",
          icon: <SendIcon />,
          color: "primary",
        });
      }
    }

    // BUDGET REVIEWER actions
    if (
      userRoles.includes("BUDGET REVIEWER") &&
      (currentStatus === "Forwarded to Reviewer" ||
        currentStatus === "Returned to Reviewer" ||
        currentStatus === "FORWARDED_TO_REVIEWER" ||
        currentStatus === "RETURNED_TO_REVIEWER")
    ) {
      actions.push(
        {
          label: "Approve & Forward to Budget Approver",
          value: "reviewer-approve-forward-approver",
          icon: <SendIcon />,
          color: "primary",
        },
        {
          label: "Return to Budget Preparer",
          value: "reviewer-return",
          icon: <RejectIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET APPROVER actions
    if (
      userRoles.includes("BUDGET APPROVER") &&
      (currentStatus === "Forwarded to Approver" ||
        currentStatus === "Returned to Approver" ||
        currentStatus === "FORWARDED_TO_APPROVER" ||
        currentStatus === "RETURNED_TO_APPROVER")
    ) {
      actions.push(
        {
          label: "Approve & Forward to Budget Planning Analyst",
          value: "approver-approve-forward-analyst",
          icon: <SendIcon />,
          color: "primary",
        },
        // { label: 'Approve & Forward to Budget Officer', value: 'approver-approve-forward-officer', icon: <SendIcon />, color: 'primary' },
        {
          label: "Return to Budget Reviewer",
          value: "approver-return",
          icon: <RejectIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET PLANNING ANALYST actions
    if (
      userRoles.includes("BUDGET PLANNING ANALYST") &&
      (currentStatus === "Forwarded to Budget Planning Analyst" ||
        currentStatus === "Returned to Budget Planning Analyst" ||
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
          label: "Return to Budget Approver",
          value: "analyst-return",
          icon: <RejectIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET OFFICER actions
    if (
      userRoles.includes("BUDGET OFFICER") &&
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
          label: "Return to Budget Planning Analyst",
          value: "officer-return",
          icon: <RejectIcon />,
          color: "warning",
        }
      );
    }

    // BUDGET MANAGER actions
    if (
      userRoles.includes("BUDGET MANAGER") &&
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
          label: "Return to Budget Officer",
          value: "manager-return",
          icon: <RejectIcon />,
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
    FORWARDED_TO_BRD_ANALYST: "Forwarded to Budget Planning Analyst",
    FORWARDED_TO_BRD_OFFICER: "Forwarded to Budget Officer",
    FORWARDED_TO_BRD_MANAGER: "Forwarded to Overall Budget Approver",
    FINALIZED: "Finalized",
    RETURNED_TO_PREPARER: "Returned to Preparer",
    RETURNED_TO_REVIEWER: "Returned to Reviewer",
    RETURNED_TO_APPROVER: "Returned to Approver",
    RETURNED_TO_PLANNING_ANALYST: "Returned to Budget Planning Analyst",
    RETURNED_TO_OFFICER: "Returned to Budget Officer",
    RETURNED: "Returned",
  };

  const filteredProposals = proposals.filter((proposal) => {
    const matchesSearch =
      searchQuery === "" ||
      proposal.responsibilityCenter
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      proposal.division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.budgetType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.status?.toLowerCase().includes(searchQuery.toLowerCase());

    // Map the filter enum to actual database status and do case-insensitive comparison
    const filterDbStatus = statusEnumToDbMap[filterStatus];
    const matchesFilter =
      filterStatus === "all" || 
      (proposal.status && filterDbStatus && 
        proposal.status.toLowerCase() === filterDbStatus.toLowerCase());

    // Debug logging for filter issues
    if (filterStatus !== "all" && !matchesFilter && proposal) {
      console.log(`Filter debug - filterStatus: ${filterStatus}, filterDbStatus: ${filterDbStatus}, proposal.status: ${proposal.status}`);
    }

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    console.log("Capital Outlay Data:", proposalDetails?.capitalOutlay);
  }, [proposalDetails]);
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
            {resolvedWorkflowRef && (
              <Box
                sx={{
                  bgcolor: "#1f3d1f",
                  border: "1px solid #486848",
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: "200px",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.6rem",
                    letterSpacing: 1,
                    color: "#bcd8bc",
                  }}
                >
                  ACTIVE WORKFLOW REF
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {resolvedWorkflowRef}
                </Typography>
              </Box>
            )}
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
                onClick={fetchProposals}
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

      {/* Monitoring Metrics Cards - Displayed Above Tabs */}
      {tabs[activeTab].value === "monitoring" && monitoringMetrics && (
        <Box sx={{ mx: 2, mt: 2, mb: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: "#2d5016" }}>
              Proposal Status Overview
            </Typography>
            <Grid container spacing={3} sx={{ justifyContent: "flex-start" }}>
              {Object.entries(monitoringMetrics.byStatus || {}).map(
                ([status, count]) => {
                  // Convert enum status to readable format
                  const statusLabels = {
                    'FORWARDED_TO_BRD_ANALYST': 'Forwarded to Planning Analyst',
                    'FORWARDED_TO_BRD_OFFICER': 'Forwarded to Budget Officer',
                    'FORWARDED_TO_BRD_MANAGER': 'Forwarded to Manager',
                    'RETURNED_TO_PLANNING_ANALYST': 'Returned to Analyst',
                    'RETURNED_TO_OFFICER': 'Returned to Officer',
                    'FINALIZED': 'Finalized'
                  };
                  const displayStatus = statusLabels[status] || status;

                  return (
                    <Grid item xs={12} sm={12} md={6} lg={6} key={status} sx={{ display: "flex" }}>
                      <Card
                        elevation={2}
                        sx={{
                          borderLeft: "6px solid #375e38",
                          borderRadius: "8px",
                          transition: "all 0.3s ease",
                          width: "100%",
                          minHeight: "140px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          "&:hover": {
                            elevation: 4,
                            boxShadow: "0 8px 16px rgba(55, 94, 56, 0.15)",
                            transform: "translateY(-2px)"
                          }
                        }}
                      >
                        <CardContent sx={{ py: 5, px: 3, textAlign: "center" }}>
                          <Typography
                            variant="body1"
                            sx={{
                              fontWeight: 600,
                              color: "#2d5016",
                              mb: 2.5,
                              fontSize: "1.1rem",
                              lineHeight: 1.6,
                              minHeight: "4rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            {displayStatus}
                          </Typography>
                          <Typography
                            variant="h2"
                            sx={{
                              m: 0,
                              fontWeight: 700,
                              color: "#375e38",
                              fontSize: "3.5rem",
                              lineHeight: 1
                            }}
                          >
                            {count}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                }
              )}
              {/* Total Monitored Card */}
              <Grid item xs={12} sm={12} md={6} lg={6} sx={{ display: "flex" }}>
                <Card
                  elevation={3}
                  sx={{
                    borderLeft: "6px solid #2d5016",
                    bgcolor: "#f4f7f4",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #f4f7f4 0%, #e8f1e8 100%)",
                    width: "100%",
                    minHeight: "140px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center"
                  }}
                >
                  <CardContent sx={{ py: 5, px: 3, textAlign: "center" }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 700,
                        color: "#2d5016",
                        mb: 2.5,
                        fontSize: "1.1rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        minHeight: "4rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      Total Monitored
                    </Typography>
                    <Typography
                      variant="h2"
                      sx={{
                        m: 0,
                        fontWeight: 700,
                        color: "#375e38",
                        fontSize: "3.5rem",
                        lineHeight: 1
                      }}
                    >
                      {monitoringMetrics.total || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
          <Divider sx={{ my: 2 }} />
        </Box>
      )}

      {/* Tabs and Table Container */}
      <Box sx={{ mx: 2, mt: 1.5, mb: 0 }}>
        <Paper
          sx={{
            boxShadow: "none",
            borderRadius: "0px",
            overflow: "hidden",
            border: "none",
            transition: "all 0.2s ease",
            bgcolor: BRAND_COLORS.darkGreen,
          }}
        >
          {/* Tabs Header with Green Background */}
          <Box
            sx={{
              background: BRAND_COLORS.darkGreen,
              color: "white",
              px: 1,
              py: 1,
              display: "flex",
              gap: 0,
              alignItems: "stretch",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            {tabs
              .filter((tab) => {
                if (tab.value === "my-proposals" && isBRDUser) return false;
                return true;
              })
              .map((tab, index) => {
                const tabIndex = tabs.findIndex((t) => t.value === tab.value);
                const isActive = activeTab === tabIndex;
                return (
                  <Box
                    key={index}
                    onClick={() => handleTabChange(null, tabIndex)}
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
                        index <
                        tabs.filter(
                          (t) => !(t.value === "my-proposals" && isBRDUser)
                        ).length -
                          1
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
              <Chip
                label={`${filteredProposals.length} Result${
                  filteredProposals.length !== 1 ? "s" : ""
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
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 6,
                }}
              >
                <CircularProgress sx={{ color: "#2d5016", mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Loading proposals...
                </Typography>
              </Box>
            ) : filteredProposals.length === 0 ? (
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
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProposals
                        .slice(
                          page * rowsPerPage,
                          page * rowsPerPage + rowsPerPage
                        )
                        .map((proposal, index) => (
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
                            }}
                          >
                            <TableCell
                              sx={{
                                p: 2,
                                fontSize: "0.85rem",
                                borderRight: "1px solid #e8e8e8",
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, color: "#333" }}
                              >
                                {proposal.responsibilityCenter ||
                                  proposal.division ||
                                  "N/A"}
                              </Typography>
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
                                sx={{ fontWeight: 600, color: "#1976d2" }}
                              >
                                ₱
                                {(proposal.projectedCorporateIncome || proposal.totalIncome || 0).toLocaleString(
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
                                sx={{ fontWeight: 600, color: "#d32f2f" }}
                              >
                                ₱
                                {(
                                  proposal.projectedSubsidy ||
                                  proposal.totalExpenses ||
                                  0
                                ).toLocaleString("en-US", {
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
                                  color: "#2d5016",
                                  fontSize: "0.95rem",
                                }}
                              >
                                ₱
                                {(
                                  proposal.proposedBudget ||
                                  proposal.totalExpenses +
                                    proposal.totalIncome ||
                                  proposal.amount ||
                                  0
                                ).toLocaleString("en-US", {
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
                                      onClose={() => setActionMenuAnchor(null)}
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
                                      {availableActionsForMenu.map((action) => (
                                        <MenuItem
                                          key={action.value}
                                          onClick={async () => {
                                            setActionType(action.value);
                                            setActionMenuAnchor(null);
                                            if (
                                              action.value === "view-details"
                                            ) {
                                              await handleViewDetails(proposal);
                                            } else if (
                                              action.value === "view-history"
                                            ) {
                                              setSelectedProposal(proposal);
                                              setHistoryPage(0);
                                              setHistoryDialogOpen(true);
                                            } else if (
                                              action.value ===
                                              "view-audit-trail"
                                            ) {
                                              await handleViewAuditTrail(
                                                proposal
                                              );
                                            } else {
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
                                                ? "#2d5016"
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
                                                  ? "#fff3e0"
                                                  : action.color === "success"
                                                  ? "#e8f5e9"
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
                                                  ? "#2d5016"
                                                  : action.color === "warning"
                                                  ? "#f57c00"
                                                  : action.color === "success"
                                                  ? "#388e3c"
                                                  : "#2d5016",
                                            }}
                                          >
                                            {action.icon}
                                          </Box>
                                          {action.label}
                                        </MenuItem>
                                      ))}
                                    </Menu>
                                  </>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 0.75, width: "100%" }}>
                  <TablePagination
                    component="div"
                    count={filteredProposals.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
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
        onClose={() => setActionDialogOpen(false)}
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
            bgcolor: "#2d5016",
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
            Are you sure you want to perform this action on the proposal?
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
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setActionDialogOpen(false)}
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
            disabled={actionType?.includes("return") && !actionComment.trim()}
            sx={{
              bgcolor: "#2d5016",
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 3,
              boxShadow: "0 2px 8px rgba(45,80,22,0.3)",
              "&:hover": {
                bgcolor: "#4a7c2c",
                boxShadow: "0 4px 12px rgba(45,80,22,0.4)",
              },
              "&:disabled": {
                bgcolor: "#ccc",
                color: "#666",
              },
            }}
          >
            Confirm Action
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
        }}
        maxWidth="lg"
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
            bgcolor: "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
            background: "linear-gradient(135deg, #2d5016 0%, #375e38 100%)",
            color: "white",
            fontWeight: "bold",
            fontSize: "1.25rem",
            p: 3,
          }}
        >
          Proposal Details
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {detailsLoading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 6,
              }}
            >
              <CircularProgress sx={{ color: "#2d5016" }} />
            </Box>
          ) : (
            <>
              {/* Proposal Summary */}
              <Box
                sx={{
                  p: 3,
                  bgcolor: "#f5f5f5",
                  borderBottom: "1px solid #e0e0e0",
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Responsibility Center
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedProposal?.responsibilityCenter ||
                        selectedProposal?.division ||
                        "N/A"}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Fiscal Year
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {selectedProposal?.fiscalYear}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Budget Type
                    </Typography>
                    <Chip
                      label={selectedProposal?.budgetType?.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: "#012014ff",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Projected Income
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#1976d2" }}
                    >
                      ₱
                      {(selectedProposal?.totalIncome || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 }
                      )}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Projected Subsidy
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, color: "#d32f2f" }}
                    >
                      ₱
                      {(
                        selectedProposal?.projectedSubsidy ||
                        selectedProposal?.totalExpenses ||
                        0
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Proposed Budget
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: "bold",
                        color: "#2d5016",
                        fontSize: "1.1rem",
                      }}
                    >
                      ₱
                      {(
                        selectedProposal?.proposedBudget ||
                        selectedProposal?.amount ||
                        0
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </Typography>
                  </Grid>
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

                {/* Save button for reviewers if changes made */}
                {canUserEdit() && changedItems.size > 0 && (
                  <Box
                    sx={{
                      mt: 3,
                      pt: 2,
                      borderTop: "1px solid #e0e0e0",
                      display: "flex",
                      gap: 2,
                    }}
                  >
                    <Button
                      variant="contained"
                      sx={{
                        bgcolor: "#2d5016",
                        "&:hover": { bgcolor: "#1e3a0f" },
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
                  </Box>
                )}

                {/* Inline Proposal Details Edit (Budget Preparer owner while Draft) */}
                {(() => {
                  if (!selectedProposal) return null;
                  const userRoles = currentUser?.Roles || [];
                  const isPreparer = userRoles.some((r) =>
                    ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(r)
                  );
                  const draftStatuses = [
                    "DRAFT",
                    "Draft",
                    "Returned to Preparer",
                    "RETURNED_TO_PREPARER",
                  ];
                  const userName =
                    currentUser?.name ||
                    `${currentUser?.FirstName || ""} ${
                      currentUser?.LastName || ""
                    }`.trim();
                  const isOwnerByName =
                    selectedProposal?.processBy &&
                    userName &&
                    selectedProposal.processBy === userName;
                  const isOwnerById =
                    selectedProposal?.createdBy &&
                    (currentUser?.id || currentUser?._id)
                      ? String(selectedProposal.createdBy) ===
                        String(currentUser.id || currentUser?._id)
                      : false;
                  const canEditMeta =
                    isPreparer &&
                    draftStatuses.includes(selectedProposal.status) &&
                    (isOwnerByName || isOwnerById);
                  if (!canEditMeta) return null;
                  return (
                    <Box sx={{ mt: 4, pt: 3, borderTop: "2px dashed #d0d0d0" }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, mb: 2, color: "#2d5016" }}
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
                            bgcolor: proposalEditDirty ? "#2d5016" : "#9e9e9e",
                            "&:hover": {
                              bgcolor: proposalEditDirty
                                ? "#1e3a0f"
                                : "#757575",
                            },
                          }}
                          onClick={async () => {
                            try {
                              const payload = {
                                title: proposalEditValues.title,
                                description: proposalEditValues.description,
                              };
                              await api.put(
                                `/api/new-proposal-workflow/proposals/${selectedProposal._id}`,
                                payload
                              );
                              toast.success("Proposal details updated");
                              setSelectedProposal((prev) =>
                                prev ? { ...prev, ...payload } : prev
                              );
                              setProposals((prev) =>
                                prev.map((p) =>
                                  p._id === selectedProposal._id
                                    ? { ...p, ...payload }
                                    : p
                                )
                              );
                              setProposalEditDirty(false);
                              queryClient.invalidateQueries({ queryKey: ["serverNotifications"] });
                            } catch (err) {
                              console.error(
                                "Error updating proposal details",
                                err
                              );
                              toast.error("Failed to update proposal details");
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
              <Tabs
                value={detailsTab}
                onChange={(e, newValue) => setDetailsTab(newValue)}
                sx={{
                  borderBottom: "1px solid #e0e0e0",
                  bgcolor: "white",
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    minWidth: 120,
                    "&.Mui-selected": {
                      color: "#2d5016",
                    },
                  },
                  "& .MuiTabs-indicator": {
                    bgcolor: "#2d5016",
                    height: 3,
                  },
                }}
              >
                <Tab label="Income" value="income" />
                <Tab label="PS-Permanent" value="ps-permanent" />
                <Tab label="PS-Casual" value="ps-casual" />
                <Tab label="PS-Charged" value="ps-charged" />
                <Tab label="MOOE" value="mooe" />
                <Tab label="Capital Outlay" value="capital-outlay" />
              </Tabs>

              {/* Tab Content */}
              <Box
                sx={{ p: 3, minHeight: 300, maxHeight: 500, overflow: "auto" }}
              >
                {/* Income Tab */}
                {detailsTab === "income" &&
                  (proposalDetails?.income?.length > 0 ? (
                    <>
                      {(() => {
                        const groupedIncome = proposalDetails.income.reduce(
                          (acc, item) => {
                            const category = item.category || "Uncategorized";
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(item);
                            return acc;
                          },
                          {}
                        );

                        return Object.entries(groupedIncome).map(
                          ([category, items]) => {
                            const categoryTotal = items.reduce(
                              (sum, item) => sum + (item.amount || 0),
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
                                    bgcolor: "#2d5016",
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: "#3d6026" },
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
                                  <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 700 }}
                                  >
                                    ₱
                                    {categoryTotal.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </Typography>
                                </Box>

                                {isExpanded && (
                                  <TableContainer sx={{ mt: 1 }}>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Item
                                          </TableCell>
                                          <TableCell
                                            sx={{ fontWeight: "bold" }}
                                          >
                                            Description
                                          </TableCell>
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
                                        {items.map((item, idx) => {
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
                                              <TableCell>
                                                {item.description || "N/A"}
                                              </TableCell>
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
                                                    onChange={(e) => {
                                                      const numValue =
                                                        parseFloat(
                                                          e.target.value.replace(
                                                            /,/g,
                                                            ""
                                                          )
                                                        );
                                                      if (!isNaN(numValue)) {
                                                        handleEditItemAmount(
                                                          "income",
                                                          globalIndex,
                                                          numValue
                                                        );
                                                      }
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
                                                    { minimumFractionDigits: 2 }
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
                          sx={{ fontWeight: "bold", color: "#1976d2" }}
                        >
                          Grand Total: ₱
                          {editableItems.income
                            .reduce((sum, item) => sum + (item.amount || 0), 0)
                            .toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No income data available
                      </Typography>
                    </Box>
                  ))}

                {/* PS-Permanent Tab */}
                {detailsTab === "ps-permanent" && (() => {
                  const permanentPersonnel = proposalDetails?.personnel?.filter(
                    person => person.statusOfAppointment === 'PERMANENT' || person.statusOfAppointment === 'Permanent'
                  ) || [];
                  
                  const paginatedPermanentPersonnel = permanentPersonnel.slice(
                    permanentPersonnelPage * permanentPersonnelRowsPerPage,
                    permanentPersonnelPage * permanentPersonnelRowsPerPage + permanentPersonnelRowsPerPage
                  );

                  return permanentPersonnel.length > 0 ? (
                    <>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                              <TableCell sx={{ width: 50 }}></TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Employee Name
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Position
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                SG
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                STEP
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                JG
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Monthly Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Annual Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                PERA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                RATA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Total
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedPermanentPersonnel.map((item, index) => {
                              const globalIndex = permanentPersonnelPage * permanentPersonnelRowsPerPage + index;
                              const itemKey = `permanent-${globalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel[globalIndex];
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
                                      {item.employeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.monthlySalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "monthlySalary");
                                            }
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
                                        `₱${(item.monthlySalary || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.annualSalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "annualSalary");
                                            }
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
                                        `₱${(item.annualSalary || (item.monthlySalary || 0) * 12).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.PERA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "PERA");
                                            }
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
                                        `₱${(item.PERA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "RATA");
                                            }
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
                                        `₱${(item.RATA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.Total || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue);
                                            }
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
                                        `₱${(item.Total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={11} sx={{ bgcolor: "#fafafa", p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: "#2d5016" }}>
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
                    </>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No permanent personnel services data available
                      </Typography>
                    </Box>
                  );
                })()}

                {/* PS-Casual Tab */}
                {detailsTab === "ps-casual" && (() => {
                  const casualPersonnel = proposalDetails?.personnel?.filter(
                    person => person.statusOfAppointment === 'CASUAL'
                  ) || [];
                  
                  const paginatedCasualPersonnel = casualPersonnel.slice(
                    casualPersonnelPage * casualPersonnelRowsPerPage,
                    casualPersonnelPage * casualPersonnelRowsPerPage + casualPersonnelRowsPerPage
                  );

                  return casualPersonnel.length > 0 ? (
                    <>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                              <TableCell sx={{ width: 50 }}></TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Employee Name
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Position
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                SG
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                STEP
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                JG
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Monthly Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Annual Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                PERA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                RATA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Total
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedCasualPersonnel.map((item, index) => {
                              const globalIndex = casualPersonnelPage * casualPersonnelRowsPerPage + index;
                              const itemKey = `casual-${globalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel[globalIndex];
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
                                      {item.employeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.monthlySalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "monthlySalary");
                                            }
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
                                        `₱${(item.monthlySalary || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.annualSalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "annualSalary");
                                            }
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
                                        `₱${(item.annualSalary || (item.monthlySalary || 0) * 12).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.PERA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "PERA");
                                            }
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
                                        `₱${(item.PERA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "RATA");
                                            }
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
                                        `₱${(item.RATA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.Total || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue);
                                            }
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
                                        `₱${(item.Total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={11} sx={{ bgcolor: "#fafafa", p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: "#2d5016" }}>
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
                    </>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No casual personnel services data available
                      </Typography>
                    </Box>
                  );
                })()}

                {/* PS-Charged to Income Tab */}
                {detailsTab === "ps-charged" && (() => {
                  const chargedToIncomePersonnel = proposalDetails?.personnel?.filter(
                    person => person.chargedToIncomeEligible === true
                  ) || [];
                  
                  const paginatedChargedPersonnel = chargedToIncomePersonnel.slice(
                    chargedPersonnelPage * chargedPersonnelRowsPerPage,
                    chargedPersonnelPage * chargedPersonnelRowsPerPage + chargedPersonnelRowsPerPage
                  );

                  return chargedToIncomePersonnel.length > 0 ? (
                    <>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                              <TableCell sx={{ width: 50 }}></TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Employee Name
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                Position
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                SG
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                STEP
                              </TableCell>
                              <TableCell sx={{ fontWeight: "bold" }}>
                                JG
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Monthly Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Annual Salary
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                PERA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                RATA
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                Total
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedChargedPersonnel.map((item, index) => {
                              const globalIndex = chargedPersonnelPage * chargedPersonnelRowsPerPage + index;
                              const itemKey = `charged-${globalIndex}`;
                              const isChanged = changedItems.has(itemKey);
                              const editedItem = editableItems.personnel[globalIndex];
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
                                      {item.employeeFullName || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.positionTitle || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_SG || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.step || "N/A"}
                                    </TableCell>
                                    <TableCell>
                                      {item.gradelevel_JG || "N/A"}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.monthlySalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "monthlySalary");
                                            }
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
                                        `₱${(item.monthlySalary || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.annualSalary || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "annualSalary");
                                            }
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
                                        `₱${(item.annualSalary || (item.monthlySalary || 0) * 12).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.PERA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "PERA");
                                            }
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
                                        `₱${(item.PERA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.RATA || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue, null, "RATA");
                                            }
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
                                        `₱${(item.RATA || 0).toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                        })}`
                                      )}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                      {canUserEdit() ? (
                                        <TextField
                                          type="text"
                                          size="small"
                                          value={(editedItem?.Total || 0).toLocaleString("en-US", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                          onChange={(e) => {
                                            const numValue = parseFloat(e.target.value.replace(/,/g, ""));
                                            if (!isNaN(numValue)) {
                                              handleEditItemAmount("personnel", globalIndex, numValue);
                                            }
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
                                        `₱${(item.Total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                                      )}
                                    </TableCell>
                                  </TableRow>
                                  {isExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={11} sx={{ bgcolor: "#fafafa", p: 3 }}>
                                        <Grid container spacing={2}>
                                          <Grid item xs={12}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 2, color: "#2d5016" }}>
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
                    </>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No personnel services charged to income available
                      </Typography>
                    </Box>
                  );
                })()}

                {/* MOOE Tab */}
                {detailsTab === "mooe" &&
                  (proposalDetails?.mooe?.length > 0 ? (
                    <>
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
                                    bgcolor: "#2d5016",
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: "#3d6026" },
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
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
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
                                                                onChange={(
                                                                  e
                                                                ) => {
                                                                  const numValue =
                                                                    parseFloat(
                                                                      e.target.value.replace(
                                                                        /,/g,
                                                                        ""
                                                                      )
                                                                    );
                                                                  if (
                                                                    !isNaN(
                                                                      numValue
                                                                    )
                                                                  ) {
                                                                    handleEditItemAmount(
                                                                      "mooe",
                                                                      globalIndex,
                                                                      numValue,
                                                                      "income"
                                                                    );
                                                                  }
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
                                                                onChange={(
                                                                  e
                                                                ) => {
                                                                  const numValue =
                                                                    parseFloat(
                                                                      e.target.value.replace(
                                                                        /,/g,
                                                                        ""
                                                                      )
                                                                    );
                                                                  if (
                                                                    !isNaN(
                                                                      numValue
                                                                    )
                                                                  ) {
                                                                    handleEditItemAmount(
                                                                      "mooe",
                                                                      globalIndex,
                                                                      numValue,
                                                                      "subsidy"
                                                                    );
                                                                  }
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
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No MOOE data available
                      </Typography>
                    </Box>
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
                                    bgcolor: "#2d5016",
                                    color: "white",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: "#3d6026" },
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
                                        <TableRow sx={{ bgcolor: "#f5f5f5" }}>
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
                                                {item.uacsCode || "N/A"}
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
                                                    onChange={(e) => {
                                                      const numValue =
                                                        parseFloat(
                                                          e.target.value.replace(
                                                            /,/g,
                                                            ""
                                                          )
                                                        );
                                                      if (!isNaN(numValue)) {
                                                        handleEditItemAmount(
                                                          "capitalOutlay",
                                                          globalIndex,
                                                          numValue,
                                                          "income"
                                                        );
                                                      }
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
                                                    onChange={(e) => {
                                                      const numValue =
                                                        parseFloat(
                                                          e.target.value.replace(
                                                            /,/g,
                                                            ""
                                                          )
                                                        );
                                                      if (!isNaN(numValue)) {
                                                        handleEditItemAmount(
                                                          "capitalOutlay",
                                                          globalIndex,
                                                          numValue,
                                                          "subsidy"
                                                        );
                                                      }
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
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No capital outlay data available
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: "1px solid #e0e0e0" }}>
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
              bgcolor: "#2d5016",
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              "&:hover": {
                bgcolor: "#4a7c2c",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
            bgcolor: "#2d5016",
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
                    <TableRow sx={{ bgcolor: "#f5f5f5" }}>
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
              bgcolor: "#2d5016",
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              "&:hover": {
                bgcolor: "#4a7c2c",
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
            bgcolor: "#2d5016",
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
          Change Log & Audit Trail
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
                      User / Role
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
                        <div style={{ color: "#666" }}>
                          {change.role?.replace(/_/g, " ") || "N/A"}
                        </div>
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
          sx={{ p: 3, borderTop: "1px solid #e0e0e0", bgcolor: "#f9fafb" }}
        >
          <Button
            onClick={() => setAuditTrailDialogOpen(false)}
            variant="contained"
            sx={{
              bgcolor: "#2d5016",
              color: "white",
              textTransform: "none",
              fontWeight: 600,
              px: 4,
              py: 1.2,
              borderRadius: "6px",
              "&:hover": {
                bgcolor: "#1e3a0f",
                boxShadow: "0 4px 12px rgba(45, 80, 22, 0.2)",
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NewProposalWorkflowPage;
