import React, { useCallback, useMemo } from "react";
import { useUser } from "../../../context/UserContext";
import {
  Send as SendIcon,
  CallSplit as UnconsolidateIcon,
  ThumbUp as ApproveIcon,
  Visibility as ViewIcon,
  TableChart as TableChartIcon,
  History as HistoryIcon,
  ListAlt as LogsIcon,
  ForwardToInbox as ApproveForwardIcon,
  KeyboardReturn as ReturnIcon,
} from "@mui/icons-material";

const normalizeBudgetType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized.includes("NEP")) return "NEP";
  if (normalized.includes("INITIAL")) return "INITIAL";
  return normalized;
};

const normalizeFiscalYear = (value) => String(value ?? "").trim();

export const getProposalBudgetType = (proposal) =>
  normalizeBudgetType(proposal?.modelType || proposal?.budgetType);

export const isProposalInActiveCycle = (proposal, activeSettings) => {
  const proposalBudgetType = getProposalBudgetType(proposal);
  const activeBudgetType = normalizeBudgetType(
    activeSettings?.budgetType || activeSettings?.modelType
  );
  const proposalFiscalYear = normalizeFiscalYear(
    proposal?.fiscalYear ?? proposal?.FiscalYear ?? proposal?.fy
  );
  const activeFiscalYear = normalizeFiscalYear(
    activeSettings?.fiscalYear ?? activeSettings?.FiscalYear ?? activeSettings?.fy
  );

  return Boolean(
    proposalBudgetType &&
      activeBudgetType &&
      proposalFiscalYear &&
      activeFiscalYear &&
      proposalBudgetType === activeBudgetType &&
      proposalFiscalYear === activeFiscalYear
  );
};

const normalizePermissionToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const TIER_PREPARER_ROLES = new Set(["BUDGETPREPARER"]);
const TIER_BRD_ROLES = new Set([
  "BUDGETPLANNINGANALYST",
  "BUDGETOFFICER",
  "BUDGETMANAGER",
  "SUPERADMIN",
]);
const TIER_PREPARER_STATUSES = new Set(["DRAFT", "RETURNEDTOPREPARER"]);
const TIER_BRD_STATUSES = new Set([
  "FORWARDEDTOBRDANALYST",
  "FORWARDEDTOBUDGETPLANNINGANALYST",
  "FORWARDEDTOBRDOFFICER",
  "FORWARDEDTOBUDGETOFFICER",
  "FORWARDEDTOBRDMANAGER",
  "FORWARDEDTOOVERALLBUDGETAPPROVER",
  "FORWARDEDTOMANAGER",
  "FINALIZED",
]);

/**
 * Authoritative UI boundary for NEP Tier Adjustment.
 *
 * Both the proposal action menu and details dialog must use this policy so
 * proposal type, active model/FY, role, and workflow status cannot diverge.
 */
export const canAccessNepTierAdjustment = (
  proposal,
  activeSettings,
  userRoles = []
) => {
  if (
    getProposalBudgetType(proposal) !== "NEP" ||
    !isProposalInActiveCycle(proposal, activeSettings)
  ) {
    return false;
  }

  const normalizedRoles = (Array.isArray(userRoles) ? userRoles : []).map(
    normalizePermissionToken
  );
  const normalizedStatus = normalizePermissionToken(proposal?.status);
  const isBudgetPreparer = normalizedRoles.some((role) =>
    TIER_PREPARER_ROLES.has(role)
  );
  const isBRDStaff = normalizedRoles.some((role) => TIER_BRD_ROLES.has(role));

  return Boolean(
    (isBudgetPreparer && TIER_PREPARER_STATUSES.has(normalizedStatus)) ||
      (isBRDStaff && TIER_BRD_STATUSES.has(normalizedStatus))
  );
};

export const isReadOnlyProposalAction = (actionValue) =>
  ["view-details", "view-history", "view-audit-trail"].includes(actionValue);

export const isProposalReturnAction = (actionValue) =>
  String(actionValue || "").endsWith("-return") ||
  String(actionValue || "").includes("-return-to-");

export const requiresActiveProposalCycle = (actionValue) =>
  !isReadOnlyProposalAction(actionValue) && !isProposalReturnAction(actionValue);

