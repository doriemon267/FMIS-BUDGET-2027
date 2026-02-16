/**
 * Bulk Operations Toolbar Component
 * 
 * Provides UI for selecting and performing bulk operations on table rows
 */

import React, { useState } from 'react';
import {
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Send as SubmitIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import logger from '../../utils/logger';
import { handleApiError } from '../../utils/errorHandler';
import { toast } from 'react-toastify';

const BulkOperationsToolbar = ({
  selectedCount = 0,
  totalCount = 0,
  onBulkApprove,
  onBulkReject,
  onBulkDelete,
  onBulkSubmit,
  onClearSelection,
  isLoading = false,
  allowedActions = ['approve', 'reject', 'delete', 'submit'],
  requireComment = false,
  customActions = [],
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [comment, setComment] = useState('');
  const [confirmAction, setConfirmAction] = useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleActionClick = (action) => {
    handleMenuClose();
    
    if (requireComment) {
      setActionDialog(action);
      setComment('');
      setConfirmAction(false);
    } else {
      executeAction(action, '');
    }
  };

  const executeAction = async (action, actionComment) => {
    try {
      switch (action) {
        case 'approve':
          if (onBulkApprove) {
            await onBulkApprove(actionComment);
          }
          break;
        case 'reject':
          if (onBulkReject) {
            await onBulkReject(actionComment);
          }
          break;
        case 'delete':
          if (onBulkDelete) {
            await onBulkDelete(actionComment);
          }
          break;
        case 'submit':
          if (onBulkSubmit) {
            await onBulkSubmit(actionComment);
          }
          break;
        default:
          logger.warn(`Unknown bulk action: ${action}`);
      }
      
      setActionDialog(null);
      setComment('');
      setConfirmAction(false);
    } catch (error) {
      handleApiError(error, toast, `Bulk ${action} operation`);
    }
  };

  const handleConfirmAction = () => {
    if (requireComment && !comment.trim()) {
      toast.error('Please provide a comment');
      return;
    }
    executeAction(actionDialog, comment);
  };

  const handleCloseDialog = () => {
    setActionDialog(null);
    setComment('');
    setConfirmAction(false);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          bgcolor: 'primary.light',
          color: 'primary.contrastText',
          minHeight: '48px !important',
        }}
      >
        <Typography sx={{ flex: '1 1 100%' }} color="inherit" variant="subtitle1" component="div">
          <Chip
            label={`${selectedCount} selected`}
            size="small"
            sx={{ mr: 1, bgcolor: 'primary.main', color: 'white' }}
          />
          of {totalCount} total
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {allowedActions.includes('approve') && onBulkApprove && (
            <Button
              color="inherit"
              size="small"
              startIcon={<ApproveIcon />}
              onClick={() => handleActionClick('approve')}
              disabled={isLoading}
            >
              Approve
            </Button>
          )}

          {allowedActions.includes('reject') && onBulkReject && (
            <Button
              color="inherit"
              size="small"
              startIcon={<RejectIcon />}
              onClick={() => handleActionClick('reject')}
              disabled={isLoading}
            >
              Reject
            </Button>
          )}

          {allowedActions.includes('submit') && onBulkSubmit && (
            <Button
              color="inherit"
              size="small"
              startIcon={<SubmitIcon />}
              onClick={() => handleActionClick('submit')}
              disabled={isLoading}
            >
              Submit
            </Button>
          )}

          {allowedActions.includes('delete') && onBulkDelete && (
            <Button
              color="inherit"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => handleActionClick('delete')}
              disabled={isLoading}
            >
              Delete
            </Button>
          )}

          {customActions.length > 0 && (
            <>
              <IconButton
                color="inherit"
                size="small"
                onClick={handleMenuOpen}
                disabled={isLoading}
              >
                <MoreIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                {customActions.map((action) => (
                  <MenuItem
                    key={action.id}
                    onClick={() => {
                      handleMenuClose();
                      action.onClick();
                    }}
                  >
                    {action.icon}
                    <Typography sx={{ ml: 1 }}>{action.label}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          <IconButton
            color="inherit"
            size="small"
            onClick={onClearSelection}
            disabled={isLoading}
            title="Clear selection"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={Boolean(actionDialog)}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Bulk {actionDialog ? actionDialog.charAt(0).toUpperCase() + actionDialog.slice(1) : ''}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are about to {actionDialog} {selectedCount} item(s). This action cannot be undone.
          </Alert>

          {requireComment && (
            <TextField
              autoFocus
              margin="dense"
              label="Comment (Required)"
              fullWidth
              multiline
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Please provide a reason for this action..."
              required
            />
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={confirmAction}
                onChange={(e) => setConfirmAction(e.target.checked)}
              />
            }
            label="I understand this action will affect multiple items"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={actionDialog === 'delete' ? 'error' : 'primary'}
            disabled={isLoading || !confirmAction || (requireComment && !comment.trim())}
            startIcon={isLoading ? <CircularProgress size={16} /> : null}
          >
            {isLoading ? 'Processing...' : `Confirm ${actionDialog ? actionDialog.charAt(0).toUpperCase() + actionDialog.slice(1) : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BulkOperationsToolbar;
