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
const WorkflowActions = ({ proposal, userInfo, onRefresh, onView, showHeader = true, showTrackInMenu = true }) => {
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
    const userRoles = userInfo?.roles || [];
    const status = proposal?.status;

    // Check if user has the required role for actions
    const isBudgetAnalyst = userRoles.includes('BUDGET_ANALYST');
    const isBudgetCoordinator = userRoles.includes('BUDGET_COORDINATOR');
    const isBudgetOfficer = userRoles.includes('BUDGET_OFFICER');
    const isBudgetManager = userRoles.includes('BUDGET_MANAGER');
    const isBudgetAdmin = userRoles.includes('BUDGET_ADMIN');

    console.log('New WorkflowActions Debug:', {
      status,
      userRoles,
      isBudgetAnalyst,
      isBudgetCoordinator,
      isBudgetOfficer,
      isBudgetManager,
      isBudgetAdmin,
      proposalId: proposal?._id
    });

    // BUDGET ANALYST & BUDGET COORDINATOR Actions (Creation Level)
    if (isBudgetAnalyst || isBudgetCoordinator) {
      if (status === "Draft") {
        actions.push({
          label: "Submit to Officer",
          action: "submit-to-officer",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "📤",
          description: "Submit proposal to Budget Officer for approval"
        });
      }
    }

    // BUDGET OFFICER Actions (Approval Level)
    if (isBudgetOfficer) {
      if (status === "Draft" || status === "Submitted to Officer" || 
          status === "Responsibility Center Submitted" || status === "Division Submitted") {
        actions.push({
          label: "Approve",
          action: "officer-approve",
          color: "bg-green-500 hover:bg-green-600",
          icon: "✅",
          description: "Approve the proposal submission"
        });
        actions.push({
          label: "Return",
          action: "officer-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal to creator for revisions"
        });
      }
      if (status === "Officer Approved") {
        actions.push({
          label: "Submit to Manager",
          action: "submit-to-manager",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "📋",
          description: "Submit approved proposal to Budget Manager for finalization"
        });
      }
    }

    // BUDGET MANAGER & BUDGET ADMIN Actions (Finalization Level)
    if (isBudgetManager || isBudgetAdmin) {
      if (status === "Officer Approved" || status === "Submitted to Manager" ||
          status === "Office Submitted" || status === "Department Submitted") {
        actions.push({
          label: "Approve",
          action: "manager-approve",
          color: "bg-teal-500 hover:bg-teal-600",
          icon: "✔",
          description: "Approve proposal for finalization"
        });
        actions.push({
          label: "Return",
          action: "manager-return",
          color: "bg-red-500 hover:bg-red-600",
          icon: "↩️",
          description: "Return proposal to officer for revisions"
        });
      }
      if (status === "Manager Approved" || status === "Office Approved" || status === "Region Approved") {
        actions.push({
          label: "Finalize",
          action: "finalize",
          color: "bg-emerald-500 hover:bg-emerald-600",
          icon: "�",
          description: "Finalize the proposal submission"
        });
      }
    }

    return actions;
  };

  // Execute workflow action
  const executeWorkflowAction = async (action, noteValue) => {
    setLoading(true);
    
    try {
      let endpoint = "";
      let noteField = "";
      let successMessage = "";

      switch (action) {
        case "submit-to-officer":
          endpoint = "/api/submission-workflow/responsibility-center/submit-to-office";
          noteField = "submissionNote";
          successMessage = "Successfully submitted to Budget Officer for approval";
          break;
        case "officer-approve":
          endpoint = "/api/submission-workflow/office/verify-submission";
          noteField = "verificationNote";
          successMessage = "Successfully approved proposal";
          break;
        case "officer-return":
          endpoint = "/api/submission-workflow/office/return-to-responsibility-center";
          noteField = "returnReason";
          successMessage = "Successfully returned proposal to creator for revisions";
          break;
        case "submit-to-manager":
          endpoint = "/api/submission-workflow/office/submit-own";
          noteField = "approvalNote";
          successMessage = "Successfully submitted to Budget Manager for finalization";
          break;
        case "manager-approve":
          endpoint = "/api/submission-workflow/office/approve-submission";
          noteField = "officeApprovalNote";
          successMessage = "Successfully approved proposal for finalization";
          break;
        case "manager-return":
          endpoint = "/api/submission-workflow/office/return-to-responsibility-center";
          noteField = "returnReason";
          successMessage = "Successfully returned proposal to officer for revisions";
          break;
        case "finalize":
          endpoint = "/api/submission-workflow/office/finalize-submission";
          noteField = "finalizationNote";
          successMessage = "Successfully finalized proposal submission";
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

      const response = await api.post(endpoint, {
        ids: [proposal._id],
        entity: getEntityType(proposal), // Dynamic entity type based on proposal
        [noteField]: noteValue?.trim() || `Workflow action performed on ${new Date().toLocaleString()}`
      });

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

      console.log('Workflow API Response:', response.data);

      // Check for success - be flexible with response format
      const isSuccess = response.data.success !== false && 
                       (response.data.modified > 0 || response.data.modifiedCount > 0 || 
                        response.data.message?.includes('Successfully'));

      if (isSuccess) {
        toast.success(successMessage);
        try {
          if (typeof window !== 'undefined' && window.showSuccess) {
            window.showSuccess(`${successMessage}. Click to view All Proposals.`, 8000, () => {
              goTo('/AllProposals');
            });
          }
        } catch (_) {}
        onRefresh(); // Refresh the proposals list
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
    } finally {
      setLoading(false);
    }
  };

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState({ open: false, action: null, label: '' });
  const [returnReason, setReturnReason] = useState('');
  const isReturnAction = confirmState.action === 'office-return' || confirmState.action === 'officer-return' || confirmState.action === 'manager-return';

  // Handle action click with MUI confirm dialog
  const handleActionClick = (action, label) => {
    if (loading) return;
    setConfirmState({ open: true, action, label });
  };

  const handleConfirm = () => {
    if (!confirmState.action) return;
    // For Return action, ensure a reason is provided
    if ((confirmState.action === 'office-return' || confirmState.action === 'officer-return' || confirmState.action === 'manager-return') && !returnReason.trim()) {
      toast.error('Please provide a return reason.');
      return;
    }
    executeWorkflowAction(confirmState.action, returnReason);
    setConfirmState({ open: false, action: null, label: '' });
    setReturnReason('');
  };

  const handleClose = () => { 
    setConfirmState({ open: false, action: null, label: '' });
    setReturnReason('');
  };

  const availableActions = getAvailableActions();



  const renderIcon = (action) => {
    const iconColorMap = {
      'office-verify': 'success',
      'office-approve': 'secondary',
      'office-finalize': 'primary',
      'office-submit': 'secondary',
      'responsibility-center-submit': 'info'
    };
    const color = iconColorMap[action] || 'inherit';
    switch (action) {
      case 'submit-to-officer': return <SendIcon fontSize="small" color={color} />;
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

  // Step metadata for progress tracking - Simplified role-based workflow
  const steps = [
    { key: 'Draft', label: 'Draft' },
    { key: 'Submitted to Officer', label: 'Officer Review', ts: 'submittedToOfficerAt', by: 'submittedToOfficerBy' },
    { key: 'Officer Approved', label: 'Manager Review', ts: 'officerApprovedAt', by: 'officerApprovedBy' },
    { key: 'Manager Approved', label: 'Final Review', ts: 'managerApprovedAt', by: 'managerApprovedBy' },
    { key: 'Finalized', label: 'Finalized', ts: 'finalizedAt', by: 'finalizedBy' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === (proposal?.status || 'Draft'));

  // Dialog state for progress tracker
  const [trackOpen, setTrackOpen] = useState(false);
  const openTrack = () => setTrackOpen(true);
  const closeTrack = () => setTrackOpen(false);

  // Compact actions menu (icon + dropdown)
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleMenuItemClick = (action, label) => {
    handleMenuClose();
    handleActionClick(action, label);
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
        {/* View action at top */}
        <MenuItem onClick={() => { handleMenuClose(); onView?.(); }}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="View" secondary="Open proposal details" />
        </MenuItem>
        {availableActions.map((actionConfig, index) => (
          <MenuItem key={index} onClick={() => handleMenuItemClick(actionConfig.action, actionConfig.label)}>
            <ListItemIcon>
              {renderIcon(actionConfig.action)}
            </ListItemIcon>
            <ListItemText primary={actionConfig.label} secondary={actionConfig.description} />
          </MenuItem>
        ))}
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
          {isReturnAction && (
            <TextField
              autoFocus
              multiline
              minRows={3}
              fullWidth
              label="Return reason (required)"
              placeholder="Explain why this submission is being returned"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" disabled={loading || (isReturnAction && !returnReason.trim())}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Track progress dialog */}
      <Dialog open={trackOpen} onClose={closeTrack} maxWidth="sm" fullWidth>
        <DialogTitle>Workflow Progress</DialogTitle>
        <DialogContent>
          <Stepper activeStep={Math.max(currentStepIndex, 0)} alternativeLabel>
            {steps.map((s, idx) => {
              const ts = s.ts && proposal?.[s.ts];
              const by = s.by && proposal?.[s.by];
              return (
                <Step key={s.key} completed={idx < currentStepIndex}>
                  <StepLabel
                    optional={
                      ts ? (
                        <Typography variant="caption">
                          {new Date(ts).toLocaleString()} {by ? `— ${by}` : ''}
                        </Typography>
                      ) : undefined
                    }
                  >
                    {s.label}
                  </StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {/* Latest audit entry (if present) */}
          {Array.isArray(proposal?.workflowHistory) && proposal.workflowHistory.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Latest: {proposal.workflowHistory[proposal.workflowHistory.length - 1]?.action} → {proposal.workflowHistory[proposal.workflowHistory.length - 1]?.toStatus}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(proposal.workflowHistory[proposal.workflowHistory.length - 1]?.date).toLocaleString()} — {proposal.workflowHistory[proposal.workflowHistory.length - 1]?.byName}
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