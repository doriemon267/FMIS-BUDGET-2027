import React from 'react';
import { useUser } from '../../context/UserContext';
import {
  Box,
  CircularProgress,
  Typography,
  Paper,
  Button,
  Container,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
import HomeIcon from '@mui/icons-material/Home';

// 🔑 Dynamic dashboard URL
const dashboardUrl = window.location.hostname.includes("localhost")
  ? "http://localhost:3000/dashboard"
  : "https://fmis.nia.gov.ph/dashboard";

const AccessRestrictedPage = () => {
  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Paper
        elevation={2}
        sx={{
          p: { xs: 4, md: 6 },
          textAlign: 'center',
          borderRadius: 2,
          backgroundColor: (theme) => theme.palette.grey[50],
        }}
      >
        {/* Icon */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
          <LockIcon sx={{ fontSize: 60, color: 'error.main' }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}
        >
          Access Restricted
        </Typography>

        {/* Message */}
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', mb: 4 }}
        >
          You don’t have permission to view this page.
          <br />
          Please request access if you believe this is a mistake.
        </Typography>

        {/* Action button */}
        <Button
          variant="contained"
          startIcon={<HomeIcon />}
          href={dashboardUrl}   // ✅ Dynamic based on environment
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
          }}
        >
          Go to Dashboard
        </Button>

        {/* Footer */}
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.disabled' }}
          >
            © 2025 FMIS Budget Management System
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

const AccessGuard = ({ children }) => {
  const { currentUser, loading } = useUser();
  const location = useLocation();

  // Loading state
  if (loading || !currentUser) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading user profile...
        </Typography>
      </Box>
    );
  }

  // ✅ Check roles - Allow all Budget staff + SUPER ADMIN + Workflow roles
  const roles = currentUser?.Roles || [];
  
  // Budget staff roles + Workflow roles that should have access (6-step workflow standardized names)
  const authorizedRoles = [
    'SUPER ADMIN',
    'SUPER_ADMIN',
    'ADMIN',
    'BUDGET COORDINATOR',
    'BUDGET_COORDINATOR',
    'BUDGET MANAGER',
    'BUDGET_MANAGER',
    'BUDGET OFFICER',
    'BUDGET_OFFICER',
    'BUDGET PREPARER',
    'BUDGET REVIEWER',
    'BUDGET APPROVER',
    'BUDGET PLANNING ANALYST',
    'BUDGET_PLANNING_ANALYST',
    'OVERALL BUDGET APPROVER',
    'OVERALL_BUDGET_APPROVER',
    'REVIEWER',
    'APPROVER'
  ];
  
  const isAuthorized = roles.some(role => authorizedRoles.includes(role?.toUpperCase()));

  return children;
};

export default AccessGuard;
