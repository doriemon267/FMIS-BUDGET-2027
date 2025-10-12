import React, { useState } from "react";
import { toast } from "react-toastify";
import api from "../../config/api";
import { goTo } from "../../global/navigation";
import { Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Menu, MenuItem, ListItemIcon, ListItemText, Chip, Divider, Stepper, Step, StepLabel, Box, Stack } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import UndoIcon from "@mui/icons-material/Undo";
import SendIcon from "@mui/icons-material/Send";
import VerifiedIcon from "@mui/icons-material/Verified";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TimelineIcon from "@mui/icons-material/Timeline";

/**
 * Workflow Actions Component
 * 
 * Provides action buttons for the role-based workflow based on user role and current status:
 * Draft → Submitted to Officer → Officer Approved/Returned → Submitted to Manager → Manager Approved/Returned → Finalized
 */
const WorkflowActions = ({ proposal, userInfo, onRefresh, onView, showHeader = true, showTrackInMenu = true, showViewInMenu = true }) => {
  const [loading, setLoading] = useState(false);

  // Top-level render log to confirm component renders
  console.log('WorkflowActions Render:', {
    proposalId: proposal?._id,
    status: proposal?.status,
    userLevelRaw: (userInfo?.assignmentLevel || userInfo?.accessScope || userInfo?.scope || '').toUpperCase(),
    roles: userInfo?.workflowRoles || []
  });

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
    const rawRoleSources = [
      userInfo?.roles,
      userInfo?.Roles,
      userInfo?.role,
      userInfo?.currentUser?.roles,
      userInfo?.currentUser?.Roles,
      userInfo?.currentUser?.role,
      userInfo?.currentUser?.budgetRoles,
      userInfo?.hierarchicalAccess?.roles,
      userInfo?.hierarchicalAccess?.budgetRoles,
      userInfo?.hierarchicalAccess?.userRoles,
      userInfo?.hierarchicalAccess?.workflowRoles,
      userInfo?.workflowRoles
    ];

    const normalizeRoleValue = (roleValue) => {
      if (!roleValue) return null;
      const stringValue = roleValue.toString().trim();
      if (!stringValue) return null;

      const camelCaseNormalized = stringValue
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // convert camelCase to snake_case
        .replace(/[\s-]+/g, '_')
        .replace(/__+/g, '_')
        .toUpperCase();

      const roleSynonyms = {
        // BUDGET ANALYST - Division level creators
        DIVISION_CREATOR: 'BUDGET_ANALYST',
        DIVISION_ANALYST: 'BUDGET_ANALYST',
        DIVISION_ENCODER: 'BUDGET_ANALYST',
        DIVISION_STAFF: 'BUDGET_ANALYST',
        // Temporary: Legacy role support (to be migrated)
        DIVISION_APPROVER: 'BUDGET_ANALYST', // TODO: Migrate to divisionCreator in database
        
        // BUDGET COORDINATOR - Department/Region level creators
        DEPARTMENT_CREATOR: 'BUDGET_COORDINATOR',
        DEPARTMENT_COORDINATOR: 'BUDGET_COORDINATOR',
        REGION_CREATOR: 'BUDGET_COORDINATOR',
        REGION_COORDINATOR: 'BUDGET_COORDINATOR',
        
        // BUDGET OFFICER - Department/Region level verifiers
        BUDGETOFFICER: 'BUDGET_OFFICER',
        DEPARTMENT_VERIFIER: 'BUDGET_OFFICER',
        DEPARTMENT_APPROVER: 'BUDGET_OFFICER',
        REGION_VERIFIER: 'BUDGET_OFFICER',
        REGION_APPROVER: 'BUDGET_OFFICER',
        OFFICE_VERIFIER: 'BUDGET_OFFICER',
        OFFICE_APPROVER: 'BUDGET_OFFICER',
        OFFICE_HEAD: 'BUDGET_OFFICER',
        
        // BUDGET MANAGER - Budget Office final approvers
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
        // Budget admin
        BUDGETADMIN: 'BUDGET_ADMIN'
      };

      return roleSynonyms[camelCaseNormalized] || camelCaseNormalized;
    };

    const rawRoles = rawRoleSources
      .flatMap((value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
      })
      .filter((value) => typeof value === 'string' && value.trim().length > 0);

    const roleMapping = rawRoles.map(role => ({
      original: role,
      normalized: normalizeRoleValue(role)
    }));

    const normalizedRoles = Array.from(new Set(
      rawRoles
        .map((roleValue) => normalizeRoleValue(roleValue))
        .filter(Boolean)
    ));

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

    // BUDGET ANALYST & BUDGET COORDINATOR Actions (Creation Level)
    if (isBudgetAnalyst || isBudgetCoordinator) {
      if (normalizedStatus === "DRAFT" || status === "Draft") {
        actions.push({
          label: "Submit to Officer",
          action: "submit-to-officer",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "📤",
          description: "Submit proposal to Budget Officer for approval"
        });
        
        // BUDGET ANALYST & BUDGET COORDINATOR: Direct submit to Manager (bypass Officer review)
        actions.push({
          label: "Submit to Manager (Direct)",
          action: "submit-direct-to-manager",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "⚡",
          description: "Submit proposal directly to Budget Manager (bypasses Officer review)"
        });
      }
    }

    // BUDGET OFFICER Actions (Approval Level)
    if (isBudgetOfficer) {
      if (normalizedStatus === "DIVISION SUBMITTED" || normalizedStatus === "OFFICE" || 
          status === "Division Submitted" || status === "Office") {
        actions.push({
          label: "Verify",
          action: "officer-verify",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "✓",
          description: "Verify the proposal (marks as verified without changing status)",
          requiresComment: true
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
          label: "Return",
          action: "officer-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal to creator for revisions",
          requiresComment: true
        });
      }
      if (normalizedStatus === "OFFICE APPROVED" || status === "Office Approved") {
        actions.push({
          label: "Submit to Manager",
          action: "submit-to-manager",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "📋",
          description: "Consolidate and submit approved proposals to Budget Manager"
        });
      }
    }

    // BUDGET MANAGER & BUDGET ADMIN Actions (Finalization Level)
    if (isBudgetManager || isBudgetAdmin) {
      const managerStatuses = [
        'OFFICE SUBMITTED',
        'SUBMITTED TO MANAGER',
        'OFFICER APPROVED'
      ];

      if (managerStatuses.includes(normalizedStatus) ||
          ['Office Submitted', 'Submitted to Manager', 'Officer Approved'].includes(status)) {
        actions.push({
          label: "Approve",
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
          description: "Return proposal to officer for revisions",
          requiresComment: true
        });
      }
    }

    console.log('🎯 Available Actions:', actions.length, actions.map(a => a.label));

    return actions;
  };

  // Execute workflow action
  const executeWorkflowAction = async (action, noteValue) => {
    setLoading(true);
    
    let endpoint = "";
    let noteField = "";
    let successMessage = "";
    
    try {

      switch (action) {
        case "submit-to-officer":
          endpoint = "/api/workflow/submit";
          successMessage = "Proposal submitted to Budget Officer successfully";
          break;
        case "submit-direct-to-manager":
          endpoint = "/api/workflow/submit-direct-to-manager";
          successMessage = "Proposal submitted directly to Budget Manager successfully";
          break;
        case "officer-verify":
          endpoint = "/api/workflow/verify";
          successMessage = "Proposal verified successfully";
          break;
        case "officer-approve":
          endpoint = "/api/workflow/approve";
          successMessage = "Proposal approved successfully";
          break;
        case "officer-return":
          endpoint = "/api/workflow/return";
          successMessage = "Proposal returned successfully";
          break;
        case "submit-to-manager":
          endpoint = "/api/workflow/consolidate";
          successMessage = "Proposals consolidated and submitted to Budget Manager successfully";
          break;
        case "manager-approve":
          endpoint = "/api/workflow/approve";
          successMessage = "Proposal approved by Budget Manager successfully";
          break;
        case "manager-return":
          endpoint = "/api/workflow/return";
          successMessage = "Proposal returned to Budget Officer successfully";
          break;
        // Legacy actions for backward compatibility
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

      if (action === "submit-to-officer") {
        requestData.comment = noteValue || "";
      } else if (action === "officer-verify") {
        requestData.comment = noteValue;
      } else if (action === "officer-approve" || action === "manager-approve") {
        requestData.comment = noteValue;
      } else if (action === "officer-return" || action === "manager-return") {
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

      console.log('Workflow API Call Debug:', {
        endpoint,
        requestData: {
          ids: [proposal._id],
          entity: getEntityType(proposal),
          [noteField]: noteValue?.trim() || `Workflow action performed on ${new Date().toLocaleString()}`
        },
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
      const isSuccess = response.data.success === true || 
                       response.data.modified > 0 || 
                       response.data.modifiedCount > 0 || 
                       (response.data.message && 
                        response.data.message.toLowerCase().includes('successfully'));

      console.log('🎯 SUCCESS CHECK RESULT:', isSuccess);

      if (isSuccess) {
        toast.success(successMessage);
        try {
          if (typeof window !== 'undefined' && window.showSuccess) {
            window.showSuccess(successMessage + ' — Click to open All Proposals', 8000, () => {
              goTo('/AllProposals');
            });
          }
        } catch (_) {}
        
        // Add a small delay to ensure backend processing is complete before refresh
        console.log('✅ Workflow action successful, refreshing data in 500ms...');
        setTimeout(() => {
          console.log('🔄 Calling onRefresh after workflow success');
          onRefresh(); // Refresh the proposals list
        }, 500);
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
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      try {
        if (typeof window !== 'undefined' && window.showError) {
          window.showError(errorMessage, 8000);
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState({ open: false, action: null, label: '', requiresComment: false });
  const [comment, setComment] = useState('');
  const requiresComment = confirmState.requiresComment || confirmState.action === 'officer-return' || confirmState.action === 'manager-return' ||
                          confirmState.action === 'officer-approve' || confirmState.action === 'manager-approve';

  // Handle action click with MUI confirm dialog
  const handleActionClick = (action, label, requiresComment = false) => {
    if (loading) return;
    setConfirmState({ open: true, action, label, requiresComment });
  };

  const handleConfirm = () => {
    if (!confirmState.action) return;
    // For actions that require comments, ensure a comment is provided
    if (requiresComment && !comment.trim()) {
      toast.error('Please provide a comment.');
      return;
    }
    executeWorkflowAction(confirmState.action, comment);
    setConfirmState({ open: false, action: null, label: '', requiresComment: false });
    setComment('');
  };

  const handleClose = () => { 
    setConfirmState({ open: false, action: null, label: '', requiresComment: false });
    setComment('');
  };

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
      case 'submit-to-officer': return <SendIcon fontSize="small" color={color} />;
      case 'submit-direct-to-manager': return <SendIcon fontSize="small" color={color} />;
      case 'officer-approve': return <CheckIcon fontSize="small" color={color} />;
      case 'officer-return': return <UndoIcon fontSize="small" color={color} />;
      case 'submit-to-manager': return <SendIcon fontSize="small" color={color} />;
      case 'manager-approve': return <CheckIcon fontSize="small" color={color} />;
      case 'manager-return': return <UndoIcon fontSize="small" color={color} />;
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

  // Step metadata for progress tracking - adapt to whether there's a manager phase
  const steps = hasManagerPhase
    ? [
        { key: 'Draft', label: 'Draft' },
        { key: 'Submitted to Officer', label: 'Officer Review', ts: 'submittedToOfficerAt', by: 'submittedToOfficerBy' },
        { key: 'Officer Approved', label: 'Manager Review', ts: 'officerApprovedAt', by: 'officerApprovedBy' },
        { key: 'Manager Approved', label: 'Final Review', ts: 'managerApprovedAt', by: 'managerApprovedBy' },
        { key: 'Finalized', label: 'Finalized', ts: 'finalizedAt', by: 'finalizedBy' }
      ]
    : [
        { key: 'Draft', label: 'Draft' },
        { key: 'Submitted to Officer', label: 'Officer Review', ts: 'submittedToOfficerAt', by: 'submittedToOfficerBy' },
        // In flows without manager phase, treat Office Approved as the final step and surface its audit fields
        { key: 'Finalized', label: 'Office Approved', ts: 'officerApprovedAt', by: 'officerApprovedBy' }
      ];

  // Map alternate status labels to step keys
  const stepKeySynonyms = {
    'Office Submitted': 'Submitted to Officer',
    // If no manager phase, map Office Approved directly to Finalized for indicator purposes
    'Office Approved': hasManagerPhase ? 'Officer Approved' : 'Finalized'
  };
  const normalizedStatusForStep = stepKeySynonyms[proposal?.status] || proposal?.status || 'Draft';
  const currentStepIndex = Math.max(steps.findIndex(s => s.key === normalizedStatusForStep), 0);

  // Dialog state for progress tracker
  const [trackOpen, setTrackOpen] = useState(false);
  const openTrack = () => setTrackOpen(true);
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
    // Normalize synonyms and map to a consistent palette
    if (s.includes('draft')) return 'default';
    if (s.includes('submitted to officer') || s.includes('division submitted') || s.includes('responsibility center submitted') || s.includes('office submitted')) return 'info';
    if (s.includes('verified')) return 'info';
    if (s.includes('officer approved') || s === 'office approved') return 'success';
    if (s.includes('manager approved')) return 'secondary';
    if (s.includes('returned')) return 'error';
    if (s.includes('finalized') || s.includes('approved')) return 'primary';
    return 'default';
  };

  // Icons to show inside step markers
  const getStepIcon = (key, { active, completed } = {}) => {
    const color = completed ? 'success' : active ? 'primary' : 'disabled';
    switch (key) {
      case 'Draft':
        return <TimelineIcon fontSize="small" color={color} />;
      case 'Submitted to Officer':
        return <SendIcon fontSize="small" color={color} />;
      case 'Officer Approved':
        return <CheckIcon fontSize="small" color={color} />;
      case 'Manager Approved':
        return <CheckIcon fontSize="small" color={color} />;
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
  const handleMenuItemClick = (action, label, requiresComment = false) => {
    handleMenuClose();
    handleActionClick(action, label, requiresComment);
  };

  return (
    <>
      {/* Status header with track + actions */}
      {showHeader && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
          {/* <Chip
            size="small"
            label={proposal?.status || 'Draft'}
            color={(() => {
              switch (proposal?.status) {
                case 'Responsibility Center Submitted':
                case 'RESPONSIBILITY_CENTER_SUBMITTED':
                  return 'info';
                case 'Office Verified':
                case 'OFFICE_VERIFIED':
                  return 'success';
                case 'Office Submitted':
                case 'OFFICE_SUBMITTED':
                  return 'secondary';
                case 'Office Approved':
                case 'OFFICE_APPROVED':
                  return 'success';
                case 'Finalized':
                  return 'primary';
                default:
                  return 'default';
              }
            })()}
            variant="outlined"
          /> */}

          {/* <Tooltip title="Track progress" arrow>
            <span>
              <Button
                size="small"
                variant="text"
                startIcon={<TimelineIcon fontSize="small" />}
                onClick={openTrack}
                sx={{ textTransform: 'none' }}
              >
                Track
              </Button>
            </span>
          </Tooltip> */}

          <Box sx={{ flexGrow: 1 }} />

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
            <MenuItem key={index} onClick={() => handleMenuItemClick(actionConfig.action, actionConfig.label, actionConfig.requiresComment)}>
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
          {requiresComment && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              fullWidth
              label="Comment (required)"
              placeholder={confirmState.action.includes('approve') ? "Explain your approval decision" : "Explain why this is being returned"}
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

          {/* Latest audit entry (if present) */}
          {Array.isArray(proposal?.workflowHistory) && proposal.workflowHistory.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Latest: {proposal.workflowHistory[proposal.workflowHistory.length - 1]?.action} → {proposal.workflowHistory[proposal.workflowHistory.length - 1]?.newStatus}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(proposal.workflowHistory[proposal.workflowHistory.length - 1]?.timestamp)}
                {(() => {
                  const last = proposal.workflowHistory[proposal.workflowHistory.length - 1];
                  const name = resolveUserDisplay(last?.userName || last?.user || last?.performedBy || last?.by);
                  return name ? ` — ${name}` : '';
                })()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTrack}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WorkflowActions;