export const useProposalPermissions = () => {
  const { currentUser } = useUser();

  // Check if user is BRD (Budget Revenue Division) level or SUPER ADMIN
  const isBRDUser = useMemo(() => currentUser?.Roles?.some((role) =>
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
  ), [currentUser]);

  // Check if user is actual BRD staff (Planning Analyst, Officer, Manager)
  const isBRDStaff = useMemo(() => currentUser?.Roles?.some((role) =>
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
  ), [currentUser]);

  const isBudgetManager = useMemo(() => (currentUser?.Roles || []).some((r) => {
    const norm = String(r || "").toUpperCase().replace(/[^A-Z]/g, "");
    return norm === "BUDGETMANAGER";
  }), [currentUser]);

  const isSuperAdmin = useMemo(() => (currentUser?.Roles || []).some((role) =>
    ["SUPER_ADMIN", "SUPER ADMIN"].includes(role)
  ), [currentUser]);

  const isBudgetPreparer = useMemo(() => (currentUser?.Roles || []).some((role) =>
    ["BUDGET PREPARER", "BUDGET_PREPARER"].includes(String(role || "").toUpperCase())
  ), [currentUser]);

  const isBudgetApprover = useMemo(() => (currentUser?.Roles || []).some((role) =>
    ["BUDGET APPROVER", "BUDGET_APPROVER"].includes(String(role || "").toUpperCase())
  ), [currentUser]);

  const isBudgetReviewer = useMemo(() => (currentUser?.Roles || []).some((role) =>
    ["BUDGET REVIEWER", "BUDGET_REVIEWER"].includes(String(role || "").toUpperCase())
  ), [currentUser]);

  const canViewVersionHistory = useMemo(() => (currentUser?.Roles || []).some((r) =>
    /BUDGET_OFFICER|BUDGET OFFICER|BUDGET_MANAGER|BUDGET MANAGER|OVERALL_BUDGET_APPROVER|SUPER_ADMIN|SUPER ADMIN/i.test(
      String(r || "")
    )
  ), [currentUser]);

  const userWorkflowRole = useMemo(() =>
    currentUser?.hierarchicalAssignment?.userRole ||
    (currentUser?.Roles?.includes("BUDGET_PREPARER") ? "BUDGET PREPARER" : null), [currentUser]);

  const canCreate = useMemo(() => userWorkflowRole === "BUDGET PREPARER", [userWorkflowRole]);

  // Check if user can edit the current proposal based on their role and proposal status
  const canUserEdit = useCallback((selectedProposal, lockStatus, hasLock) => {
    if (!selectedProposal) return false;

    // Concurrency Control: Prevent edits if locked by someone else
    if (lockStatus?.isLocked && !hasLock) return false;

    const userRoles = currentUser?.Roles || [];
    const status = selectedProposal.status;
    const statusUpper = String(status || "").toUpperCase();

    // SUPER ADMIN: editable in all statuses EXCEPT Finalized
    if (isSuperAdmin) {
      return statusUpper !== "FINALIZED";
    }

    // Allow the owner (Budget Preparer) to edit while Draft/Returned
    if (isBudgetPreparer) {
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
      const currentUserId =
        currentUser?.id || currentUser?._id || currentUser?.UserId || currentUser?.Id;

      const isOwnerByName =
        selectedProposal?.processBy && userName && selectedProposal.processBy === userName;
      const isOwnerByCreatedId =
        selectedProposal?.createdBy && currentUserId
          ? String(selectedProposal.createdBy) === String(currentUserId)
          : false;
      const isOwnerByProcessId =
        selectedProposal?.processBy && currentUserId
          ? String(selectedProposal.processBy) === String(currentUserId)
          : false;
      const isAssignedById =
        currentUserId && Array.isArray(selectedProposal?.assignedPreparerUserIds)
          ? selectedProposal.assignedPreparerUserIds.some(
              (assignedId) => String(assignedId) === String(currentUserId)
            )
          : false;
      const isAssignedByName =
        userName && Array.isArray(selectedProposal?.assignedPreparerNames)
          ? selectedProposal.assignedPreparerNames.some(
              (assignedName) =>
                String(assignedName || "").trim().toLowerCase() ===
                String(userName).trim().toLowerCase()
            )
          : false;

      if (
        draftStatuses.includes(status) &&
        (isOwnerByName ||
          isOwnerByCreatedId ||
          isOwnerByProcessId ||
          isAssignedById ||
          isAssignedByName)
      ) {
        return true;
      }
    }

    // Budget Reviewer can only edit when status is Forwarded to Reviewer or Returned to Reviewer
    if (isBudgetReviewer) {
      return [
        "Forwarded to Reviewer",
        "Returned to Reviewer",
        "FORWARDED_TO_REVIEWER",
        "RETURNED_TO_REVIEWER",
      ].includes(status);
    }

    // Budget Approver can only edit when status is Forwarded to Approver or Returned to Approver
    if (isBudgetApprover) {
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
      userRoles.some((role) => ["BUDGET OFFICER", "BUDGET_OFFICER"].includes(role))
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
      userRoles.some((role) => ["BUDGET MANAGER", "BUDGET_MANAGER"].includes(role))
    ) {
      const forwardedAllowed = [
        "Forwarded to Overall Budget Approver",
        "Forwarded to Manager",
        "FORWARDED_TO_BRD_MANAGER",
        "FORWARDED_TO_MANAGER",
      ].includes(status);
      const returnedToManager =
        (status === "Returned" || status === "RETURNED") &&
        selectedProposal?.currentAssigneeRole === "BUDGET_MANAGER";
      return forwardedAllowed || returnedToManager;
    }

    return false;
  }, [currentUser, isSuperAdmin, isBudgetPreparer, isBudgetReviewer, isBudgetApprover]);

  // Pure function variant for context menus where lock status is not required
  const canUserEditProposal = useCallback((proposal) => {
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
      FORWARDED_TO_BRD_ANALYST: ["BUDGET PLANNING ANALYST", "BUDGET_PLANNING_ANALYST"],
      "Forwarded to Budget Planning Analyst": [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      RETURNED_TO_PLANNING_ANALYST: ["BUDGET PLANNING ANALYST", "BUDGET_PLANNING_ANALYST"],
      "Returned to Budget Planning Analyst": [
        "BUDGET PLANNING ANALYST",
        "BUDGET_PLANNING_ANALYST",
      ],
      FORWARDED_TO_BRD_OFFICER: ["BUDGET OFFICER", "BUDGET_OFFICER"],
      "Forwarded to Budget Officer": ["BUDGET OFFICER", "BUDGET_OFFICER"],
      RETURNED_TO_OFFICER: ["BUDGET OFFICER", "BUDGET_OFFICER"],
      "Returned to Budget Officer": ["BUDGET OFFICER", "BUDGET_OFFICER"],
      FORWARDED_TO_BRD_MANAGER: ["BUDGET MANAGER", "BUDGET_MANAGER"],
      "Forwarded to Overall Budget Approver": ["BUDGET MANAGER", "BUDGET_MANAGER"],
    };

    const allowedRoles = statusToRoleMap[currentStatus] || [];
    const userHasRole = userRoles.some((role) => allowedRoles.includes(role));

    const preparerStatuses = [
      "DRAFT",
      "Draft",
      "RETURNED_TO_PREPARER",
      "Returned to Preparer",
    ];
    if (preparerStatuses.includes(currentStatus)) {
      const currentUserId =
        currentUser?.id || currentUser?._id || currentUser?.UserId || currentUser?.Id;
      const userName =
        currentUser?.name ||
        `${currentUser?.FirstName || ""} ${currentUser?.LastName || ""}`.trim();

      const createdById = proposal?.createdBy?._id || proposal?.createdBy;
      const processById = proposal?.processBy?._id || proposal?.processBy;

      const isOwner =
        (createdById && currentUserId && String(createdById) === String(currentUserId)) ||
        (processById && currentUserId && String(processById) === String(currentUserId)) ||
        (Array.isArray(proposal?.assignedPreparerUserIds) &&
          proposal.assignedPreparerUserIds.some(
            (assignedId) => String(assignedId) === String(currentUserId || "")
          )) ||
        (userName &&
          Array.isArray(proposal?.assignedPreparerNames) &&
          proposal.assignedPreparerNames.some(
            (assignedName) =>
              String(assignedName || "").trim().toLowerCase() ===
              String(userName).trim().toLowerCase()
          ));
      return userHasRole && isOwner;
    }

    return userHasRole;
  }, [currentUser]);

  // Get available actions based on user role and proposal status
  const getAvailableActions = useCallback((
    proposal,
    analystsForMenu = [],
    headerBg = "#2d5016",
    activeSettings = null
  ) => {
    if (!proposal || !currentUser) return [];

    const userRoles = currentUser?.Roles || [];
    const currentStatus = proposal.status;
    const actions = [];

    // VIEW DETAILS (always available)
    actions.push({
      label: "View Details",
      value: "view-details",
      icon: React.createElement(ViewIcon),
      color: headerBg,
    });

    // VIEW HISTORY (always available)
    actions.push({
      label: "View History",
      value: "view-history",
      icon: React.createElement(HistoryIcon),
      color: headerBg,
    });

    // VIEW AUDIT TRAIL (always available)
    actions.push({
      label: "View Logs",
      value: "view-audit-trail",
      icon: React.createElement(LogsIcon),
      color: "#d97706",
    });

    // Forward progression, Tier, consolidation and finalization are valid only
    // for the active model/FY. Authorized return actions remain available so an
    // inactive proposal can still be routed back for correction.
    const isActiveCycle = isProposalInActiveCycle(proposal, activeSettings);

    const proposalBudgetType = getProposalBudgetType(proposal);
    const isBrdDirectAdjustment =
      proposalBudgetType === "NEP" && proposal?.nepAdjustmentMode === "BRD";

    if (canAccessNepTierAdjustment(proposal, activeSettings, userRoles)) {
      actions.push({
        label: "NEP Tier Adjustment",
        value: "open-tier",
        icon: React.createElement(TableChartIcon),
        color: headerBg,
      });
    }

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
      if (isActiveCycle && draftStatusVariants.includes(currentStatus)) {
        actions.push({
          label: `Submit ${proposalBudgetType === "NEP" ? "NEP" : "Initial"} Proposal to Budget Reviewer`,
          value: "submit-to-reviewer",
          icon: React.createElement(SendIcon),
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
        if (isActiveCycle) {
          actions.push({
            label: "Approve & Forward to Budget Approver",
            value: "reviewer-approve-forward-approver",
            icon: React.createElement(ApproveForwardIcon),
            color: "primary",
          });
        }
        actions.push({
          label: "Return to Budget Preparer",
          value: "reviewer-return",
          icon: React.createElement(ReturnIcon),
          color: "warning",
        });
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
        const analystLabelAdmin =
          analystsForMenu.length === 1
            ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${
                analystsForMenu[0]?.userId
              })`
            : "Approve & Forward to Budget/Planning Analyst";
        if (isActiveCycle) {
          actions.push({
            label: analystLabelAdmin,
            value: "approver-approve-forward-analyst",
            icon: React.createElement(ApproveForwardIcon),
            color: "primary",
          });
        }
        actions.push({
          label: "Return to Budget Reviewer",
          value: "approver-return",
          icon: React.createElement(ReturnIcon),
          color: "warning",
        });
      }

      // Super admin can do analyst actions
      if (
        [
          "Forwarded to Budget/Planning Analyst",
          "Returned to Budget/Planning Analyst",
          "Returned",
          "FORWARDED_TO_BRD_ANALYST",
          "RETURNED_TO_PLANNING_ANALYST",
        ].includes(currentStatus)
      ) {
        if (isActiveCycle) {
          actions.push({
            label: "Submit to Budget Officer",
            value: "analyst-submit-to-officer",
            icon: React.createElement(SendIcon),
            color: "primary",
          });
        }
        if (!isBrdDirectAdjustment) {
          actions.push({
            label: "Return to Budget Preparer",
            value: "analyst-return",
            icon: React.createElement(ReturnIcon),
            color: "warning",
          });
        }
      }

      // Super admin can do officer actions
      if (
        [
          "Forwarded to Budget Officer",
          "Returned to Budget Officer",
          "Returned",
          "FORWARDED_TO_BRD_OFFICER",
          "RETURNED_TO_OFFICER",
        ].includes(currentStatus)
      ) {
        if (isActiveCycle) {
          actions.push({
            label: "Submit to Budget Manager",
            value: "officer-submit-to-manager",
            icon: React.createElement(SendIcon),
            color: "primary",
          });
        }
        actions.push({
          label: isBrdDirectAdjustment
            ? "Return to Budget Planning Analyst"
            : "Return to Budget Preparer",
          value: isBrdDirectAdjustment ? "officer-return-to-analyst" : "officer-return",
          icon: React.createElement(ReturnIcon),
          color: "warning",
        });
      }

      // Super admin can finalize
      if (
        [
          "Forwarded to Overall Budget Approver",
          "Forwarded to Manager",
          "FORWARDED_TO_BRD_MANAGER",
          "FORWARDED_TO_MANAGER",
        ].includes(currentStatus) ||
        (currentStatus === "Returned" &&
          proposal?.currentAssigneeRole === "BUDGET_MANAGER") ||
        (currentStatus === "RETURNED" && proposal?.currentAssigneeRole === "BUDGET_MANAGER")
      ) {
        if (isActiveCycle) {
          actions.push({
            label: "Finalize Proposal",
            value: "manager-approve",
            icon: React.createElement(ApproveIcon),
            color: "success",
          });
        }
        actions.push({
          label: isBrdDirectAdjustment
            ? "Return to Budget Officer"
            : "Return to Budget Preparer",
          value: isBrdDirectAdjustment ? "manager-return-to-officer" : "manager-return",
          icon: React.createElement(ReturnIcon),
          color: "warning",
        });
      }

      return actions;
    }

    // BUDGET PREPARER
    if (isBudgetPreparer) {
      const draftStatusVariants = [
        "DRAFT",
        "Draft",
        "draft",
        "Returned to Preparer",
        "RETURNED_TO_PREPARER",
        "Returned",
      ];

      if (isActiveCycle && draftStatusVariants.includes(currentStatus)) {
        actions.push({
          label: `Submit ${proposalBudgetType === "NEP" ? "NEP" : "Initial"} Proposal to Budget Reviewer`,
          value: "submit-to-reviewer",
          icon: React.createElement(SendIcon),
          color: "primary",
        });
      }
    }

    // BUDGET REVIEWER
    if (
      isBudgetReviewer &&
      (currentStatus === "Forwarded to Reviewer" ||
        currentStatus === "Returned to Reviewer" ||
        currentStatus === "FORWARDED_TO_REVIEWER" ||
        currentStatus === "RETURNED_TO_REVIEWER")
    ) {
      if (isActiveCycle) {
        actions.push(
          {
          label: "Approve & Forward to Budget Approver",
          value: "reviewer-approve-forward-approver",
          icon: React.createElement(ApproveForwardIcon),
          color: "primary",
          },
          {
            label:
              analystsForMenu.length === 1
                ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${
                    analystsForMenu[0]?.userId
                  })`
                : "Forward to Budget/Planning Analyst (IMO path)",
            value: "reviewer-approve-forward-analyst",
            icon: React.createElement(SendIcon),
            color: "primary",
          }
        );
      }
      actions.push({
        label: "Return to Budget Preparer",
        value: "reviewer-return",
        icon: React.createElement(ReturnIcon),
        color: "warning",
      });
    }

    // BUDGET APPROVER
    if (isBudgetApprover) {
      if (
        currentStatus === "Forwarded to Approver" ||
        currentStatus === "Returned to Approver" ||
        currentStatus === "FORWARDED_TO_APPROVER" ||
        currentStatus === "RETURNED_TO_APPROVER"
      ) {
        const analystLabel =
          analystsForMenu.length === 1
            ? `Send to ${analystsForMenu[0]?.userName || analystsForMenu[0]?.userId} (${
                analystsForMenu[0]?.userId
              })`
            : "Approve & Forward to Budget/Planning Analyst";
        if (isActiveCycle) {
          actions.push({
            label: analystLabel,
            value: "approver-approve-forward-analyst",
            icon: React.createElement(ApproveForwardIcon),
            color: "primary",
          });
        }

        if (!proposal.isConsolidated) {
          actions.push({
            label: "Return to Budget Reviewer",
            value: "approver-return",
            icon: React.createElement(ReturnIcon),
            color: "warning",
          });
        }
      }
    }

    if (isActiveCycle && proposal.isConsolidated && (isBudgetApprover || isSuperAdmin)) {
      actions.push({
        label: "Un-consolidate Proposal",
        value: "unconsolidate",
        icon: React.createElement(UnconsolidateIcon),
        color: "error",
      });
    }

    // BUDGET PLANNING ANALYST
    if (
      currentUser?.Roles?.some((role) =>
        ["BUDGET PLANNING ANALYST", "BUDGET_PLANNING_ANALYST"].includes(role)
      ) &&
      (currentStatus === "Forwarded to Budget/Planning Analyst" ||
        currentStatus === "Returned to Budget/Planning Analyst" ||
        currentStatus === "Returned" ||
        currentStatus === "FORWARDED_TO_BRD_ANALYST" ||
        currentStatus === "RETURNED_TO_PLANNING_ANALYST")
    ) {
      if (isActiveCycle) {
        actions.push({
          label: "Submit to Budget Officer",
          value: "analyst-submit-to-officer",
          icon: React.createElement(SendIcon),
          color: "primary",
        });
      }
      if (!isBrdDirectAdjustment) {
        actions.push({
          label: "Return to Budget Preparer",
          value: "analyst-return",
          icon: React.createElement(ReturnIcon),
          color: "warning",
        });
      }
    }

    // BUDGET OFFICER
    if (
      currentUser?.Roles?.some((role) => ["BUDGET OFFICER", "BUDGET_OFFICER"].includes(role)) &&
      (currentStatus === "Forwarded to Budget Officer" ||
        currentStatus === "Returned to Budget Officer" ||
        currentStatus === "Returned" ||
        currentStatus === "FORWARDED_TO_BRD_OFFICER" ||
        currentStatus === "RETURNED_TO_OFFICER")
    ) {
      if (isActiveCycle) {
        actions.push({
          label: "Submit to Budget Manager",
          value: "officer-submit-to-manager",
          icon: React.createElement(SendIcon),
          color: "primary",
        });
      }
      actions.push({
        label: isBrdDirectAdjustment
          ? "Return to Budget Planning Analyst"
          : "Return to Budget Preparer",
        value: isBrdDirectAdjustment ? "officer-return-to-analyst" : "officer-return",
        icon: React.createElement(ReturnIcon),
        color: "warning",
      });
    }

    // BUDGET MANAGER
    if (
      (currentUser?.Roles?.includes("BUDGET MANAGER") ||
        currentUser?.Roles?.includes("BUDGET_MANAGER") ||
        currentUser?.Roles?.includes("OVERALL_BUDGET_APPROVER") ||
        currentUser?.Roles?.includes("OVERALL BUDGET APPROVER")) &&
      ([
        "Forwarded to Overall Budget Approver",
        "Forwarded to Manager",
        "FORWARDED_TO_BRD_MANAGER",
        "FORWARDED_TO_MANAGER",
      ].includes(currentStatus) ||
        (currentStatus === "Returned" &&
          proposal?.currentAssigneeRole === "BUDGET_MANAGER") ||
        (currentStatus === "RETURNED" && proposal?.currentAssigneeRole === "BUDGET_MANAGER"))
    ) {
      if (isActiveCycle) {
        actions.push({
          label: "Finalize Proposal",
          value: "manager-approve",
          icon: React.createElement(ApproveIcon),
          color: "success",
        });
      }
      actions.push({
        label: isBrdDirectAdjustment
          ? "Return to Budget Officer"
          : "Return to Budget Preparer",
        value: isBrdDirectAdjustment ? "manager-return-to-officer" : "manager-return",
        icon: React.createElement(ReturnIcon),
        color: "warning",
      });
    }

    return actions;
  }, [currentUser, isSuperAdmin, isBudgetPreparer, isBudgetReviewer, isBudgetApprover]);

  return {
    isBRDUser,
    isBRDStaff,
    isBudgetManager,
    isSuperAdmin,
    isBudgetPreparer,
    isBudgetApprover,
    isBudgetReviewer,
    canViewVersionHistory,
    canCreate,
    canUserEdit,
    canUserEditProposal,
    getAvailableActions,
  };
};
