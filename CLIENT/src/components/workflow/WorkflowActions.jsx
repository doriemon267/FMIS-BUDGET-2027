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
const WorkflowActions = forwardRef(({ proposal, userInfo, onRefresh, onView, showHeader = true, showTrackInMenu = true, showViewInMenu = true }, ref) => {
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
    requiresIncome: false
  });
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
      ANALYST: 'BUDGET_ANALYST',
      BUDGETANALYST: 'BUDGET_ANALYST',
      BUDGET_ANALYST: 'BUDGET_ANALYST',
      BUDGET_OFFICER_ANALYST: 'BUDGET_ANALYST',
      BA: 'BUDGET_ANALYST',
      OFFICE_ANALYST: 'BUDGET_ANALYST',
      ANALYST_OFFICER: 'BUDGET_ANALYST',
      RESPONSIBILITY_CENTER: 'BUDGET_ANALYST',
      RC: 'BUDGET_ANALYST',

      COORDINATOR: 'BUDGET_COORDINATOR',
      BUDGET_COORDINATOR: 'BUDGET_COORDINATOR',
      BUDGETCOORDINATOR: 'BUDGET_COORDINATOR',
      COOR: 'BUDGET_COORDINATOR',
      DIVISION_COORDINATOR: 'BUDGET_COORDINATOR',
      DIVISIONAPPROVER: 'BUDGET_COORDINATOR',
      DIVISION_APPROVER: 'BUDGET_COORDINATOR',
      DIVISIONVERIFIER: 'BUDGET_COORDINATOR',
      DIVISION_VERIFIER: 'BUDGET_COORDINATOR',

      BUDGET_OFFICER: 'BUDGET_OFFICER',
      BUDGETOFFICER: 'BUDGET_OFFICER',
      OFFICER: 'BUDGET_OFFICER',
      BUDGET_SPECIALIST: 'BUDGET_OFFICER',
      OFFICE_VERIFIER: 'BUDGET_OFFICER',
      OFFICEVERIFIER: 'BUDGET_OFFICER',
      OFFICE_APPROVER: 'BUDGET_OFFICER',
      OFFICEAPPROVER: 'BUDGET_OFFICER',
      OFFICE_CONSOLIDATOR: 'BUDGET_OFFICER',
      BUDGET_SUPERVISOR: 'BUDGET_OFFICER',

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

      BUDGETADMIN: 'BUDGET_ADMIN'
    };

    return roleSynonyms[camelCaseNormalized] || camelCaseNormalized;
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
    const isBudgetAnalyst = normalizedRoles.includes('BUDGET_ANALYST');
    const isBudgetCoordinator = normalizedRoles.includes('BUDGET_COORDINATOR');
    const isBudgetOfficer = normalizedRoles.includes('BUDGET_OFFICER');
    const isBudgetManager = normalizedRoles.includes('BUDGET_MANAGER');
    const isBudgetAdmin = normalizedRoles.includes('BUDGET_ADMIN');

    console.log('🔍 WorkflowActions Debug:', {
      status,
      normalizedStatus,
      rawRoleSources,
      rawRoles,
      roleMapping,
      normalizedRoles,
      isBudgetAnalyst,
      isBudgetCoordinator,
      isBudgetOfficer,
      isBudgetManager,
      isBudgetAdmin,
      proposalId: proposal?._id,
      userInfo: {
        roles: userInfo?.roles,
        Roles: userInfo?.Roles,
        role: userInfo?.role
      }
    });

    // BUDGET ANALYST Actions (Draft control & submission)
    if (isBudgetAnalyst) {
      const isDraft = normalizedStatus === 'DRAFT' || status === 'Draft';
      const isReturnedToAnalyst = normalizedStatus === 'RETURNED' || (status === 'Returned' && proposal?.workflowLevel === 'ANALYST');

      if (isDraft || isReturnedToAnalyst) {
        actions.push({
          label: 'Save Draft',
          action: 'save-draft',
          color: 'bg-slate-500 hover:bg-slate-600',
          icon: '💾',
          description: 'Save current changes without routing',
          requiresComment: false,
          allowOptionalComment: true
        });

        actions.push({
          label: 'Submit to Coordinator',
          action: 'submit-to-coordinator',
          color: 'bg-blue-500 hover:bg-blue-600',
          icon: '📤',
          description: 'Forward proposal to Budget Coordinator for review',
          requiresComment: true
        });

        // Optional escalation path if organization allows analyst direct submission
  if (isBudgetCoordinator) {
          actions.push({
            label: 'Submit to Manager (Direct)',
            action: 'submit-direct-to-manager',
            color: 'bg-purple-500 hover:bg-purple-600',
            icon: '⚡',
            description: 'Submit proposal directly to Budget Manager (bypasses Officer review)',
            requiresComment: true
          });
        }
      }
    }

    // BUDGET COORDINATOR Actions (Review & routing)
    if (isBudgetCoordinator) {
      // Can review and edit proposals submitted by analysts
      if (normalizedStatus === 'DIVISION SUBMITTED' || status === 'Division Submitted' || 
          normalizedStatus === 'RESPONSIBILITY CENTER SUBMITTED') {
        actions.push({
          label: 'Save Edits',
          action: 'coordinator-save-edits',
          color: 'bg-gray-500 hover:bg-gray-600',
          icon: '💾',
          description: 'Save changes without forwarding',
          requiresComment: false,
          allowOptionalComment: true
        });
        actions.push({
          label: 'Approve & Forward to Officer',
          action: 'coordinator-approve-forward-officer',
          color: 'bg-green-500 hover:bg-green-600',
          icon: '✅',
          description: 'Approve and forward to Budget Officer for verification',
          requiresComment: true
        });
        actions.push({
          label: 'Submit to Manager (Skip Officer)',
          action: 'coordinator-submit-to-manager',
          color: 'bg-purple-500 hover:bg-purple-600',
          icon: '⚡',
          description: 'Submit proposal directly to Budget Manager (bypasses Officer review)',
          requiresComment: true
        });
        actions.push({
          label: 'Return to Analyst',
          action: 'coordinator-return',
          color: 'bg-red-500 hover:bg-red-600',
          icon: '↩️',
          description: 'Send back to analyst for revisions',
          requiresComment: true
        });
      }
    }

    // BUDGET OFFICER Actions (Approval Level)
    if (isBudgetOfficer) {
      // Can review and edit proposals forwarded by coordinator
      if (normalizedStatus === "FORWARDED TO OFFICER" || status === "Forwarded to Officer" ||
          normalizedStatus === "OFFICER APPROVED" || status === "Officer Approved" ||
          normalizedStatus === "DIVISION SUBMITTED" || status === "Division Submitted") {
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
          label: "Return to Coordinator",
          action: "officer-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal to coordinator for revisions",
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
    if (isBudgetManager || isBudgetAdmin) {
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

    console.log('🎯 Available Actions:', actions.length, actions.map(a => a.label));

    return actions;
  };

  const roleLabelMap = useMemo(() => ({
    BUDGET_ANALYST: 'Budget Analyst',
    BUDGET_COORDINATOR: 'Budget Coordinator',
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
    COORDINATOR_REVIEW: { label: 'Coordinator Review', tooltip: 'Awaiting Budget Coordinator action' },
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
    const derived = { step: 'ANALYST_DRAFT', assignee: 'BUDGET_ANALYST', pending: ['BUDGET_ANALYST'] };
    
    // 6-Step Workflow Mapping:
    // 1. Draft → Analyst
    // 2. Division Submitted → Coordinator Review
    // 3. Forwarded to Officer → Officer Review
    // 4. Officer Approved → Officer (approves, prepares submission)
    // 5. Forwarded to Manager → Manager Review
    // 6. Finalized → Admin
    
    if (s.includes('DIVISION SUBMITTED') || s.includes('RESPONSIBILITY CENTER SUBMITTED')) {
      // Step 2: Coordinator reviews
      derived.step = 'COORDINATOR_REVIEW';
      derived.assignee = 'BUDGET_COORDINATOR';
      derived.pending = ['BUDGET_COORDINATOR'];
    } else if (s.includes('FORWARDED TO OFFICER') || s === 'OFFICE' || s.includes('OFFICE REVIEW') || s.includes('OFFICE SUBMITTED')) {
      // Step 3: Officer reviews
      derived.step = 'OFFICER_REVIEW';
      derived.assignee = 'BUDGET_OFFICER';
      derived.pending = ['BUDGET_OFFICER'];
    } else if (s.includes('OFFICER APPROVED')) {
      // Step 4: Officer approves and prepares for manager (always goes to manager in 6-step flow)
      derived.step = 'OFFICER_APPROVAL';
      derived.assignee = 'BUDGET_OFFICER';
      derived.pending = ['BUDGET_OFFICER'];
    } else if (s.includes('FORWARDED TO MANAGER') || s.includes('SUBMITTED TO MANAGER')) {
      // Step 5: Manager reviews
      derived.step = 'MANAGER_REVIEW';
      derived.assignee = 'BUDGET_MANAGER';
      derived.pending = ['BUDGET_MANAGER'];
    } else if (s.includes('RETURNED')) {
      // Return to analyst for revision
      derived.step = 'RETURNED';
      derived.assignee = 'BUDGET_ANALYST';
      derived.pending = ['BUDGET_ANALYST'];
    } else if (s.includes('FINALIZED')) {
      // Step 6: Finalized
      derived.step = 'FINALIZED';
      derived.assignee = 'BUDGET_ADMIN';
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
      if (action === 'submit-to-coordinator' && normalizedRoles.includes('BUDGET_ANALYST') && proposal?._id) {
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
        case "save-draft":
          endpoint = "/api/workflow/draft/save";
          successMessage = "Draft saved successfully";
          break;
        case "submit-to-coordinator":
          endpoint = "/api/workflow/submit";
          successMessage = "Proposal submitted to Budget Coordinator successfully";
          break;
        case "submit-direct-to-manager":
          endpoint = "/api/workflow/submit-direct-to-manager";
          successMessage = "Proposal submitted directly to Budget Manager successfully";
          break;
        case "coordinator-approve":
          endpoint = "/api/workflow/coordinator/approve";
          successMessage = "Proposal approved by Budget Coordinator successfully";
          break;
        case "coordinator-approve-forward-officer":
          endpoint = "/api/workflow/coordinator/approve-and-forward-to-officer";
          successMessage = "Proposal approved and forwarded to Budget Officer successfully";
          break;
        case "coordinator-return":
          endpoint = "/api/workflow/coordinator/return";
          successMessage = "Proposal returned to Budget Analyst successfully";
          break;
        case "coordinator-forward-officer":
          endpoint = "/api/workflow/coordinator/submit-to-officer";
          successMessage = "Proposal forwarded to Budget Officer successfully";
          break;
        case "coordinator-submit-to-manager":
          endpoint = "/api/workflow/coordinator/submit-to-manager";
          successMessage = "Proposal submitted directly to Budget Manager (bypassing Officer review)";
          break;
        case "coordinator-save-edits":
          endpoint = "/api/workflow/coordinator/save-edits";
          successMessage = "Changes saved successfully";
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
          successMessage = "Proposal returned to Coordinator successfully";
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
        // coordinator-approve → "Forwarded to Officer" (step 3)
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

      if (action === "save-draft") {
        requestData = {
          proposalId: proposal._id,
          comment: noteValue || "",
          updates: {}
        };
      } else if ([
        "submit-to-coordinator",
        "submit-direct-to-manager",
        "coordinator-approve",
        "coordinator-approve-forward-officer",
        "coordinator-return",
        "coordinator-forward-officer",
        "coordinator-submit-to-manager",
        "coordinator-save-edits",
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
            onRefresh(response.data.proposal, true); // Pass updated proposal AND force flag for instant update
          } else {
            console.log('📤 No proposal in response, calling onRefresh with force=true');
            onRefresh(null, true); // Fallback to force re-fetch without cache
          }
          console.log('✅ onRefresh callback completed successfully');
        } catch (refreshErr) {
          console.error('❌ Error in onRefresh callback:', refreshErr);
          // Don't throw - just log it, we already showed the success toast
          // Try a simple fallback refresh
          try {
            onRefresh(null, true);
          } catch (_) {}
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
    'submit-to-coordinator',
    'submit-direct-to-manager',
    'coordinator-approve',
    'coordinator-return',
    'coordinator-forward-officer',
    'coordinator-submit-to-manager',
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
    const message = readiness?.message || fallbackMessage || 'Please complete all required modules before submitting this proposal to the Budget Coordinator.';

    setBlockDialog({
      open: true,
      message,
      missingModules,
      details: readiness?.details || {},
      requiresIncome: Boolean(readiness?.requiresIncome)
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
      case 'save-draft':
        return <SaveIcon fontSize="small" color={color} />;
      case 'submit-to-coordinator':
      case 'coordinator-forward-officer':
      // case 'coordinator-forward-manager': // DEPRECATED
      case 'submit-to-manager':
      case 'submit-direct-to-manager':
        return <SendIcon fontSize="small" color={color} />;
      case 'coordinator-approve':
      case 'officer-verify':
      case 'officer-approve':
      case 'manager-approve':
        return <CheckIcon fontSize="small" color={color} />;
      case 'coordinator-return':
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
  const stepKeySynonyms = {
    'Submitted to Officer': 'Forwarded to Officer',
    'Office Verified': 'Forwarded to Officer',
    'Responsibility Center Submitted': 'Division Submitted',
    'Forwarded to Manager': 'Forwarded to Manager',
    'Officer Approved': 'Officer Approved',
    'Submitted to Manager': 'Forwarded to Manager'
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
          <Tooltip title="Workflow actions" arrow>
            <span>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handleMenuOpen}
                endIcon={<KeyboardArrowDownIcon fontSize="small" />}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Actions
              </Button>
            </span>
          </Tooltip>
        </Stack>
      )}

      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose} elevation={3}>
        {/* View action at top (optional) */}
        {showViewInMenu && (
          <MenuItem onClick={() => { handleMenuClose(); onView?.(); }}>
            <ListItemIcon>
              <VisibilityIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="View" secondary="Open proposal details" />
          </MenuItem>
        )}
        
        {showViewInMenu && availableActions.length > 0 && <Divider sx={{ my: 0.5 }} />}
        
        {availableActions.length === 0 ? (
          <MenuItem disabled>
            <ListItemText 
              primary="No workflow actions available" 
              secondary={`Status: ${proposal?.status || 'Unknown'}`}
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            />
          </MenuItem>
        ) : (
          availableActions.map((actionConfig, index) => (
            <MenuItem key={index} onClick={() => handleMenuItemClick(actionConfig.action, actionConfig.label, actionConfig.requiresComment, actionConfig.allowOptionalComment)}>
              <ListItemIcon>
                {renderIcon(actionConfig.action)}
              </ListItemIcon>
              <ListItemText primary={actionConfig.label} secondary={actionConfig.description} />
            </MenuItem>
          ))
        )}
        
        {showTrackInMenu && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={() => { handleMenuClose(); openTrack(); }}>
              <ListItemIcon>
                <TimelineIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Track progress" secondary="View workflow timeline" />
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
            {blockDialog.requiresIncome
              ? 'Regional submissions must include Personnel Services, MOOE, Capital Outlay, and Income entries before submitting to the Budget Coordinator.'
              : 'Central Office submissions must include Personnel Services, MOOE, and Capital Outlay entries before submitting to the Budget Coordinator.'}
          </Typography>

          <List dense disablePadding>
            {Object.entries(MODULE_SUMMARY_LABELS).map(([key, label]) => {
              const stats = blockDialog.details?.[key] || {};
              const required = key !== 'income' || blockDialog.requiresIncome;
              const hasError = Boolean(stats.error);
              const recordCount = stats.count || 0;
              const hasRecords = recordCount > 0;
              const isComplete = hasError ? false : required ? hasRecords : true;
              const secondaryText = (() => {
                if (hasError) {
                  return `Unable to verify (${stats.error})`;
                }
                if (stats.note) {
                  return stats.note;
                }
                if (hasRecords) {
                  return `${recordCount} record${recordCount === 1 ? '' : 's'} available`;
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