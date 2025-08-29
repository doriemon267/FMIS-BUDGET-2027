import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Alert, 
  CircularProgress,
  Button,
  Divider
} from '@mui/material';
import { 
  Lock as LockIcon, 
  Schedule as ScheduleIcon,
  ContactSupport as ContactIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useUser } from '../context/UserContext';

const PendingRegionAssignmentPage = () => {
  const { currentUser, refetchUserProfile, loading } = useUser();

  const handleRefresh = () => {
    refetchUserProfile();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Paper
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          textAlign: 'center',
          boxShadow: 3
        }}
      >
        {/* Header Icon */}
        <Box sx={{ mb: 3 }}>
          <LockIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Access Restricted
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Region Assignment Required
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* User Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>Welcome, {currentUser?.FirstName} {currentUser?.LastName}!</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            User ID: {currentUser?.Username?.[0] || currentUser?.Id || 'Unknown'}
          </Typography>
        </Box>

        {/* Status Alert */}
        <Alert 
          severity="warning" 
          icon={<ScheduleIcon />}
          sx={{ mb: 3, textAlign: 'left' }}
        >
          <Typography variant="body2">
            Your account is currently <strong>pending region assignment</strong>. 
            You cannot access the FMIS Budget System until an administrator assigns you to a region.
          </Typography>
        </Alert>

        {/* Instructions */}
        <Box sx={{ mb: 4, textAlign: 'left' }}>
          <Typography variant="h6" gutterBottom>
            What happens next?
          </Typography>
          <Typography variant="body2" paragraph>
            1. <strong>Administrator Review:</strong> Your account needs to be assigned to a specific region (e.g., Central Office, CAR, Region I, etc.)
          </Typography>
          <Typography variant="body2" paragraph>
            2. <strong>Region Assignment:</strong> Once assigned, you'll have access to budget data for your designated region
          </Typography>
          <Typography variant="body2" paragraph>
            3. <strong>System Access:</strong> After assignment, refresh this page or log out and log back in
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Checking...' : 'Check Status'}
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<ContactIcon />}
            href="mailto:admin@budget.gov.ph"
          >
            Contact Administrator
          </Button>
        </Box>

        {/* Additional Information */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Need immediate access?</strong><br />
            Contact your system administrator with your User ID: {currentUser?.Username?.[0] || currentUser?.Id}
          </Typography>
        </Box>

        {/* Debug Information (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Debug Info:</strong><br />
              Regions: {currentUser?.regions?.length || 0}<br />
              Roles: {JSON.stringify(currentUser?.Roles)}<br />
              Region Assignments: {JSON.stringify(currentUser?.regionAssignments)}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default PendingRegionAssignmentPage;
