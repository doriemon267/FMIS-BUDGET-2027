import React, { useState } from "react";
import { toast } from "react-toastify";
import api from "../../config/api";
import { Button, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import UndoIcon from "@mui/icons-material/Undo";
import SendIcon from "@mui/icons-material/Send";
import VerifiedIcon from "@mui/icons-material/Verified";
import VisibilityIcon from "@mui/icons-material/Visibility";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

/**
 * Workflow Actions Component
 * 
 * Provides action buttons for the 6-step workflow based on user role and current status:
 * Draft → Division Submitted → Department Verified → Department Submitted → Region Approved → Finalized
 */
const WorkflowActions = ({ proposal, userInfo, onRefresh, onView }) => {
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
    // Support legacy and new keys for level: assignmentLevel (old), accessScope/scope (new)
    const userLevelRaw = (userInfo?.assignmentLevel || userInfo?.accessScope || userInfo?.scope || '').toUpperCase();
    const status = proposal?.status;
    const workflowRoles = userInfo?.workflowRoles || [];

    // Map legacy assignment levels → new scopes used by workflow UI
    // DIVISION → RESPONSIBILITY_CENTER, DEPARTMENT → OFFICE, REGION → OFFICE (final verification lives in office context)
    const levelMap = {
      DIVISION: 'RESPONSIBILITY_CENTER',
      RESPONSIBILITY_CENTER: 'RESPONSIBILITY_CENTER',
      DEPARTMENT: 'OFFICE',
      OFFICE: 'OFFICE',
      REGION: 'OFFICE'
    };
    const userLevel = levelMap[userLevelRaw] || userLevelRaw;

    // Normalize/alias legacy role names to new UI keys so buttons appear correctly
    // Legacy → UI
    const roleAliases = {
      departmentConsolidator: 'officeConsolidator',
      departmentSubmission: 'officeSubmission',
      regionFinalVerifier: 'officeFinalVerifier',
      divisionCreator: 'responsibilityCenterCreator'
    };
    const normalizedRoles = new Set([
      ...workflowRoles,
      ...workflowRoles.map((r) => roleAliases[r] || r)
    ]);

    // Debug: log the values to see what's happening
    console.log('WorkflowActions Debug:', {
      userLevelRaw,
      userLevel,
      status,
      workflowRoles,
      normalizedRoles: Array.from(normalizedRoles),
      proposalId: proposal?._id,
      officeConsolidator: normalizedRoles.has("officeConsolidator"),
      officeSubmission: normalizedRoles.has("officeSubmission"),
      officeFinalVerifier: normalizedRoles.has("officeFinalVerifier"),
    });

    // Responsibility Center Level Actions
    if (userLevel === "RESPONSIBILITY_CENTER" && normalizedRoles.has("responsibilityCenterCreator")) {
      if (status === "Draft") {
        actions.push({
          label: "Submit to Office",
          action: "responsibility-center-submit",
          color: "bg-blue-500 hover:bg-blue-600",
          icon: "📤",
          description: "Submit to Office for verification"
        });
      }
    }

    // Office Level Actions
    if (userLevel === "OFFICE" && normalizedRoles.has("officeConsolidator")) {
      if (
        status === "Responsibility Center Submitted" || 
        status === "RESPONSIBILITY_CENTER_SUBMITTED" ||
        status === "Division Submitted" || 
        status === "DIVISION SUBMITTED"
      ) {
        actions.push({
          label: "Verify",
          action: "office-verify",
          color: "bg-green-500 hover:bg-green-600",
          icon: "✅",
          description: "Verify and approve the responsibility center submission"
        });
        // Temporarily disabled until backend route exists
        // actions.push({
        //   label: "Return",
        //   action: "office-return",
        //   color: "bg-red-500 hover:bg-red-600",
        //   icon: "↩️",
        //   description: "Return submission to responsibility center for revisions"
        // });
      }
      if (
        status === "Office Verified" || 
        status === "OFFICE VERIFIED" ||
        status === "OFFICE_VERIFIED" ||
        status === "Department Verified" ||
        status === "DEPARTMENT VERIFIED" ||
        status === "DEPARTMENT_VERIFIED"
      ) {
        actions.push({
          label: "Submit for Finalization",
          action: "office-submit",
          color: "bg-purple-500 hover:bg-purple-600",
          icon: "📋",
          description: "Submit for finalization"
        });
      }
    }

    // Office Level Actions (Final verification)
    if (userLevel === "OFFICE" && normalizedRoles.has("officeFinalVerifier")) {
      // When items are submitted by Office consolidator, first Approve, then Finalize
      if (
        status === "Office Submitted" || 
        status === "OFFICE SUBMITTED" ||
        status === "OFFICE_SUBMITTED" ||
        status === "Department Submitted" ||
        status === "DEPARTMENT SUBMITTED" ||
        status === "DEPARTMENT_SUBMITTED"
      ) {
        actions.push({
          label: "Approve",
          action: "office-approve",
          color: "bg-teal-500 hover:bg-teal-600",
          icon: "✔",
          description: "Approve office submission before finalization"
        });
      }
      if (
        status === "Office Approved" ||
        status === "OFFICE APPROVED" ||
        status === "OFFICE_APPROVED" ||
        status === "Region Approved" ||
        status === "REGION APPROVED"
      ) {
        actions.push({
          label: "Finalize",
          action: "office-finalize",
          color: "bg-emerald-500 hover:bg-emerald-600",
          icon: "🏆",
          description: "Finalize the submission"
        });
      }
    }

    return actions;
  };

  // Execute workflow action
  const executeWorkflowAction = async (action) => {
    setLoading(true);
    
    try {
      let endpoint = "";
      let noteField = "";
      let successMessage = "";

      switch (action) {
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
          noteField = "approvalNote";
          successMessage = "Successfully approved submission";
          break;
        case "office-finalize":
          endpoint = "/api/submission-workflow/office/finalize-submission";
          noteField = "finalizationNote";
          successMessage = "Successfully finalized submission";
          break;
        // Temporarily hide return until route exists in backend
        // case "office-return":
        //   endpoint = "/api/submission-workflow/office/return-to-responsibility-center";
        //   noteField = "returnNote";
        //   successMessage = "Successfully returned submission to responsibility center for revisions";
        //   break;
        default:
          throw new Error("Unknown workflow action");
      }

      const response = await api.post(endpoint, {
        ids: [proposal._id],
        entity: getEntityType(proposal), // Dynamic entity type based on proposal
        [noteField]: `Workflow action performed on ${new Date().toLocaleString()}`
      });

      console.log('Workflow API Call Debug:', {
        endpoint,
        requestData: {
          ids: [proposal._id],
          entity: getEntityType(proposal),
          [noteField]: `Workflow action performed on ${new Date().toLocaleString()}`
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

  // Handle action click with MUI confirm dialog
  const handleActionClick = (action, label) => {
    if (loading) return;
    setConfirmState({ open: true, action, label });
  };

  const handleConfirm = () => {
    if (!confirmState.action) return;
    executeWorkflowAction(confirmState.action);
    setConfirmState({ open: false, action: null, label: '' });
  };

  const handleClose = () => setConfirmState({ open: false, action: null, label: '' });

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
      case 'office-verify': return <CheckIcon fontSize="small" color={color} />;
      case 'office-approve': return <CheckIcon fontSize="small" color={color} />;
      case 'office-submit': return <SendIcon fontSize="small" color={color} />;
      case 'office-finalize': return <VerifiedIcon fontSize="small" color={color} />;
      case 'responsibility-center-submit': return <SendIcon fontSize="small" color={color} />;
      default: return null;
    }
  };

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
      </Menu>

      <Dialog open={confirmState.open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to perform: <strong>{confirmState.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" disabled={loading}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WorkflowActions;