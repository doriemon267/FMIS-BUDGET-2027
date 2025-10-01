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
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { useUser } from '../context/UserContext';

const PendingAccessPage = () => {
  const { currentUser, refetchUserProfile, loading } = useUser();

  const handleRefresh = () => {
    refetchUserProfile();
  };

  // Dynamic dashboard URL based on environment
  const dashboardUrl = window.location.hostname.includes("localhost")
    ? "http://localhost:3000/dashboard"
    : "https://fmis.nia.gov.ph/dashboard";

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
            Account Pending Activation
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
            Your account is currently <strong>pending activation</strong>.  
            You will be able to use the system once your access is fully set up.
          </Typography>
        </Alert>

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
            startIcon={<DashboardIcon />}
            href={dashboardUrl}
          >
            Go to Dashboard
          </Button>
        </Box>

        {/* Additional Information */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> Access will be available once your account setup is complete.  
            User ID: {currentUser?.Username?.[0] || currentUser?.Id}
          </Typography>
        </Box>

        {/* Debug Information (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Debug Info:</strong><br />
              Roles: {JSON.stringify(currentUser?.Roles)}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default PendingAccessPage;
