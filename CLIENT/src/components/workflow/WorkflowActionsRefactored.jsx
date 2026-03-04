import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography
} from '@mui/material';
import {
  Send as SendIcon,
  Undo as UndoIcon,
  Check as CheckIcon,
  ThumbUp as ApproveIcon,
  KeyboardArrowDown as ArrowIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
  OpenInFull as DetailsIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../config/api';
import QuickProposalView from './QuickProposalView';
import ProposalDetailsWithTables from './ProposalDetailsWithTables';
import { createWorkflowDigitalSignature, actionRequiresDigitalSignature } from '../../utils/digitalSignature';

const WORKFLOW_ROLES = {
  'BUDGET PREPARER': 'Preparer',
  'BUDGET REVIEWER': 'Reviewer',
  'BUDGET APPROVER': 'Approver',
  'BUDGET PLANNING ANALYST': 'Analyst',
  'BUDGET OFFICER': 'Officer',
  'OVERALL BUDGET APPROVER': 'Manager',
  'SUPER ADMIN': 'Admin'
};

const normalizeRoleValue = (roleValue) => {
  if (!roleValue || typeof roleValue !== 'string') return '';
  const normalized = roleValue.trim().toUpperCase().replace(/\s+/g, ' ');
  return normalized;
};

const isReviewerStage = (status) => {
  if (!status) return false;
  const normalized = String(status || '').toUpperCase();
  return normalized.includes('FORWARDED TO REVIEWER') || 
         normalized === 'DIVISION SUBMITTED' || 
         normalized === 'REVIEWER_REVIEW' ||
         normalized.includes('REVIEWER');
};

const getWorkflowActions = (userRole, proposalStatus, assignmentLevel) => {
  const role = normalizeRoleValue(userRole || '');
  const status = String(proposalStatus || '').toUpperCase();

  const actions = [];

  if (role === 'BUDGET PREPARER') {
    if (status === 'DRAFT' || status === 'RETURNED' || status === 'INITIAL') {
      // If user is assigned at the OFFICE level, allow direct submit to Approver
      if (assignmentLevel && String(assignmentLevel).toUpperCase() === 'OFFICE') {
        actions.push({
          id: 'submit-to-approver',
          label: 'Submit to Approver',
          icon: SendIcon,
          color: 'success',
          requiresComment: false,
          endpoint: '/api/allproposal/proposals/${proposalId}/action',
          workflowAction: 'submit-to-approver'
        });
      } else {
        actions.push({
          id: 'submit-to-reviewer',
          label: 'Submit to Reviewer',
          icon: SendIcon,
          color: 'success',
          requiresComment: false,
          endpoint: '/api/allproposal/proposals/${proposalId}/action',
          workflowAction: 'submit-to-reviewer'
        });
      }
    }
  }

  if (role === 'BUDGET REVIEWER') {
    if (isReviewerStage(status)) {
      actions.push({
        id: 'approve-to-approver',
        label: 'Approve & Forward to Approver',
        icon: CheckIcon,
        color: 'success',
        requiresComment: false,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'submit-to-approver'
      });
      actions.push({
        id: 'save-edits',
        label: 'Save Edits',
        icon: SendIcon,
        color: 'info',
        requiresComment: false,
        endpoint: '/api/workflow/reviewer/save-edits'
      });
      actions.push({
        id: 'return-to-preparer',
        label: 'Return to Preparer',
        icon: UndoIcon,
        color: 'error',
        requiresComment: true,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'return-to-preparer'
      });
    }
  }

  if (role === 'BUDGET APPROVER') {
    if (status.includes('FORWARDED TO APPROVER') || status === 'APPROVER_REVIEW') {
      actions.push({
        id: 'approve-to-analyst',
        label: 'Forward to Analyst',
        icon: SendIcon,
        color: 'success',
        requiresComment: false,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'submit-to-analyst'
      });
      actions.push({
        id: 'save-edits',
        label: 'Save Edits',
        icon: SendIcon,
        color: 'info',
        requiresComment: false,
        endpoint: '/api/workflow/approver/save-edits'
      });
      actions.push({
        id: 'approve-to-officer',
        label: 'Fast-Track to Officer',
        icon: ApproveIcon,
        color: 'primary',
        requiresComment: false,
        endpoint: '/api/workflow/approver/approve-forward-to-officer'
      });
      actions.push({
        id: 'return-to-reviewer',
        label: 'Return to Reviewer',
        icon: UndoIcon,
        color: 'error',
        requiresComment: true,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'return-to-reviewer'
      });
    }
  }

  if (role === 'BUDGET PLANNING ANALYST') {
    if (status.includes('FORWARDED TO ANALYST') || status.includes('ANALYST_REVIEW')) {
      actions.push({
        id: 'validate-to-officer',
        label: 'Validate & Forward to Officer',
        icon: CheckIcon,
        color: 'success',
        requiresComment: false,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'forward-to-officer'
      });
      actions.push({
        id: 'save-edits',
        label: 'Save Edits',
        icon: SendIcon,
        color: 'info',
        requiresComment: false,
        endpoint: '/api/workflow/analyst/save-edits'
      });
      actions.push({
        id: 'return-to-approver',
        label: 'Return to Approver',
        icon: UndoIcon,
        color: 'error',
        requiresComment: true,
        endpoint: '/api/workflow/analyst/return-to-approver'
      });
    }
  }

  if (role === 'BUDGET OFFICER') {
    if (status.includes('FORWARDED TO OFFICER') || status === 'OFFICER_REVIEW') {
      actions.push({
        id: 'save-edits',
        label: 'Save Edits',
        icon: SendIcon,
        color: 'info',
        requiresComment: false,
        endpoint: '/api/workflow/officer/save-edits'
      });
      actions.push({
        id: 'approve-to-manager',
        label: 'Forward to Manager',
        icon: SendIcon,
        color: 'success',
        requiresComment: false,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'forward-to-manager'
      });
      actions.push({
        id: 'return-proposal',
        label: 'Return Proposal',
        icon: UndoIcon,
        color: 'error',
        requiresComment: true,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'return-to-preparer'
      });
    }
  }

  if (role === 'OVERALL BUDGET APPROVER' || role === 'BUDGET MANAGER') {
    if (status.includes('FORWARDED TO MANAGER') || status === 'MANAGER_REVIEW') {
      actions.push({
        id: 'save-edits',
        label: 'Save Edits',
        icon: SendIcon,
        color: 'info',
        requiresComment: false,
        endpoint: '/api/workflow/manager/save-edits'
      });
      actions.push({
        id: 'finalize',
        label: 'Finalize Proposal',
        icon: CheckIcon,
        color: 'success',
        requiresComment: false,
        endpoint: '/api/allproposal/proposals/${proposalId}/action',
        workflowAction: 'finalize'
      });
      actions.push({
        id: 'return-to-officer',
        label: 'Return to Officer',
        icon: UndoIcon,
        color: 'error',
        requiresComment: true,
        endpoint: '/api/workflow/manager/return-to-officer'
      });
    }
  }

  return actions;
};

const WorkflowActionsRefactored = ({
  proposal,
  userRole,
  userInfo,
  restrictToRole,
  onActionComplete,
  onRefresh,
  showViewHistory = true
}) => {
  function extractRoleFromUserInfo(user) {
    if (!user) {
      return '';
    }
    
    const ROLE_PRIORITY = [
      'OVERALL BUDGET APPROVER',
      'BUDGET OFFICER',
      'BUDGET PLANNING ANALYST',
      'BUDGET APPROVER',
      'BUDGET REVIEWER',
      'BUDGET PREPARER',
      'SUPER ADMIN'
    ];
    
    const sources = [
      { name: 'workflowRoles', value: user?.workflowRoles },
      { name: 'Roles', value: user?.Roles },
      { name: 'roles', value: user?.roles },
      { name: 'role', value: user?.role }
    ];
    
    const allRoles = [];
    for (const { name, value } of sources) {
      if (Array.isArray(value) && value.length > 0) {
        const normalized = value.map(v => normalizeRoleValue(v)).filter(v => v);
        allRoles.push(...normalized);
      } else if (typeof value === 'string' && value.trim()) {
        const normalized = normalizeRoleValue(value);
        if (normalized) {
          allRoles.push(normalized);
        }
      }
    }
    
    if (allRoles.length === 0) {
      return '';
    }
    
    for (const priorityRole of ROLE_PRIORITY) {
      if (allRoles.includes(priorityRole)) {
        return priorityRole;
      }
    }
    
    const selectedRole = allRoles[0];
    return selectedRole;
  }

  const effectiveUserRole = userRole || extractRoleFromUserInfo(userInfo);
  
  const effectiveOnComplete = onActionComplete || ((response) => {
    if (onRefresh) {
      onRefresh(response);
    }
  });
  const navigate = useNavigate();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [commentDialog, setCommentDialog] = useState({
    open: false,
    action: null,
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const signerMode = String(import.meta.env.VITE_PNPKI_SIGNER_MODE || '').toLowerCase() || 'disabled';

  const actions = getWorkflowActions(effectiveUserRole, proposal?.status, userInfo?.assignmentLevel || userInfo?.hierarchicalAccess?.assignmentLevel || userInfo?.assignmentLevel);

  const handleCommentSubmit = useCallback(async () => {
    if (!commentDialog.action) return;

    const { comment, action } = commentDialog;
    if (action.requiresComment && !comment.trim()) {
      setError('Comment is required for this action');
      return;
    }

    const proposalId = proposal?._id || proposal?.id;
    if (!proposalId) {
      setError('Proposal ID not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Allow placeholders in endpoint to be replaced with runtime values
      const proposalId = proposal?._id || proposal?.id;
      let endpoint = action.endpoint || '';
      if (endpoint.includes('${proposalId}')) endpoint = endpoint.replace('${proposalId}', proposalId);
      const requestBody = {
        proposalId,
        comment: comment || ''
      };

      if (action.workflowAction) {
        requestBody.action = action.workflowAction;
      }

      if (action.workflowAction) {
        const digitalSignature = await createWorkflowDigitalSignature({
          proposal,
          workflowAction: action.workflowAction,
          comment: comment || '',
          userInfo
        });

        if (digitalSignature) {
          requestBody.digitalSignature = digitalSignature;
        }
      }

      const response = await api.post(endpoint, requestBody);

      toast.success('Action completed successfully');
      setCommentDialog({ open: false, action: null, comment: '' });

      if (effectiveOnComplete) {
        effectiveOnComplete(response.data);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to complete action';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [commentDialog, proposal?._id, proposal?.id, effectiveOnComplete]);

  const handleActionClick = (action) => {
    setCommentDialog({
      open: true,
      action,
      comment: ''
    });
    setError(null);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const fetchHistory = useCallback(async () => {
    const proposalId = proposal?._id || proposal?.id;
    if (!proposalId) {
      console.warn('No proposal ID found for history fetch', { proposal });
      return;
    }

    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/workflow/history/${proposalId}`);
      // console.log('📋 History fetched:', response.data);
      setHistory(response.data.history || []);
      setHistoryOpen(true);
    } catch (err) {
      console.error('❌ Failed to fetch history:', err);
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [proposal?._id, proposal?.id]);

  const hasActions = actions && actions.length > 0;

  const primaryAction = hasActions ? actions[0] : null;
  const secondaryActions = hasActions ? actions.slice(1) : [];

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* View Quick Summary Button - Always available */}
      <Tooltip title="Quick proposal summary">
        <Button
          variant="outlined"
          size="small"
          startIcon={<VisibilityIcon />}
          onClick={() => setViewDialogOpen(true)}
          color="primary"
        >
          View
        </Button>
      </Tooltip>

      {/* View Details with Tables Button - Now navigates to FULL PAGE */}
      <Tooltip title="View proposal details with itemized tables (Full Page)">
        <Button
          variant="outlined"
          size="small"
          startIcon={<DetailsIcon />}
          onClick={() => {
            if (proposal?._id) {
              // console.log('🔗 DETAILS button: Navigating to full page proposal details:', proposal._id);
              navigate(`/proposal-details/${proposal._id}`, { 
                state: { proposal }
              });
            }
          }}
          color="info"
        >
          Details
        </Button>
      </Tooltip>

      {/* Primary Action Button - Only show when user can act */}
      {primaryAction && (
        <Tooltip title={primaryAction.label}>
          <Button
            variant="contained"
            color={primaryAction.color}
            startIcon={<primaryAction.icon />}
            onClick={() => handleActionClick(primaryAction)}
            disabled={loading}
            size="small"
          >
            {primaryAction.label}
          </Button>
        </Tooltip>
      )}

      {/* Secondary Actions Menu - Only show when user can act */}
      {hasActions && secondaryActions.length > 0 && (
        <>
          <Button
            variant="outlined"
            endIcon={<ArrowIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            size="small"
          >
            More
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {secondaryActions.map(action => (
              <MenuItem
                key={action.id}
                onClick={() => {
                  handleActionClick(action);
                  handleMenuClose();
                }}
              >
                <ListItemIcon>
                  <action.icon />
                </ListItemIcon>
                {action.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {/* View History Button - Always available to see workflow progress */}
      {showViewHistory && (
        <Tooltip title={hasActions ? "View workflow history" : "View workflow progress"}>
          <Button
            variant={hasActions ? "text" : "outlined"}
            size="small"
            startIcon={<HistoryIcon />}
            onClick={fetchHistory}
            disabled={historyLoading}
            color={hasActions ? "inherit" : "primary"}
          >
            {hasActions ? "History" : "View Progress"}
          </Button>
        </Tooltip>
      )}

      {/* Comment Dialog */}
      <Dialog
        open={commentDialog.open}
        onClose={() => setCommentDialog({ open: false, action: null, comment: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {commentDialog.action?.label}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {commentDialog.action?.requiresComment && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Required Comment
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Enter your comment..."
                  value={commentDialog.comment}
                  onChange={(e) => setCommentDialog(prev => ({
                    ...prev,
                    comment: e.target.value
                  }))}
                  disabled={loading}
                />
              </Box>
            )}

            {commentDialog.action?.workflowAction && actionRequiresDigitalSignature(commentDialog.action.workflowAction) && (
              <Alert severity="warning" icon={<InfoIcon />}>
                This action requires a digital signature. Signer mode: <strong>{signerMode}</strong>.
              </Alert>
            )}

            <Alert severity="info" icon={<InfoIcon />}>
              This action will be recorded in the audit trail
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCommentDialog({ open: false, action: null, comment: '' })}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommentSubmit}
            variant="contained"
            disabled={loading || (commentDialog.action?.requiresComment && !commentDialog.comment.trim())}
          >
            {loading ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Workflow History</DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : history.length === 0 ? (
            <Alert severity="info">No history available</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {history.map((item, idx) => (
                <Box key={idx} sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip
                      label={item.action}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="textSecondary">
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>By:</strong> {item.userName}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Status:</strong> {item.previousStatus} → {item.newStatus}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Comment:</strong> {item.comment}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Quick View Dialog */}
      <QuickProposalView
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        proposal={proposal}
      />

      {/* Detailed View with Tables Dialog */}
      <ProposalDetailsWithTables
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        proposal={proposal}
        userInfo={userInfo}
      />
    </Box>
  );
};

export default WorkflowActionsRefactored;
