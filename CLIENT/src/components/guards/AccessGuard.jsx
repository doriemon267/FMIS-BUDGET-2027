import React from 'react';
import { useUser } from '../../context/UserContext';
import {
  Box,
  CircularProgress,
  Typography,
  Paper,
  Button,
  Container,
  Stack,
  useTheme,
} from '@mui/material';
import { hasBudgetModuleAccess } from '../../constants/roles';
import LockIcon from '@mui/icons-material/Lock';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import IS_PRODUCTION from '../../utils/IS_PRODUCTION';

/** Main FMIS dashboard URL - for users who accidentally land on Budget without a budget role */
const mainFmisDashboardUrl = IS_PRODUCTION
  ? 'https://fmis.nia.gov.ph/dashboard'
  : 'https://main.fmis.local/dashboard';

/** Page shown when user has no budget role or is unauthorized SUPER_ADMIN - redirect back to main FMIS */
const NoBudgetRolePage = ({ onLogout, message }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        background: isDark
          ? 'linear-gradient(180deg, rgba(30,30,40,0.97) 0%, rgba(20,20,28,0.99) 100%)'
          : 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={isDark ? 0 : 8}
          sx={{
            p: { xs: 3, sm: 5 },
            textAlign: 'center',
            borderRadius: 3,
            backgroundColor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            border: (t) =>
              t.palette.mode === 'dark'
                ? `1px solid ${t.palette.divider}`
                : '1px solid rgba(255,255,255,0.8)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.4)'
              : '0 20px 60px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.03)',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 88,
              height: 88,
              borderRadius: '50%',
              mb: 3,
              background: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(211,47,47,0.15)'
                  : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              color: (t) => t.palette.error.main,
            }}
          >
            <LockIcon sx={{ fontSize: 44 }} />
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 1.5,
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            Access Restricted
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              mb: 4,
              lineHeight: 1.7,
              maxWidth: 400,
              mx: 'auto',
            }}
          >
            {message ?? 'Your account does not have a budget role. If you accidentally landed here, return to the main FMIS dashboard. To request access, contact your System Administrator.'}
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
            alignItems="stretch"
            sx={{ mb: 1 }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<HomeIcon />}
              href={mainFmisDashboardUrl}
              sx={{
                px: 3.5,
                py: 1.75,
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: (t) =>
                  t.palette.mode === 'dark'
                    ? 'none'
                    : `0 4px 14px ${theme.palette.primary.main}40`,
                '&:hover': {
                  boxShadow: (t) =>
                    t.palette.mode === 'dark'
                      ? 'none'
                      : `0 6px 20px ${theme.palette.primary.main}50`,
                },
              }}
            >
              Back to FMIS
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{
                px: 3.5,
                py: 1.75,
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              Sign Out
            </Button>
          </Stack>
        </Paper>

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 4,
            textAlign: 'center',
            color: 'text.disabled',
          }}
        >
          © 2026 NIA – OSBPIS
        </Typography>
      </Container>
    </Box>
  );
};

const AccessGuard = ({ children }) => {
  const { currentUser, loading, logout, unauthorizedSuperAdmin } = useUser();

  if (loading || (!currentUser && !unauthorizedSuperAdmin)) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(30,30,40,0.97) 0%, rgba(20,20,28,0.99) 100%)'
              : 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)',
        }}
      >
        <CircularProgress size={48} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
          Loading user profile...
        </Typography>
      </Box>
    );
  }

  // Block: User has SUPER_ADMIN role but ID is not in SUPER_ADMIN_IDS whitelist (security alert)
  if (unauthorizedSuperAdmin) {
    return (
      <NoBudgetRolePage
        onLogout={logout}
        message="Your USER ID is not authorized for this environment. Return to the main FMIS dashboard or sign out."
      />
    );
  }

  // Budget role gate: Only SUPER ADMIN or users with at least one budget role can proceed
  const isAuthorized = hasBudgetModuleAccess(currentUser);

  if (!isAuthorized) {
    return <NoBudgetRolePage onLogout={logout} />;
  }

  return children;
};

export default AccessGuard;
