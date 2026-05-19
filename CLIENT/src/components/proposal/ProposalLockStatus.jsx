import React from 'react';
import { Alert, Box, Chip, Tooltip, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

/**
 * Component to display proposal lock status
 * Shows who is currently editing the proposal and time remaining
 */
export function ProposalLockStatus({ lockStatus, isLoading = false }) {
  if (!lockStatus || !lockStatus.isLocked) {
    return (
      <Chip
        icon={<LockOpenIcon />}
        label="Not locked"
        color="primary"
        variant="outlined"
        size="small"
      />
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <span>Checking lock status...</span>
      </Box>
    );
  }

  const timeRemaining = lockStatus.timeRemaining
    ? `${Math.round(lockStatus.timeRemaining / 60000)} min`
    : 'Unknown';

  const lockMessage = `Locked by: ${lockStatus.lockedBy?.userName} (${lockStatus.lockedBy?.userRole}) - Time remaining: ${timeRemaining}`;

  return (
    <Tooltip title={lockMessage}>
      <Alert
        severity="warning"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1,
          px: 2
        }}
        icon={<LockIcon />}
      >
        <Box>
          <strong>{lockStatus.lockedBy?.userName}</strong> ({lockStatus.lockedBy?.userRole}) is editing this proposal
          <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
            <AccessTimeIcon fontSize="small" />
            <span>Time remaining: {timeRemaining}</span>
          </Box>
        </Box>
      </Alert>
    </Tooltip>
  );
}

/**
 * Component for displaying lock conflict
 */
export function LockConflictAlert({ lockedBy, onRefresh }) {
  return (
    <Alert severity="error" onClose={onRefresh} sx={{ mb: 2 }}>
      <Box>
        <strong>Cannot Edit: Proposal Locked</strong>
        <br />
        This proposal is currently being edited by <strong>{lockedBy?.userName}</strong> ({lockedBy?.userRole})
        <br />
        <small>Please wait until they finish editing, or try again later.</small>
      </Box>
    </Alert>
  );
}

/**
 * Component for displaying concurrent editors
 */
export function ConcurrentEditors({ editors }) {
  if (!editors || editors.length === 0) {
    return null;
  }

  return (
    <Box sx={{ p: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <strong>Currently viewing:</strong>
      <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
        {editors.map((editor, index) => (
          <Chip
            key={index}
            label={`${editor.userName} (${editor.userRole})`}
            size="small"
            variant="filled"
            color="info"
          />
        ))}
      </Box>
    </Box>
  );
}
