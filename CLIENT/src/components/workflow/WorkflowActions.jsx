import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { toast } from "react-toastify";
import api from "../../config/api";
import { goTo } from "../../global/navigation";
import { Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Menu, MenuItem, ListItemIcon, ListItemText, Chip, Divider, Stepper, Step, StepLabel, Box, Stack, List, ListItem, Alert } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import UndoIcon from "@mui/icons-material/Undo";
import SendIcon from "@mui/icons-material/Send";
import VerifiedIcon from "@mui/icons-material/Verified";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TimelineIcon from "@mui/icons-material/Timeline";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNotification } from "../../context/NotificationContext";

const MODULE_SUMMARY_LABELS = {
  personnel: 'Personnel Services',
  mooe: 'Maintenance and Other Operating Expenses (MOOE)',
  capital: 'Capital Outlay',
  income: 'Income'
};

/**
 * Workflow Actions Component
 * 
 * Provides action buttons for the role-based workflow based on user role and current status:
 * Draft → Division Submitted → Forwarded to Officer → Officer Approved → Forwarded to Manager → Finalized
 */
const WorkflowActions = forwardRef(({ proposal, userInfo, onRefresh, onView, showHeader = true, showTrackInMenu = true, showViewInMenu = true, getTableData }, ref) => {
  const [loading, setLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState(Array.isArray(proposal?.workflowHistory) ? proposal.workflowHistory : []);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFetchedAt, setHistoryFetchedAt] = useState(null);
  const [blockDialog, setBlockDialog] = useState({
    open: false,
    message: '',
    missingModules: [],
    details: {},
    requiresIncome: false,
    requirementMessage: ''
  });
  const { refreshNotifications } = useNotification();
  const proposalId = proposal?._id;
  const historyMetaRef = useRef({
    fetchedAt: historyFetchedAt,
    itemsLength: historyItems.length
  });

  useEffect(() => {
    historyMetaRef.current.itemsLength = historyItems.length;
  }, [historyItems.length]);

  useEffect(() => {
    historyMetaRef.current.fetchedAt = historyFetchedAt;
  }, [historyFetchedAt]);

  useEffect(() => {
    if (Array.isArray(proposal?.workflowHistory)) {
      setHistoryItems(proposal.workflowHistory);
    } else if (!proposalId) {
      setHistoryItems([]);
    }
  }, [proposalId, proposal?.workflowHistory]);

  const fetchHistory = useCallback(async ({ force = false } = {}) => {
    if (!proposalId) return;
    const now = Date.now();
    const lastFetched = historyMetaRef.current.fetchedAt;
    const hasCached = historyMetaRef.current.itemsLength > 0;
    if (!force && lastFetched && (now - lastFetched < 15000) && hasCached) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await api.get(`/api/workflow/history/${proposalId}`);
      const payload = response?.data?.history || response?.data?.workflowHistory || response?.data;
      const normalized = Array.isArray(payload) ? payload : [];
      setHistoryItems(normalized);
      setHistoryFetchedAt(now);
      historyMetaRef.current = {
        fetchedAt: now,
        itemsLength: normalized.length
      };
    } catch (error) {
      console.error('Failed to load workflow history:', error);
      setHistoryError(error?.response?.data?.message || error.message || 'Unable to load workflow history');
    } finally {
      setHistoryLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    if (proposalId) {
      fetchHistory({ force: true });
    }
  }, [proposalId, fetchHistory]);

  // Top-level render log to confirm component renders
  console.log('WorkflowActions Render:', {
    proposalId: proposal?._id,
    status: proposal?.status,
    userLevelRaw: (userInfo?.assignmentLevel || userInfo?.accessScope || userInfo?.scope || '').toUpperCase(),
    roles: userInfo?.workflowRoles || []
  });

  const normalizeRoleValue = useCallback((roleValue) => {
    if (!roleValue || typeof roleValue !== 'string') return '';
    const normalized = roleValue.trim().toUpperCase().replace(/\s+/g, '_');
    const camelCaseNormalized = normalized.replace(/[^A-Z0-9_]/g, '_');

    const roleSynonyms = {
      ANALYST: 'PREPARER',
      BUDGET_ANALYST: 'PREPARER',
      BUDGET_OFFICER_ANALYST: 'PREPARER',
      BA: 'PREPARER',
      OFFICE_ANALYST: 'PREPARER',
      ANALYST_OFFICER: 'PREPARER',
      RESPONSIBILITY_CENTER: 'PREPARER',
      RC: 'PREPARER',

      REVIEWER: 'APPROVER',
      BUDGET_REVIEWER: 'APPROVER',
      BUDGETREVIEWER: 'APPROVER',
      REV: 'APPROVER',
      DIVISION_REVIEWER: 'APPROVER',
      DIVISIONAPPROVER: 'APPROVER',
      DIVISION_APPROVER: 'APPROVER',
      DIVISIONVERIFIER: 'APPROVER',
      DIVISION_VERIFIER: 'APPROVER',

      BUDGET_OFFICER: 'BUDGET_OFFICER',
      BUDGETOFFICER: 'BUDGET_OFFICER',
      OFFICER: 'BUDGET_OFFICER',
      BUDGET_SPECIALIST: 'BUDGET_OFFICER',
      OFFICE_VERIFIER: 'BUDGET_OFFICER',
      OFFICEVERIFIER: 'BUDGET_OFFICER',
      OFFICE_APPROVER: 'APPROVER',
      OFFICEAPPROVER: 'APPROVER',
      OFFICE_CONSOLIDATOR: 'BUDGET_OFFICER',
      BUDGET_SUPERVISOR: 'BUDGET_OFFICER',

      BUDGET_PLANNING_ANALYST: 'BUDGET_PLANNING_ANALYST',
      BUDGETANALYST: 'BUDGET_PLANNING_ANALYST',
      PLANNING_ANALYST: 'BUDGET_PLANNING_ANALYST',

      BUDGETMANAGER: 'BUDGET_MANAGER',
      BUDGET_MANAGER: 'BUDGET_MANAGER',
      BUDGET_OFFICE_HEAD: 'BUDGET_MANAGER',
      BUDGET_DIRECTOR: 'BUDGET_MANAGER',
      FINAL_APPROVER: 'BUDGET_MANAGER',
      MANAGER_APPROVER: 'BUDGET_MANAGER',
      MANAGERAPPROVER: 'BUDGET_MANAGER',
      REGION_FINAL_VERIFIER: 'BUDGET_MANAGER',
      REGIONAL_FINAL_VERIFIER: 'BUDGET_MANAGER',
      REGION_MANAGER: 'BUDGET_MANAGER',
      OVERALL_APPROVER: 'BUDGET_MANAGER',
      OVERALL_BUDGET_APPROVER: 'BUDGET_MANAGER',

      BUDGETADMIN: 'BUDGET_ADMIN',
      FULL: 'BUDGET_MANAGER'  // Map 'FULL' to manager role
    };

    const result = roleSynonyms[camelCaseNormalized] || camelCaseNormalized;
    
    // Debug log for mapping issues
    if (roleValue && ['FULL', 'REGIONAL_FINAL_VERIFIER', 'REGION_FINAL_VERIFIER'].includes(camelCaseNormalized)) {
      console.log(`🔄 Role Mapping: "${roleValue}" → normalized: "${camelCaseNormalized}" → final: "${result}"`);
    }
    
    return result;
  }, []);

  const {
    rawRoleSources,
    rawRoles,
    roleMapping,
    normalizedRoles
  } = useMemo(() => {
    const sources = [
      userInfo?.roles,
      userInfo?.Roles,
      userInfo?.role,
      userInfo?.currentUser?.roles,
      userInfo?.currentUser?.Roles,
      userInfo?.currentUser?.role,
      userInfo?.currentUser?.budgetRoles,
      userInfo?.hierarchicalAccess?.roles,
      userInfo?.hierarchicalAccess?.Roles,
      userInfo?.hierarchicalAccess?.role,
      userInfo?.additionalRoles,
      userInfo?.budgetRoles,
      userInfo?.workflowRoles,
      userInfo?.access?.roles,
      userInfo?.access?.Roles,
      userInfo?.access?.role,
      userInfo?.assignmentLevel,
      userInfo?.accessScope,
      userInfo?.scope
    ];

    const flattened = sources
      .flatMap((value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
      })
      .filter((value) => typeof value === 'string' && value.trim().length > 0);

    const mapping = flattened.map(role => ({
      original: role,
      normalized: normalizeRoleValue(role)
    }));

    const normalized = Array.from(new Set(
      flattened
        .map((roleValue) => normalizeRoleValue(roleValue))
        .filter(Boolean)
    ));

    return {
      rawRoleSources: sources,
      rawRoles: flattened,
      roleMapping: mapping,
      normalizedRoles: normalized
    };
  }, [userInfo, normalizeRoleValue]);

  // Helper function to determine entity type based on proposal modelType
  const getEntityType = (proposal) => {
    switch (proposal.modelType) {
      case 'mooe':
        return 'mooe';
      case 'capital':
        return 'capital';
      case 'income':
        return 'income';
      case 'personnel':
        return 'personnel';
      default:
        return 'personnel'; // fallback
    }
  };

  // Determine what actions are available based on user role and proposal status
  const getAvailableActions = () => {
    const actions = [];
    const status = proposal?.status;
    const normalizedStatus = String(status || '').toUpperCase().trim();

    // Check if user has the required role for actions
    const isPreparer = normalizedRoles.includes('PREPARER');
    const isBudgetReviewer = normalizedRoles.includes('BUDGET_REVIEWER');
    const isApprover = normalizedRoles.includes('APPROVER');
    const isBudgetPlanningAnalyst = normalizedRoles.includes('BUDGET_PLANNING_ANALYST');
    const isBudgetOfficer = normalizedRoles.includes('BUDGET_OFFICER');
    const isOverallApprover = normalizedRoles.includes('BUDGET_MANAGER');
    const isBudgetAdmin = normalizedRoles.includes('BUDGET_ADMIN');

    // ROLE HIERARCHY PROTECTION: Use highest role in hierarchy
    // Hierarchy: PREPARER < REVIEWER < APPROVER < BUDGET_PLANNING_ANALYST < BUDGET_OFFICER < MANAGER
    // Only block higher actions if user has ONLY PREPARER role
    const isPreparerOnly = isPreparer && !isBudgetReviewer && !isApprover && !isBudgetPlanningAnalyst && !isBudgetOfficer && !isOverallApprover && !isBudgetAdmin;
    const hasHigherRole = isBudgetReviewer || isApprover || isBudgetPlanningAnalyst || isBudgetOfficer || isOverallApprover || isBudgetAdmin;
    
    // Block manager actions only if user is PREPARER ONLY (no other roles)
    const shouldBlockManagerActions = isPreparerOnly;
    // Block officer actions only if user is PREPARER ONLY (no other roles)
    const shouldBlockOfficerActions = isPreparerOnly;

    console.log('🔍 WorkflowActions Debug:', {
      status,
      normalizedStatus,
      rawRoleSources,
      rawRoles,
      roleMapping,
      normalizedRoles,
      isPreparer,
      isBudgetReviewer,
      isApprover,
      isBudgetPlanningAnalyst,
      isBudgetOfficer,
      isOverallApprover,
      isBudgetAdmin,
      isPreparerOnly,
      shouldBlockManagerActions,
      shouldBlockOfficerActions,
      proposalId: proposal?._id,
      userInfo: {
        roles: userInfo?.roles,
        Roles: userInfo?.Roles,
        role: userInfo?.role
      }
    });

  // PREPARER Actions (Draft control & submission)
    if (isPreparer) {
      const isDraft = normalizedStatus === 'DRAFT' || status === 'Draft';
      const isReturnedToAnalyst = normalizedStatus === 'RETURNED' || (status === 'Returned' && proposal?.workflowLevel === 'ANALYST');

      if (isDraft || isReturnedToAnalyst) {
        actions.push({
          label: 'Submit to Budget Reviewer',
          action: 'submit-to-reviewer',
          color: 'bg-blue-500 hover:bg-blue-600',
          icon: '📤',
          description: 'Forward proposal to Budget Reviewer for review',
          requiresComment: true
        });

        // ❌ FIXED: Removed escalation bypass for PREPARER role
        // PREPARER users should ONLY submit to REVIEWER (next workflow step)
        // They must follow the standard workflow: PREPARER → REVIEWER → APPROVER → ...
        // If user has BUDGET_REVIEWER role too, they handle that at the REVIEWER level, not PREPARER level
      }
    }

  // BUDGET REVIEWER Actions (Review & routing)
    if (isBudgetReviewer) {
      // Can review and edit proposals submitted by analysts
      if (normalizedStatus === 'DIVISION SUBMITTED' || status === 'Division Submitted' || 
          normalizedStatus === 'RESPONSIBILITY CENTER SUBMITTED') {
        actions.push({
          label: 'Save Edits',
          action: 'reviewer-save-edits',
          color: 'bg-gray-500 hover:bg-gray-600',
          icon: '💾',
          description: 'Save changes without forwarding',
          requiresComment: false,
          allowOptionalComment: true
        });
        actions.push({
          label: 'Approve & Forward to Budget Approver',
          action: 'reviewer-approve-forward-approver',
          color: 'bg-green-500 hover:bg-green-600',
          icon: '✅',
          description: 'Approve and forward to Budget Approver for verification',
          requiresComment: true
        });
        actions.push({
          label: 'Submit to Officer (Skip Budget Approver)',
          action: 'reviewer-submit-to-officer',
          color: 'bg-purple-500 hover:bg-purple-600',
          icon: '⚡',
          description: 'Submit proposal directly to Budget Officer (bypasses Budget Approver review)',
          requiresComment: true
        });
        actions.push({
          label: 'Return to Analyst',
          action: 'reviewer-return',
          color: 'bg-red-500 hover:bg-red-600',
          icon: '↩️',
          description: 'Send back to analyst for revisions',
          requiresComment: true
        });
      }
    }

  // APPROVER Actions (Division/Office Budget Approver Level)
    if (isApprover) {
      // Can review and edit proposals forwarded by reviewer (but NOT when already approved)
      if (normalizedStatus === "FORWARDED TO APPROVER" || status === "Forwarded to Approver" ||
          normalizedStatus === "DIVISION SUBMITTED" || status === "Division Submitted") {
        actions.push({
          label: "Save Edits",
          action: "approver-save-edits",
          color: "bg-gray-500 hover:bg-gray-600",
          icon: "💾",
          description: "Save changes without forwarding",
          requiresComment: false,
          allowOptionalComment: true
        });
        actions.push({
          label: "Approve & Forward to Budget Planning Analyst",
          action: "approver-approve-forward-analyst",
          color: "bg-green-500 hover:bg-green-600",
          icon: "✅",
          description: "Approve and forward to Budget Planning Analyst for review",
          requiresComment: true
        });
        actions.push({
          label: "Submit to Budget Officer (Skip Analyst)",
          action: "approver-submit-to-officer",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "⚡",
          description: "Submit proposal directly to Budget Officer (bypasses Analyst review)",
          requiresComment: true
        });
        actions.push({
          label: "Return to Budget Reviewer",
          action: "approver-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Send back to Budget Reviewer for revisions",
          requiresComment: true
        });
      }
    }

    // BUDGET OFFICER Actions (Final Approval Level)
    if (isBudgetOfficer && !shouldBlockOfficerActions) {
      // Can review and edit proposals forwarded by approver
      if (normalizedStatus === "FORWARDED TO OFFICER" || status === "Forwarded to Officer" ||
          normalizedStatus === "OFFICER APPROVED" || status === "Officer Approved" ||
          normalizedStatus === "APPROVER APPROVED" || status === "Approver Approved") {
        actions.push({
          label: "Save Edits",
          action: "officer-save-edits",
          color: "bg-gray-500 hover:bg-gray-600",
          icon: "💾",
          description: "Save changes without forwarding",
          requiresComment: false,
          allowOptionalComment: true
        });
        actions.push({
          label: "Approve",
          action: "officer-approve",
          color: "bg-green-500 hover:bg-green-600",
          icon: "✅",
          description: "Approve the proposal submission",
          requiresComment: true
        });
        actions.push({
          label: "Return to Budget Approver",
          action: "officer-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal to Budget Approver for revisions",
          requiresComment: true
        });
      }
      
      // After approval, officer can submit to manager (ONLY when already approved)
      if (normalizedStatus === "OFFICER APPROVED" || status === "Officer Approved") {
        actions.push({
          label: "Submit to Manager",
          action: "officer-submit-to-manager",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "📋",
          description: "Submit approved proposal to Budget Manager",
          requiresComment: true
        });
      }
    }

    // BUDGET MANAGER & BUDGET ADMIN Actions (Finalization Level)
    if ((isOverallApprover || isBudgetAdmin) && !shouldBlockManagerActions) {
      const managerStatuses = [
        'FORWARDED TO MANAGER',
        'OFFICER APPROVED'
      ];

      if (managerStatuses.includes(normalizedStatus) ||
          ['Forwarded to Manager', 'Officer Approved'].includes(status)) {
        actions.push({
          label: "Save Edits",
          action: "manager-save-edits",
          color: "bg-gray-500 hover:bg-gray-600",
          icon: "💾",
          description: "Save changes without finalizing",
          requiresComment: false,
          allowOptionalComment: true
        });
        actions.push({
          label: "Finalize",
          action: "manager-approve",
          color: "bg-teal-500 hover:bg-teal-600",
          icon: "✔",
          description: "Approve proposal for finalization",
          requiresComment: true
        });
        actions.push({
          label: "Return",
          action: "manager-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal for revisions",
          requiresComment: true
        });
      }
    }

    // FALLBACK: If BUDGET_MANAGER and no actions found but status is "Forwarded to Manager", ensure Return action is available
    // This handles cases where role detection might fail but manager user can still perform manager actions
    if (isOverallApprover && !shouldBlockManagerActions && actions.length === 0 && 
        (normalizedStatus === 'FORWARDED TO MANAGER' || status === 'Forwarded to Manager')) {
      console.warn('⚠️ Role detection may have failed, but adding fallback manager actions for "Forwarded to Manager" status');
      actions.push({
        label: "Save Edits",
        action: "manager-save-edits",
        color: "bg-gray-500 hover:bg-gray-600",
        icon: "💾",
        description: "Save changes without finalizing",
        requiresComment: false,
        allowOptionalComment: true
      });
      actions.push({
        label: "Finalize",
        action: "manager-approve",
        color: "bg-teal-500 hover:bg-teal-600",
        icon: "✔",
        description: "Approve proposal for finalization",
        requiresComment: true
      });
      actions.push({
        label: "Return",
        action: "manager-return",
        color: "bg-red-500 hover:bg-red-600",
        icon: "↩️",
        description: "Return proposal for revisions",
        requiresComment: true
      });
    }

    // Log if actions are being blocked due to role hierarchy
    if (shouldBlockManagerActions && (isOverallApprover || isBudgetAdmin)) {
      console.warn('🚫 BLOCKED: Manager actions blocked for BUDGET_ANALYST user (role hierarchy protection active)');
    }
    if (shouldBlockOfficerActions && isBudgetOfficer) {
      console.warn('🚫 BLOCKED: Officer actions blocked for BUDGET_ANALYST user (role hierarchy protection active)');
    }

    console.log('🎯 Available Actions:', actions.length, actions.map(a => a.label));

    return actions;
  };

  const roleLabelMap = useMemo(() => ({
    PREPARER: 'Budget Preparer',
    BUDGET_REVIEWER: 'Budget Reviewer',
    APPROVER: 'Budget Approver',
    BUDGET_PLANNING_ANALYST: 'Budget Planning Analyst',
    BUDGET_OFFICER: 'Budget Officer',
    BUDGET_MANAGER: 'Budget Manager',
    BUDGET_ADMIN: 'Budget Admin'
  }), []);

  const formatRoleLabel = useCallback((role) => {
    if (!role) return 'Unassigned';
    const normalized = String(role).toUpperCase().trim();
    return roleLabelMap[normalized] || normalized.replace(/_/g, ' ');
  }, [roleLabelMap]);

  const formatActionLabel = useCallback((action) => {
    if (!action) return '';
    return action
      .toString()
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  const stepLabelMap = useMemo(() => ({
    ANALYST_DRAFT: { label: 'Analyst Draft', tooltip: 'Draft in progress with Analyst' },
    REVIEWER_REVIEW: { label: 'Reviewer Review', tooltip: 'Awaiting Budget Reviewer action' },
    OFFICER_REVIEW: { label: 'Officer Review', tooltip: 'Awaiting Budget Officer verification' },
    MANAGER_REVIEW: { label: 'Manager Review', tooltip: 'Awaiting Budget Manager decision' },
    RETURNED: { label: 'Returned', tooltip: 'Returned for revisions' },
    FINALIZED: { label: 'Finalized', tooltip: 'Workflow completed' }
  }), []);

  const formatStepLabel = useCallback((step) => {
    if (!step) return 'Draft';
    const normalized = String(step).toUpperCase().trim();
    return stepLabelMap[normalized]?.label || normalized.replace(/_/g, ' ');
  }, [stepLabelMap]);

  const stepTooltip = useCallback((step) => {
    if (!step) return null;
    const normalized = String(step).toUpperCase().trim();
    return stepLabelMap[normalized]?.tooltip || null;
  }, [stepLabelMap]);

  // Determine if this proposal has a manager phase (submitted to manager / manager approved / finalized entries)
  const hasManagerPhase = (() => {
    const directFlags = Boolean(
      proposal?.submittedToManagerAt ||
      proposal?.managerApprovedAt ||
      proposal?.finalizedAt
    );
    const historyFlags = Array.isArray(proposal?.workflowHistory) && proposal.workflowHistory.some(h => {
      const ns = String(h?.newStatus || h?.status || '').toLowerCase();
      return (
        ns.includes('submitted to manager') ||
        ns.includes('manager approved') ||
        ns.includes('manager returned') ||
        ns.includes('finalized')
      );
    });
    return directFlags || historyFlags;
  })();

  // Derive step/assignee/pending from status when new fields are not yet present on older records
  const deriveFromStatus = useCallback((status) => {
    const s = String(status || '').toUpperCase();
    const derived = { step: 'PREPARER_DRAFT', assignee: 'PREPARER', pending: ['PREPARER'] };
    
    // 6-Step Workflow Mapping:
    // 1. Draft → PREPARER
    // 2. Division Submitted → REVIEWER
    // 3. Forwarded to Officer → APPROVER
    // 4. Officer Approved → BUDGET_PLANNING_ANALYST
    // 5. Forwarded to Manager → BUDGET_OFFICER
    // 6. Finalized → OVERALL_BUDGET_APPROVER
    
    if (s.includes('DIVISION SUBMITTED') || s.includes('RESPONSIBILITY CENTER SUBMITTED')) {
      // Step 2: REVIEWER reviews (old BUDGET_COORDINATOR)
      derived.step = 'REVIEWER_REVIEW';
      derived.assignee = 'REVIEWER';
      derived.pending = ['REVIEWER'];
    } else if (s.includes('FORWARDED TO OFFICER') || s === 'OFFICE' || s.includes('OFFICE REVIEW') || s.includes('OFFICE SUBMITTED')) {
      // Step 3: APPROVER reviews (old BUDGET_OFFICER)
      derived.step = 'APPROVER_REVIEW';
      derived.assignee = 'APPROVER';
      derived.pending = ['APPROVER'];
    } else if (s.includes('OFFICER APPROVED')) {
      // Step 4: BUDGET_PLANNING_ANALYST reviews (after officer approval)
      derived.step = 'BUDGET_PLANNING_ANALYST_REVIEW';
      derived.assignee = 'BUDGET_PLANNING_ANALYST';
      derived.pending = ['BUDGET_PLANNING_ANALYST'];
    } else if (s.includes('FORWARDED TO MANAGER') || s.includes('SUBMITTED TO MANAGER')) {
      // Step 5: BUDGET_OFFICER reviews
      derived.step = 'BUDGET_OFFICER_REVIEW';
      derived.assignee = 'BUDGET_OFFICER';
      derived.pending = ['BUDGET_OFFICER'];
    } else if (s.includes('RETURNED')) {
      // Return to PREPARER for revision
      derived.step = 'RETURNED';
      derived.assignee = 'PREPARER';
      derived.pending = ['PREPARER'];
    } else if (s.includes('FINALIZED')) {
      // Step 6: OVERALL_BUDGET_APPROVER finalizes
      derived.step = 'FINALIZED';
      derived.assignee = 'OVERALL_BUDGET_APPROVER';
      derived.pending = [];
    }
    return derived;
  }, []);

  // Pick the newest workflow event by timestamp to avoid ordering assumptions
  const latestEvent = useMemo(() => {
    if (!Array.isArray(historyItems) || historyItems.length === 0) return null;
    let newest = historyItems[0];
    let newestTs = newest?.timestamp ? new Date(newest.timestamp).getTime() : 0;
    for (let i = 1; i < historyItems.length; i++) {
      const ts = historyItems[i]?.timestamp ? new Date(historyItems[i].timestamp).getTime() : 0;
      if (ts > newestTs) {
        newest = historyItems[i];
        newestTs = ts;
      }
    }
    return newest;
  }, [historyItems]);

  // Execute workflow action
  const executeWorkflowAction = async (action, noteValue) => {
    setLoading(true);
    
    let endpoint = "";
    let noteField = "";
    let successMessage = "";
    
    try {
      if (action === 'submit-to-reviewer' && normalizedRoles.includes('BUDGET_PLANNING_ANALYST') && proposal?._id) {
        try {
          const readinessResponse = await api.get(`/api/workflow/submit/prerequisites/${proposal._id}`);
          if (readinessResponse?.data?.success && readinessResponse.data.ready === false) {
            showSubmissionPrerequisiteDialog(readinessResponse.data.readiness, readinessResponse.data.readiness?.message);
            setLoading(false);
            return;
          }
        } catch (precheckError) {
          console.warn('⚠️ Failed to pre-validate analyst submission readiness:', precheckError);
        }
      }

      switch (action) {
        case "submit-to-reviewer":
          endpoint = "/api/workflow/submit";
          successMessage = "Proposal submitted to Budget Reviewer successfully";
          break;
        case "submit-direct-to-manager":
          endpoint = "/api/workflow/submit-direct-to-manager";
          successMessage = "Proposal submitted directly to Budget Manager successfully";
          break;
        case "reviewer-approve":
          endpoint = "/api/workflow/reviewer/approve";
          successMessage = "Proposal approved by Reviewer successfully";
          break;
        case "reviewer-approve-forward-approver":
          endpoint = "/api/workflow/reviewer/approve-and-forward-to-approver";
          successMessage = "Proposal approved and forwarded to Approver successfully";
          break;
        case "reviewer-submit-to-officer":
          endpoint = "/api/workflow/reviewer/submit-to-officer";
          successMessage = "Proposal submitted directly to Budget Officer (bypassed Approver review)";
          break;
        case "reviewer-return":
          endpoint = "/api/workflow/reviewer/return";
          successMessage = "Proposal returned to Preparer successfully";
          break;
        case "reviewer-forward-officer":
          endpoint = "/api/workflow/preparer/submit-to-officer";
          successMessage = "Proposal forwarded to Budget Officer successfully";
          break;
        case "reviewer-submit-to-manager":
          endpoint = "/api/workflow/preparer/submit-to-manager";
          successMessage = "Proposal submitted directly to Budget Manager (bypassing Officer review)";
          break;
        case "reviewer-save-edits":
          endpoint = "/api/workflow/preparer/save-edits";
          successMessage = "Changes saved successfully";
          break;
        case "approver-save-edits":
          endpoint = "/api/workflow/approver/save-edits";
          successMessage = "Changes saved successfully";
          break;
        case "approver-approve-forward-analyst":
          endpoint = "/api/workflow/approver/approve-and-forward-to-analyst";
          successMessage = "Proposal approved and forwarded to Budget Planning Analyst successfully";
          break;
        case "approver-submit-to-officer":
          endpoint = "/api/workflow/approver/submit-to-officer";
          successMessage = "Proposal submitted directly to Budget Officer (bypassed Analyst review)";
          break;
        case "approver-return":
          endpoint = "/api/workflow/approver/return";
          successMessage = "Proposal returned to Reviewer successfully";
          break;
        case "officer-verify":
          endpoint = "/api/workflow/verify";
          successMessage = "Proposal verified successfully";
          break;
        case "officer-approve":
          endpoint = "/api/workflow/officer/approve";
          successMessage = "Proposal approved by Budget Officer successfully";
          break;
        case "officer-return":
          endpoint = "/api/workflow/officer/return";
          successMessage = "Proposal returned to Reviewer successfully";
          break;
        case "officer-submit-to-manager":
          endpoint = "/api/workflow/officer/submit-to-manager";
          successMessage = "Proposal submitted to Budget Manager successfully";
          break;
        case "officer-save-edits":
          endpoint = "/api/workflow/officer/save-edits";
          successMessage = "Changes saved successfully";
          break;
        case "submit-to-manager":
          endpoint = "/api/workflow/consolidate";
          successMessage = "Proposals consolidated and submitted to Budget Manager successfully";
          break;
        case "manager-approve":
          endpoint = "/api/workflow/manager/approve";
          successMessage = "Proposal finalized by Budget Manager successfully";
          break;
        case "manager-return":
          endpoint = "/api/workflow/manager/return";
          successMessage = "Proposal returned for further review";
          break;
        case "manager-save-edits":
          endpoint = "/api/workflow/manager/save-edits";
          successMessage = "Changes saved successfully";
          break;
        // Legacy actions for backward compatibility (deprecated - use standard 6-step workflow actions above)
        // Note: These are kept for database queries and legacy data, but new workflows should use:
        // analyst-submit → "Division Submitted" (step 2)
        // reviewer-approve → "Forwarded to Officer" (step 3)
        // officer-approve → "Officer Approved" (step 4)
        // officer-submit-to-manager → "Forwarded to Manager" (step 5)
        // manager-approve → "Finalized" (step 6)
        case "responsibility-center-submit":
          endpoint = "/api/submission-workflow/responsibility-center/submit-to-office";
          noteField = "submissionNote";
          successMessage = "Successfully submitted to Office for verification";
          break;
        case "office-verify":
          endpoint = "/api/submission-workflow/office/verify-submission";
          noteField = "verificationNote";
          successMessage = "Successfully verified responsibility center submission";
          break;
        case "office-submit":
          // Deprecated: Use officer-submit-to-manager for moving Officer Approved → Forwarded to Manager
          endpoint = "/api/submission-workflow/office/submit-own";
          noteField = "approvalNote";
          successMessage = "Successfully submitted for finalization";
          break;
        case "office-approve":
          endpoint = "/api/submission-workflow/office/approve-submission";
          noteField = "officeApprovalNote";
          successMessage = "Successfully approved submission";
          break;
        case "office-finalize":
          endpoint = "/api/submission-workflow/office/finalize-submission";
          noteField = "finalizationNote";
          successMessage = "Successfully finalized submission";
          break;
        case "office-return":
          endpoint = "/api/submission-workflow/office/return-to-responsibility-center";
          noteField = "returnReason";
          successMessage = "Successfully returned submission to responsibility center for revisions";
          break;
        default:
          throw new Error("Unknown workflow action");
      }

      // Prepare request data based on action
      let requestData = { proposalId: proposal._id };

      if (action === "approver-save-edits") {
        // Send current proposal data as updates for approver draft saving
        const tableData = getTableData ? getTableData() : null;
        requestData = {
          proposalId: proposal._id,
          comment: noteValue || "",
          updates: {
            title: proposal.title,
            description: proposal.description,
            categoryBreakdown: proposal.categoryBreakdown,
            proposedBudget: proposal.proposedBudget,
            totalExpenses: proposal.totalExpenses,
            totalIncome: proposal.totalIncome,
            projectedCorporateIncome: proposal.projectedCorporateIncome,
            projectedSubsidy: proposal.projectedSubsidy,
            cobExpenditures: proposal.cobExpenditures
          },
          ...(tableData && { tableData }) // Include table data if available
        };
      } else if ([
        "submit-to-reviewer",
        "submit-direct-to-manager",
        "reviewer-approve",
        "reviewer-approve-forward-approver",
        "reviewer-submit-to-officer",
        "reviewer-return",
        "approver-approve-forward-analyst",
        "approver-submit-to-officer",
        "approver-return",
        "preparer-submit-to-officer",
        "preparer-submit-to-manager",
        "preparer-save-edits",
        "officer-verify",
        "officer-approve",
        "officer-return",
        "officer-submit-to-manager",
        "officer-save-edits",
        "manager-approve",
        "manager-return",
        "manager-save-edits"
      ].includes(action)) {
        requestData.comment = noteValue;
      } else if (action === "submit-to-manager") {
        // For consolidation, we need multiple proposal IDs and consolidated title
        requestData = {
          proposalIds: [proposal._id], // In a real implementation, this would be selected proposals
          consolidatedTitle: `Consolidated Proposals - ${proposal.department || proposal.division}`,
          fiscalYear: proposal.fiscalYear,
          budgetType: proposal.budgetType
        };
      }

      const response = await api.post(endpoint, requestData);

      const debugPayload = {
        ids: [proposal._id],
        entity: getEntityType(proposal)
      };
      if (noteField) {
        debugPayload[noteField] = noteValue?.trim() || `Workflow action performed on ${new Date().toLocaleString()}`;
      }

      console.log('Workflow API Call Debug:', {
        endpoint,
        requestData: debugPayload,
        proposal: {
          _id: proposal._id,
          modelType: proposal.modelType,
          status: proposal.status,
          originalLevel: proposal.originalLevel
        }
      });

      console.log('🔍 WORKFLOW API RESPONSE DEBUG:');
      console.log('Full Response:', response);
      console.log('Response Data:', response.data);
      console.log('Response Status:', response.status);
      console.log('Response Success Field:', response.data.success);
      console.log('Response Message:', response.data.message);

      // Check for success - be flexible with response format
      // Success if: explicit success=true, or message says "successfully", or status is 200/201
      const isSuccess = response.data.success === true || 
                       response.status === 200 ||
                       response.status === 201 ||
                       response.data.modified > 0 || 
                       response.data.modifiedCount > 0 || 
                       (response.data.message && 
                        response.data.message.toLowerCase().includes('successfully'));

      console.log('🎯 SUCCESS CHECK RESULT:', isSuccess);
      console.log('🎯 SUCCESS DETAILS:', {
        success_field: response.data.success,
        status_code: response.status,
        message: response.data.message,
        has_proposal: !!response.data.proposal
      });

      if (isSuccess) {
        console.log('✅ WORKFLOW ACTION SUCCESSFUL - Starting updates...');
        
        // Show success toast FIRST
        toast.success(successMessage);
        
        // Fetch history in background (don't block on errors)
        console.log('🔄 Fetching workflow history...');
        fetchHistory({ force: true }).catch((histErr) => {
          console.warn('⚠️ Failed to fetch history (non-blocking):', histErr.message);
        });
        
        // Try to show window notification (non-blocking)
        try {
          if (typeof window !== 'undefined' && window.showSuccess) {
            window.showSuccess(successMessage + ' — Click to open All Proposals', 8000, () => {
              goTo('/AllProposals');
            });
          }
        } catch (windowErr) {
          console.warn('⚠️ Failed to show window notification:', windowErr.message);
        }
        
        // Immediate refresh to show updated status in real-time
        console.log('✅ Workflow action successful, triggering immediate refresh...');
        console.log('📦 Response contains updated proposal:', response.data.proposal ? 'YES' : 'NO');
        
        // CRITICAL: Always pass true as second parameter to force cache invalidation
        try {
          if (response.data.proposal) {
            console.log('📤 Passing updated proposal to onRefresh callback with FORCE flag:', {
              status: response.data.proposal.status,
              workflowLevel: response.data.proposal.workflowLevel
            });
            // Pass true to force refresh and ignore cache
            onRefresh(response.data.proposal, true, action); // Pass updated proposal AND force flag for instant update
          } else {
            console.log('📤 No proposal in response, calling onRefresh with force=true');
            onRefresh(null, true, action); // Fallback to force re-fetch without cache
          }
          console.log('✅ onRefresh callback completed successfully');
        } catch (refreshErr) {
          console.error('❌ Error in onRefresh callback:', refreshErr);
          // Don't throw - just log it, we already showed the success toast
          // Try a simple fallback refresh
          try {
            onRefresh(null, true, action);
          } catch (_) {}
        }

        if (typeof refreshNotifications === 'function') {
          refreshNotifications();
        }
      } else {
        throw new Error(response.data.message || "Workflow action failed");
      }
    } catch (error) {
      console.error("Workflow action error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        endpoint: endpoint,
        proposalId: proposal._id
      });

      // Show more specific error messages
      let errorMessage = "Failed to execute workflow action";
      const responseData = error.response?.data;
      if (responseData?.message) {
        errorMessage = responseData.message;
      } else if (responseData?.error) {
        errorMessage = responseData.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      const isPrereqError = responseData?.code === 'ANALYST_SUBMISSION_PREREQUISITES_INCOMPLETE';

      if (isPrereqError) {
        showSubmissionPrerequisiteDialog(responseData, errorMessage);
      } else {
        toast.error(errorMessage);
        try {
          if (typeof window !== 'undefined' && typeof window.showError === 'function') {
            window.showError(errorMessage, 8000);
          }
        } catch (_) {}
      }
    } finally {
      setLoading(false);
    }
  };

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState({ open: false, action: null, label: '', requiresComment: false, allowOptionalComment: false });
  const [comment, setComment] = useState('');
  const forcedCommentActions = new Set([
    'submit-to-reviewer',
    'submit-direct-to-manager',
    'reviewer-approve',
    'reviewer-approve-forward-approver',
    'reviewer-submit-to-officer',
    'reviewer-return',
    'approver-approve-forward-analyst',
    'approver-submit-to-officer',
    'approver-return',
    'preparer-submit-to-officer',
    'preparer-submit-to-manager',
    'officer-verify',
    'officer-approve',
    'officer-return',
    'officer-submit-to-manager',
    'manager-approve',
    'manager-return'
  ]);
  const requiresComment = confirmState.requiresComment || forcedCommentActions.has(confirmState.action);
  const showCommentField = requiresComment || confirmState.allowOptionalComment;

  // Handle action click with MUI confirm dialog
  const handleActionClick = (action, label, requiresComment = false, allowOptionalComment = false) => {
    if (loading) return;
    setConfirmState({ open: true, action, label, requiresComment, allowOptionalComment });
  };

  const handleConfirm = () => {
    if (!confirmState.action) return;
    // For actions that require comments, ensure a comment is provided
    if (requiresComment && !comment.trim()) {
      toast.error('Please provide a comment.');
      return;
    }
    executeWorkflowAction(confirmState.action, comment);
    setConfirmState({ open: false, action: null, label: '', requiresComment: false, allowOptionalComment: false });
    setComment('');
  };

  const handleClose = () => { 
    setConfirmState({ open: false, action: null, label: '', requiresComment: false, allowOptionalComment: false });
    setComment('');
  };

  const closeBlockDialog = () => {
    setBlockDialog((prev) => ({ ...prev, open: false }));
  };

  const showSubmissionPrerequisiteDialog = useCallback((readinessPayload, fallbackMessage) => {
    if (!readinessPayload) return;
    const readiness = readinessPayload.readiness || readinessPayload;
    const missingModules = Array.isArray(readiness?.missingModules) ? readiness.missingModules : [];
    const message = readiness?.message || fallbackMessage || 'Please complete all required modules before submitting this proposal to the Budget Reviewer.';

    setBlockDialog({
      open: true,
      message,
      missingModules,
      details: readiness?.details || {},
      requiresIncome: Boolean(readiness?.requiresIncome),
      requirementMessage: readiness?.requirementMessage || (readiness?.requiresIncome
        ? 'Regional submissions must include Personnel Services, MOOE, Capital Outlay, and Income entries before submitting to the Budget Reviewer.'
        : 'Central Office submissions must include Personnel Services, MOOE, and Capital Outlay entries before submitting to the Budget Reviewer.')
    });

    toast.info(message);

    try {
      if (typeof window !== 'undefined') {
        if (typeof window.showWarning === 'function') {
          window.showWarning(message, 8000);
        } else if (typeof window.showInfo === 'function') {
          window.showInfo(message, 8000);
        } else if (typeof window.showError === 'function') {
          window.showError(message, 8000);
        }
      }
    } catch (_) {}
  }, []);

  // Expose triggerFinalizeAction method to parent via ref
  useImperativeHandle(ref, () => ({
    triggerFinalizeAction: () => {
      console.log('🔧 Triggering finalize action from parent');
      // Call the finalize action with empty comment - user will be prompted in dialog
      handleActionClick('manager-approve', 'Finalize', true, false);
    }
  }), []);

  const availableActions = getAvailableActions();



  const renderIcon = (action) => {
    const iconColorMap = {
      'office-verify': 'success',
      'office-approve': 'secondary',
      'office-finalize': 'primary',
      'office-submit': 'secondary',
      'responsibility-center-submit': 'info',
      'submit-direct-to-manager': 'secondary'
    };
    const color = iconColorMap[action] || 'inherit';
    switch (action) {
      case 'submit-to-reviewer':
      case 'preparer-submit-to-officer':
      // case 'preparer-submit-to-manager': // DEPRECATED
      case 'submit-to-manager':
      case 'submit-direct-to-manager':
        return <SendIcon fontSize="small" color={color} />;
      case 'reviewer-approve':
      case 'officer-verify':
      case 'officer-approve':
      case 'manager-approve':
        return <CheckIcon fontSize="small" color={color} />;
      case 'reviewer-return':
      case 'officer-return':
      case 'manager-return':
        return <UndoIcon fontSize="small" color={color} />;
      case 'finalize': return <VerifiedIcon fontSize="small" color={color} />;
      // Legacy actions for backward compatibility
      case 'office-verify': return <CheckIcon fontSize="small" color={color} />;
      case 'office-approve': return <CheckIcon fontSize="small" color={color} />;
      case 'office-submit': return <SendIcon fontSize="small" color={color} />;
      case 'office-finalize': return <VerifiedIcon fontSize="small" color={color} />;
      case 'responsibility-center-submit': return <SendIcon fontSize="small" color={color} />;
      default: return null;
    }
  };

  const renderHistoryIcon = (action) => {
    const normalized = String(action || '').toUpperCase();
    if (normalized.includes('APPROVE') || normalized.includes('VERIFY')) {
      return <CheckIcon fontSize="small" color="success" />;
    }
    if (normalized.includes('RETURN')) {
      return <UndoIcon fontSize="small" color="error" />;
    }
    if (normalized.includes('SUBMIT') || normalized.includes('CONSOLIDATE')) {
      return <SendIcon fontSize="small" color="primary" />;
    }
    if (normalized.includes('SAVE')) {
      return <SaveIcon fontSize="small" color="info" />;
    }
    return <TimelineIcon fontSize="small" color="disabled" />;
  };

  

  // Step metadata for 6-step workflow progress tracking
  // 1. Draft → 2. Division Submitted → 3. Forwarded to Officer → 4. Officer Approved → 5. Forwarded to Manager → 6. Finalized
  const steps = [
    { key: 'Draft', label: 'Draft', stepNum: 1 },
    { key: 'Division Submitted', label: 'Division Submitted', stepNum: 2, ts: 'divisionSubmittedAt', by: 'divisionSubmittedBy' },
    { key: 'Forwarded to Officer', label: 'Forwarded to Officer', stepNum: 3, ts: 'forwardedToOfficerAt', by: 'forwardedToOfficerBy' },
    { key: 'Officer Approved', label: 'Officer Approved', stepNum: 4, ts: 'officerApprovedAt', by: 'officerApprovedBy' },
    { key: 'Forwarded to Manager', label: 'Forwarded to Manager', stepNum: 5, ts: 'forwardedToManagerAt', by: 'forwardedToManagerBy' },
    { key: 'Finalized', label: 'Finalized', stepNum: 6, ts: 'finalizedAt', by: 'finalizedBy' }
  ];

  // Map alternate/legacy status labels to canonical step keys
  // Handles both uppercase (database) and title-case (UI) variants
  const stepKeySynonyms = {
    // Forwarded to Officer variants
    'Submitted to Officer': 'Forwarded to Officer',
    'SUBMITTED TO OFFICER': 'Forwarded to Officer',
    'Office Verified': 'Forwarded to Officer',
    'OFFICE VERIFIED': 'Forwarded to Officer',
    'FORWARDED_TO_OFFICER': 'Forwarded to Officer',
    // Division Submitted variants
    'Responsibility Center Submitted': 'Division Submitted',
    'RESPONSIBILITY_CENTER_SUBMITTED': 'Division Submitted',
    'DIVISION SUBMITTED': 'Division Submitted',
    // Officer Approved variants
    'Officer Approved': 'Officer Approved',
    'OFFICER APPROVED': 'Officer Approved',
    'APPROVER APPROVED': 'Officer Approved',
    'Approver Approved': 'Officer Approved',
    // Forwarded to Manager variants
    'Forwarded to Manager': 'Forwarded to Manager',
    'Submitted to Manager': 'Forwarded to Manager',
    'FORWARDED_TO_MANAGER': 'Forwarded to Manager',
    'SUBMITTED_TO_MANAGER': 'Forwarded to Manager',
    'FORWARDED TO MANAGER': 'Forwarded to Manager',
    'SUBMITTED TO MANAGER': 'Forwarded to Manager',
    // Finalized variants
    'FINALIZED': 'Finalized',
    'Manager Approved': 'Finalized'
  };
  const normalizedStatusForStep = stepKeySynonyms[proposal?.status] || proposal?.status || 'Draft';
  const currentStepIndex = Math.max(steps.findIndex(s => s.key === normalizedStatusForStep), 0);

  // Dialog state for progress tracker
  const [trackOpen, setTrackOpen] = useState(false);
  const openTrack = () => {
    setTrackOpen(true);
    fetchHistory();
  };
  const closeTrack = () => setTrackOpen(false);

  // Helpers: safer formatting for timestamps and user display names
  const formatDateTime = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch { return ''; }
  };
  const resolveUserDisplay = (by) => {
    if (!by) return '';
    if (typeof by === 'string') {
      const s = by.trim();
      if (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return '';
      if (s.toLowerCase().includes('undefined')) return '';
      return s;
    }
    if (typeof by === 'object') {
      // Try common shapes
      const primary = by.userName || by.username || by.name || by.fullName || (by.user && (by.user.name || by.user.userName));
      if (primary && typeof primary === 'string') return primary;
      // Combine first/last-style fields if present
      const first = by.firstName || by.givenName || by.f_name || by.first_name;
      const last = by.lastName || by.familyName || by.l_name || by.last_name;
      const combined = [first, last].filter(v => typeof v === 'string' && v.trim() && v.toLowerCase() !== 'undefined').join(' ').trim();
      if (combined) return combined;
      // Fallback to ids
      const idish = by.userId || by.id;
      return typeof idish === 'string' ? idish : '';
    }
    return '';
  };

  const statusChipColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (!s) return 'default';
    // Map to 6-step workflow standard: Draft → Division Submitted → Forwarded to Officer → Officer Approved → Forwarded to Manager → Finalized
    if (s.includes('draft')) return 'default';
    if (s.includes('division submitted') || s.includes('responsibility center submitted') || s.includes('forwarded to officer')) return 'info';
    if (s.includes('officer approved')) return 'success';
    if (s.includes('forwarded to manager') || s.includes('submitted to manager')) return 'warning';
    if (s.includes('manager approved') || s.includes('finalized')) return 'primary';
    if (s.includes('returned')) return 'error';
    return 'default';
  };

  const derived = deriveFromStatus(proposal?.status);
  const effectiveStep = proposal?.currentStep || derived.step;
  const effectiveAssignee = proposal?.currentAssigneeRole || derived.assignee;
  const effectivePending = Array.isArray(proposal?.pendingWithRoles) && proposal.pendingWithRoles.length > 0
    ? proposal.pendingWithRoles
    : derived.pending;

  const currentStepLabel = formatStepLabel(effectiveStep);
  const currentStepTooltip = stepTooltip(effectiveStep);
  const currentAssigneeLabel = formatRoleLabel(effectiveAssignee);
  const pendingRolesDisplay = Array.isArray(effectivePending) && effectivePending.length > 0
    ? effectivePending.map(formatRoleLabel).join(', ')
    : null;
  const latestEventAction = latestEvent ? formatActionLabel(latestEvent.action) : null;
  const latestEventStatus = latestEvent?.newStatus || latestEvent?.status || null;
  const latestEventByRaw = latestEvent?.userName || latestEvent?.performedBy || latestEvent?.by || proposal?.lastActionBy || '';
  const latestEventBy = (() => {
    const s = String(latestEventByRaw || '').trim();
    if (!s) return '';
    if (s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return '';
    return s.replace(/undefined/gi, '').trim();
  })();

  const latestEventTooltip = useMemo(() => {
    if (!latestEvent) return '';
    const parts = [];
    if (latestEvent.comment) parts.push(latestEvent.comment);
    if (latestEvent.timestamp) parts.push(formatDateTime(latestEvent.timestamp));
    if (latestEventBy) parts.push(`By: ${latestEventBy}`);
    return parts.join(' • ');
  }, [latestEvent, latestEventBy]);

  // Icons to show inside step markers
  const getStepIcon = (key, { active, completed } = {}) => {
    const color = completed ? 'success' : active ? 'primary' : 'disabled';
    switch (key) {
      case 'Draft':
        return <TimelineIcon fontSize="small" color={color} />;
      case 'Division Submitted':
        return <SendIcon fontSize="small" color={color} />;
      case 'Forwarded to Officer':
        return <SendIcon fontSize="small" color={color} />;
      case 'Officer Approved':
        return <CheckIcon fontSize="small" color={color} />;
      case 'Forwarded to Manager':
        return <SendIcon fontSize="small" color={color} />;
      case 'Finalized':
        return <VerifiedIcon fontSize="small" color={color} />;
      default:
        return <TimelineIcon fontSize="small" color={color} />;
    }
  };

  // Compact actions menu (icon + dropdown)
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleMenuItemClick = (action, label, requiresComment = false, allowOptionalComment = false) => {
    handleMenuClose();
    handleActionClick(action, label, requiresComment, allowOptionalComment);
  };

  return (
    <>
      {/* Status header with track + actions */}
      {showHeader && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mb: 1 }}>
          <Tooltip title="View available workflow actions" arrow>
            <span>
              <Button
                size="small"
                variant="contained"
                onClick={handleMenuOpen}
                endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '18px', transition: 'transform 0.2s' }} />}
                disabled={loading}
                sx={{ 
                  textTransform: 'none', 
                  fontWeight: 600,
                  backgroundColor: '#2d6a4f',
                  color: '#ffffff',
                  fontSize: '13px',
                  px: 2.5,
                  py: 0.9,
                  borderRadius: '6px',
                  boxShadow: '0 2px 6px rgba(45, 106, 79, 0.25)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    backgroundColor: '#1e4d35',
                    boxShadow: '0 4px 10px rgba(45, 106, 79, 0.35)',
                    transform: 'translateY(-1px)'
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: '0 2px 4px rgba(45, 106, 79, 0.25)'
                  },
                  '&:disabled': {
                    backgroundColor: '#a8bfb5',
                    color: '#ffffff',
                    boxShadow: 'none'
                  }
                }}
              >
                Actions
              </Button>
            </span>
          </Tooltip>
        </Stack>
      )}

      <Menu 
        anchorEl={anchorEl} 
        open={menuOpen} 
        onClose={handleMenuClose} 
        elevation={4}
        sx={{ 
          maxWidth: '450px',
          '& .MuiPaper-root': {
            borderRadius: '8px',
            marginTop: '8px'
          }
        }}
      >
        {/* View action at top (optional) */}
        {showViewInMenu && (
          <MenuItem 
            onClick={() => { handleMenuClose(); onView?.(); }} 
            sx={{ 
              py: 1.5, 
              px: 2,
              backgroundColor: 'rgba(99, 198, 206, 0.05)',
              '&:hover': { backgroundColor: 'rgba(99, 198, 206, 0.12)' }
            }}
          >
            <ListItemIcon sx={{ color: '#00796b', minWidth: 40 }}>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText 
              primary="View" 
              secondary="Open proposal details"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 500, color: '#00796b' }}
              secondaryTypographyProps={{ variant: 'caption', sx: { mt: 0.3 } }}
            />
          </MenuItem>
        )}
        
        {showViewInMenu && availableActions.length > 0 && <Divider sx={{ my: 0.5 }} />}
        
        {/* Workflow Actions Section */}
        {availableActions.length > 0 && (
          <Box sx={{ p: '0.5rem 0' }}>
            {availableActions.map((actionConfig, index) => {
              // Determine action category for better visual grouping
              const isManagerAction = actionConfig.action.startsWith('manager-');
              const isSaveAction = actionConfig.action.includes('save');
              const isReturnAction = actionConfig.action.includes('return');
              const isApproveAction = actionConfig.action.includes('approve') || actionConfig.action.includes('finalize');
              const isSubmitAction = actionConfig.action.includes('submit') || actionConfig.action.includes('forward');
              
              // Color styling based on action type
              let actionColor = 'inherit';
              let backgroundColor = 'transparent';
              if (isReturnAction) {
                actionColor = 'error';
                backgroundColor = 'rgba(244, 67, 54, 0.05)';
              } else if (isApproveAction) {
                actionColor = 'success';
                backgroundColor = 'rgba(76, 175, 80, 0.05)';
              } else if (isSubmitAction) {
                actionColor = 'info';
                backgroundColor = 'rgba(33, 150, 243, 0.05)';
              } else if (isSaveAction) {
                actionColor = 'warning';
                backgroundColor = 'rgba(255, 152, 0, 0.05)';
              }
              
              return (
                <MenuItem 
                  key={index} 
                  onClick={() => handleMenuItemClick(actionConfig.action, actionConfig.label, actionConfig.requiresComment, actionConfig.allowOptionalComment)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    backgroundColor: backgroundColor,
                    '&:hover': {
                      backgroundColor: backgroundColor,
                      filter: 'brightness(0.95)'
                    },
                    borderLeft: isManagerAction ? '4px solid #1976d2' : 'none',
                    borderRadius: isManagerAction ? '0 4px 4px 0' : '0'
                  }}
                >
                  <ListItemIcon sx={{ color: actionColor, minWidth: 36 }}>
                    {renderIcon(actionConfig.action)}
                  </ListItemIcon>
                  <ListItemText 
                    primary={actionConfig.label}
                    secondary={actionConfig.description}
                    primaryTypographyProps={{ 
                      variant: 'body2', 
                      fontWeight: 500,
                      color: actionColor
                    }}
                    secondaryTypographyProps={{ 
                      variant: 'caption',
                      sx: { mt: 0.3 }
                    }}
                  />
                </MenuItem>
              );
            })}
          </Box>
        )}
        
        {/* No actions available */}
        {availableActions.length === 0 && (
          <MenuItem disabled sx={{ py: 2, px: 2 }}>
            <ListItemText 
              primary="No workflow actions available" 
              secondary={`Current Status: ${proposal?.status || 'Unknown'}`}
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary', fontWeight: 500 }}
              secondaryTypographyProps={{ variant: 'caption', sx: { mt: 0.3 } }}
            />
          </MenuItem>
        )}
        
        {/* Track Progress Section */}
        {showTrackInMenu && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem 
              onClick={() => { handleMenuClose(); openTrack(); }}
              sx={{ 
                py: 1.5, 
                px: 2, 
                backgroundColor: 'rgba(156, 39, 176, 0.08)',
                '&:hover': { backgroundColor: 'rgba(156, 39, 176, 0.15)' }
              }}
            >
              <ListItemIcon sx={{ color: '#7b1fa2', minWidth: 40 }}>
                <TimelineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Track Progress" 
                secondary="View complete workflow timeline"
                primaryTypographyProps={{ 
                  variant: 'body2', 
                  fontWeight: 500,
                  color: 'secondary.main'
                }}
                secondaryTypographyProps={{ 
                  variant: 'caption',
                  sx: { mt: 0.3 }
                }}
              />
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Confirmation dialog */}
      <Dialog open={confirmState.open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Are you sure you want to perform: <strong>{confirmState.label}</strong>?
          </Typography>
          {showCommentField && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              fullWidth
              label={requiresComment ? "Comment (required)" : "Comment (optional)"}
              placeholder={confirmState.action && confirmState.action.includes('approve')
                ? "Explain your approval decision"
                : "Add notes for this workflow action"}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" disabled={loading || (requiresComment && !comment.trim())}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={blockDialog.open} onClose={closeBlockDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Budget Modules</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {blockDialog.message || 'Please complete all required modules before submitting this proposal to the Budget Coordinator.'}
          </Alert>

          {blockDialog.missingModules.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Missing modules</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                {blockDialog.missingModules.map((moduleName) => (
                  <Chip key={moduleName} label={moduleName} color="warning" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
              </Stack>
            </>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {blockDialog.requirementMessage || (blockDialog.requiresIncome
              ? 'Regional submissions must include Personnel Services, MOOE, Capital Outlay, and Income entries before submitting to the Budget Reviewer.'
              : 'Central Office submissions must include Personnel Services, MOOE, and Capital Outlay entries before submitting to the Budget Reviewer.')}
          </Typography>

          <List dense disablePadding>
            {Object.entries(MODULE_SUMMARY_LABELS).map(([key, label]) => {
              const stats = blockDialog.details?.[key] || {};
              const required = key !== 'income' || blockDialog.requiresIncome;
              const hasError = Boolean(stats.error);
              const recordCount = stats.count || 0;
              const hasRecords = recordCount > 0;
              const hasEntries = typeof stats.hasEntries === 'boolean' ? stats.hasEntries : hasRecords;
              const hasPositiveTotal = typeof stats.hasPositiveTotal === 'boolean'
                ? stats.hasPositiveTotal
                : (Number.isFinite(Number(stats.total)) && Math.abs(Number(stats.total)) > 0.0001);
              const isComplete = hasError ? false : required ? (hasEntries && hasPositiveTotal) : true;
              const totalAmount = Number(stats.total);
              const hasAmount = Number.isFinite(totalAmount) && Math.abs(totalAmount) > 0.0001;
              const secondaryText = (() => {
                if (hasError) {
                  return `Unable to verify (${stats.error})`;
                }
                if (stats.note) {
                  return stats.note;
                }
                if (hasEntries) {
                  const base = `${recordCount} record${recordCount === 1 ? '' : 's'}`;
                  if (hasAmount) {
                    try {
                      const formatted = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalAmount);
                      return `${base} — total ${formatted}`;
                    } catch (_) {
                      return `${base} — total ${totalAmount.toFixed(2)}`;
                    }
                  }
                  return `${base} available`;
                }
                return required ? 'No records found' : 'Optional for Central Office';
              })();

              return (
                <ListItem key={key} disableGutters sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {isComplete ? (
                      <CheckIcon fontSize="small" color="success" />
                    ) : (
                      <WarningAmberIcon fontSize="small" color={hasError ? 'error' : required ? 'warning' : 'disabled'} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    secondary={secondaryText}
                    secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBlockDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Track progress dialog */}
      <Dialog open={trackOpen} onClose={closeTrack} maxWidth="sm" fullWidth>
        <DialogTitle>Workflow Progress</DialogTitle>
        <DialogContent>
          {/* Status summary */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Current Status</Typography>
            <Chip size="small" variant="outlined" color={statusChipColor(proposal?.status)} label={proposal?.status || 'Draft'} />
          </Box>

          <Stepper activeStep={Math.max(currentStepIndex, 0)} alternativeLabel>
            {steps.map((s, idx) => {
              const ts = s.ts && proposal?.[s.ts];
              const rawBy = s.by && proposal?.[s.by];
              const by = resolveUserDisplay(rawBy);
              const isActive = idx === currentStepIndex;
              const isCompleted = idx < currentStepIndex;
              const iconNode = getStepIcon(s.key, { active: isActive, completed: isCompleted });
              const hasDetail = Boolean(ts || by);
              const detail = (
                <Box>
                  <Typography variant="caption" display="block"><strong>{s.label}</strong></Typography>
                  <Typography variant="caption" display="block">{formatDateTime(ts) || '—'}</Typography>
                  <Typography variant="caption" display="block">{by ? `By: ${by}` : 'By: —'}</Typography>
                </Box>
              );
              return (
                <Step key={s.key} completed={idx < currentStepIndex}>
                  <Tooltip title={hasDetail ? detail : s.label} arrow>
                    <StepLabel
                      icon={iconNode}
                      optional={
                        ts ? (
                          <Typography variant="caption">
                            {formatDateTime(ts)}{by ? ` — ${by}` : ''}
                          </Typography>
                        ) : undefined
                      }
                    >
                      {s.label}
                    </StepLabel>
                  </Tooltip>
                </Step>
              );
            })}
          </Stepper>

          <Box sx={{ mt: 2 }}>
            {historyLoading && (
              <Typography variant="body2" color="text.secondary">
                Loading workflow history…
              </Typography>
            )}

            {historyError && (
              <Alert severity="warning" sx={{ mb: historyItems.length ? 1 : 0 }}>
                {historyError}
              </Alert>
            )}

            {!historyLoading && !historyError && historyItems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No workflow events recorded yet.
              </Typography>
            )}

            {historyItems.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Timeline
                </Typography>
                <List dense disablePadding>
                  {historyItems.slice().reverse().map((event, index) => {
                    const actor = resolveUserDisplay(event?.userName || event?.user || event?.performedBy || event?.by);
                    return (
                      <ListItem key={`${event?.timestamp || index}-${index}`} alignItems="flex-start" sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {renderHistoryIcon(event?.action)}
                        </ListItemIcon>
                        <ListItemText
                          primary={`${formatActionLabel(event?.action) || 'Update'}${event?.newStatus ? ` → ${event.newStatus}` : ''}`}
                          secondary={
                            <>
                              <Typography variant="caption" display="block">
                                {formatDateTime(event?.timestamp) || '—'}{actor ? ` • ${actor}` : ''}
                                {event?.targetRole ? ` • Target: ${formatRoleLabel(event.targetRole)}` : ''}
                              </Typography>
                              {event?.comment && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {event.comment}
                                </Typography>
                              )}
                            </>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTrack}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

WorkflowActions.displayName = 'WorkflowActions';

export default WorkflowActions;