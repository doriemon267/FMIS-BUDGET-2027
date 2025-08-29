import React from 'react';
import { useUser } from '../../context/UserContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import PendingRegionAssignmentPage from '../../pages/PendingRegionAssignmentPage';
import { useLocation, Navigate } from 'react-router-dom';

const RegionAssignmentGuard = ({ children }) => {
  const { currentUser, loading } = useUser();
  const location = useLocation();

  // Show loading while user data is being fetched
  if (loading || !currentUser) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading user profile...
        </Typography>
      </Box>
    );
  }

  // Check hierarchical access first (preferred over legacy regions)
  const access = currentUser?.hierarchicalAccess;
  const hasHierarchicalAccess = Boolean(
    access && (
      access.scope === 'FULL' ||
      (access.accessibleRegions && access.accessibleRegions.length > 0) ||
      (access.accessibleDepartments && access.accessibleDepartments.length > 0) ||
      (access.accessibleDivisions && access.accessibleDivisions.length > 0)
    )
  );
  // Backwards compat: still consider legacy regions if present
  const hasRegionAssignments = (currentUser.regions && currentUser.regions.length > 0) || hasHierarchicalAccess;

  // Basic role helpers
  const roles = currentUser?.Roles || [];
  const isAdminish = roles.includes('SUPER ADMIN') || roles.includes('BUDGET ADMIN') || roles.includes('BUDGET MANAGER');

  // Allowlist of routes that should be reachable even when unassigned
  const allowedWhenUnassigned = ['/region-selection', '/hierarchical-user-assignments'];
  const onAllowedUnassignedRoute = allowedWhenUnassigned.some((p) => location.pathname.startsWith(p));

  // If user has no region assignments, show the pending page
  if (!hasRegionAssignments) {
    // If user has elevated role, steer them to the assignment page instead of blocking the whole app
    if (isAdminish) {
      return onAllowedUnassignedRoute ? children : <Navigate to="/hierarchical-user-assignments" replace />;
    }
    // Non-admins see the pending page
    return <PendingRegionAssignmentPage />;
  }

  // User has region assignments, allow access to the main application
  return children;
};

export default RegionAssignmentGuard;
