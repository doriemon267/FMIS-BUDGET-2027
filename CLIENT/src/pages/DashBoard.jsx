import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Container,
  Chip,
  Button,
  Paper,
  Divider,
  useTheme,
  alpha,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { useThemeContext } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useRegion } from '../context/RegionContext';

// Reusable Stat Card Component
const StatCard = ({ title, value, color, icon: Icon, isLoading, subtitle, filled = true }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  return (
    <Card
      elevation={isDarkMode ? 4 : 2}
      sx={{
        height: '100%',
        borderRadius: 2,
        background: filled
          ? `linear-gradient(135deg, ${alpha(color, 0.18)} 0%, ${alpha(color, 0.12)} 100%)`
          : (isDarkMode
              ? `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(color, 0.04)} 100%)`
              : `linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`),
        border: `1px solid ${alpha(color, filled ? 0.4 : 0.2)}`,
      }}
    >
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Box sx={{
          display: 'inline-flex',
          p: 1.5,
          borderRadius: '50%',
          bgcolor: alpha(color, 0.1),
          mb: 2
        }}>
          <Icon sx={{ fontSize: 24, color: color }} />
        </Box>
        <Typography variant='h4' fontWeight='bold' sx={{ color, mb: 1 }}>
          {isLoading ? '...' : value}
        </Typography>
        <Typography variant='body2' fontWeight='600' color='text.primary' sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant='caption' color='text.secondary'>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Reusable Action Card Component
const ActionCard = ({ title, description, icon: Icon, color, onClick, buttonText }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  return (
    <Card
      elevation={isDarkMode ? 4 : 2}
      sx={{
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        background: isDarkMode
          ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: `1px solid ${alpha(color, 0.1)}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDarkMode
            ? `0 8px 25px ${alpha(color, 0.15)}`
            : `0 8px 25px ${alpha(color, 0.1)}`,
          border: `1px solid ${alpha(color, 0.3)}`
        },
        height: '100%'
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box sx={{
            display: 'inline-flex',
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(color, 0.1),
            alignSelf: 'flex-start'
          }}>
            <Icon sx={{ fontSize: 24, color: color }} />
          </Box>
          <Box>
            <Typography variant='h6' fontWeight='600' gutterBottom>
              {title}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ lineHeight: 1.5 }}>
              {description}
            </Typography>
          </Box>
          <Button
            variant='outlined'
            size='small'
            sx={{
              alignSelf: 'flex-start',
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 500,
              color: color,
              borderColor: color,
              '&:hover': {
                borderColor: color,
                bgcolor: alpha(color, 0.1)
              }
            }}
          >
            {buttonText}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode } = useThemeContext();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const isDarkMode = mode === 'dark';
  const userRoles = Array.isArray(currentUser?.Roles)
    ? currentUser.Roles
    : currentUser?.Roles
      ? [currentUser.Roles]
      : [];
  const isPreparer = userRoles.includes('BUDGET PREPARER');

  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  const userDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;

  // Get the active region name
  const regionName = activeRegion?.name || activeRegion?.regionName;

  // Determine display name and level based on user's access
  const getDisplayInfo = () => {
    switch (userAccessLevel) {
      case 'DIVISION':
        return {
          level: 'Division',
          name: userDivision || 'Your Division',
          scope: `${userDivision || 'Division'} (${userDepartment || 'Department'}, ${regionName || 'Region'})`
        };
      case 'DEPARTMENT':
        return {
          level: 'Department',
          name: userDepartment || 'Your Department',
          scope: `${userDepartment || 'Department'} (${regionName || 'Region'})`
        };
      case 'REGION':
        return {
          level: 'Region',
          name: regionName || 'Your Region',
          scope: `${regionName || 'Region'}`
        };
      case 'FULL':
        return {
          level: 'System',
          name: 'All Regions',
          scope: 'Full System Access'
        };
      default:
        return {
          level: 'Region',
          name: regionName || 'Your Region',
          scope: `${regionName || 'Region'}`
        };
    }
  };

  const displayInfo = getDisplayInfo();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats', regionName, userAccessLevel],
    queryFn: async () => {
      const res = await api.get(`/stats/overview?region=${regionName || ''}`);
      return res.data;
    },
    refetchInterval: 30000, // Less frequent updates
    staleTime: 10000,
    enabled: !!regionName,
  });

  // Fallback values if data is not yet loaded
  const totalProposals = stats?.totalProposals || 0;
  const pendingProposals = stats?.pendingProposals || 0;
  const approvedProposals = stats?.approvedProposals || 0;
  const rejectedProposals = stats?.rejectedProposals || 0;

  // Calculate completion percentage
  const completionRate = totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0;

  const handleCreateProposal = () => navigate('/proposal');
  const handleViewProposals = () => navigate('/myProposals');
  const handleGenerateReports = () => navigate('/consolidated-reports');
  const handleViewAllProposals = () => navigate('/AllProposals');
  const handleRefreshStats = async () => {
    await queryClient.invalidateQueries(['dashboardStats', regionName, userAccessLevel]);
  };

  const statusBreakdown = [
    {
      label: 'Pending',
      value: pendingProposals,
      color: '#d97706',
    },
    {
      label: 'Approved',
      value: approvedProposals,
      color: '#16a34a',
    },
    {
      label: 'Rejected',
      value: rejectedProposals,
      color: '#dc2626',
    },
  ];

  const actionChips = [
    {
      label: `Access: ${displayInfo.level}`,
      color: 'primary',
      variant: 'outlined',
    },
    {
      label: `Scope: ${displayInfo.scope}`,
      color: 'secondary',
      variant: 'outlined',
    },
    {
      label: `Region: ${regionName || 'Not assigned'}`,
      color: 'success',
      variant: 'outlined',
    },
  ];

  return (
    <>
      <Container maxWidth='xl' sx={{ py: 3 }}>
        <Stack spacing={4}>
          {/* Hero / Welcome Section */}
          <Paper
            elevation={isDarkMode ? 6 : 3}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              background: isDarkMode
                ? 'linear-gradient(135deg, #0f172a 0%, #0b3d2e 100%)'
                : 'linear-gradient(135deg, #0f5132 0%, #1b5e20 40%, #2e7d32 100%)',
              color: 'white',
              overflow: 'hidden',
            }}
          >
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={3}
              justifyContent='space-between'
              alignItems={{ xs: 'flex-start', lg: 'center' }}
            >
              <Box flex={1}>
                <Typography variant='overline' sx={{ letterSpacing: 2, opacity: 0.85 }}>
                  Budget Performance Dashboard
                </Typography>
                <Typography variant='h4' fontWeight={700} sx={{ mt: 1, mb: 1 }}>
                  Welcome back, {currentUser?.FirstName || 'Team Member'}
                </Typography>
                <Typography variant='body1' sx={{ opacity: 0.9, mb: 2 }}>
                  Monitor submissions, act on pending work, and keep {displayInfo.name} on track for the current fiscal cycle.
                </Typography>
                <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ mb: 3 }}>
                  {actionChips.map((chip) => (
                    <Chip
                      key={chip.label}
                      label={chip.label}
                      color={chip.color}
                      variant='outlined'
                      size='small'
                      sx={{
                        color: 'white',
                        borderColor: alpha('#ffffff', 0.35),
                        mr: 1,
                        mb: 1,
                      }}
                    />
                  ))}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  {isPreparer && (
                    <Button
                      variant='contained'
                      color='secondary'
                      onClick={handleCreateProposal}
                      sx={{ minWidth: 180, textTransform: 'none', fontWeight: 600 }}
                    >
                      New Proposal
                    </Button>
                  )}
                  <Button
                    variant='outlined'
                    onClick={handleRefreshStats}
                    sx={{
                      minWidth: 150,
                      textTransform: 'none',
                      color: 'white',
                      borderColor: alpha('#ffffff', 0.5),
                      '&:hover': {
                        borderColor: 'white',
                      },
                    }}
                  >
                    Refresh Stats
                  </Button>
                  <Button
                    color='inherit'
                    onClick={handleGenerateReports}
                    sx={{ textTransform: 'none' }}
                  >
                    Generate Report
                  </Button>
                </Stack>
              </Box>

              <Paper
                elevation={0}
                sx={{
                  minWidth: { xs: '100%', lg: 320 },
                  borderRadius: 3,
                  p: 3,
                  bgcolor: alpha('#ffffff', 0.1),
                  border: `1px solid ${alpha('#ffffff', 0.2)}`,
                }}
              >
                <Typography variant='body2' sx={{ opacity: 0.9 }}>Completion Rate</Typography>
                <Stack direction='row' spacing={2} alignItems='center' sx={{ mt: 2 }}>
                  <CircularProgress
                    variant='determinate'
                    value={Number(completionRate)}
                    size={90}
                    thickness={4}
                    sx={{ color: '#a7ffeb' }}
                  />
                  <Box>
                    <Typography variant='h3' fontWeight={700}>
                      {completionRate}%
                    </Typography>
                    <Typography variant='body2' sx={{ opacity: 0.85 }}>
                      Approved vs Total Submissions
                    </Typography>
                    <Divider sx={{ my: 1, borderColor: alpha('#ffffff', 0.3) }} />
                    <Typography variant='caption' sx={{ display: 'block', opacity: 0.8 }}>
                      Total proposals: {totalProposals}
                    </Typography>
                    <Typography variant='caption' sx={{ display: 'block', opacity: 0.8 }}>
                      Pending review: {pendingProposals}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Paper>

          {/* Stats Overview */}
          <Box>
            <Typography variant='h6' fontWeight='bold' sx={{ mb: 2 }}>
              📊 Key Metrics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title='Total Proposals'
                  value={totalProposals}
                  color='#1e88e5'
                  icon={TrendingUpIcon}
                  isLoading={isLoading}
                  filled
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title='Pending'
                  value={pendingProposals}
                  color='#f9a825'
                  icon={PendingActionsIcon}
                  isLoading={isLoading}
                  subtitle={`${totalProposals > 0 ? ((pendingProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                  filled
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title='Approved'
                  value={approvedProposals}
                  color='#2e7d32'
                  icon={CheckCircleIcon}
                  isLoading={isLoading}
                  subtitle={`${totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                  filled
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title='Rejected'
                  value={rejectedProposals}
                  color='#c62828'
                  icon={CancelIcon}
                  isLoading={isLoading}
                  subtitle={`${totalProposals > 0 ? ((rejectedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                  filled
                />
              </Grid>
            </Grid>
          </Box>

          {/* Health + Context */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Paper
                elevation={isDarkMode ? 5 : 1}
                sx={{ p: 3, borderRadius: 3 }}
              >
                <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                  <Typography variant='h6' fontWeight={600}>
                    Submission Health
                  </Typography>
                  <Button size='small' onClick={handleViewAllProposals} sx={{ textTransform: 'none' }}>
                    View All
                  </Button>
                </Stack>
                <Stack spacing={2}>
                  {statusBreakdown.map((status) => (
                    <Box key={status.label}>
                      <Stack direction='row' justifyContent='space-between' alignItems='center'>
                        <Typography variant='body2' color='text.secondary'>
                          {status.label}
                        </Typography>
                        <Typography variant='body2' fontWeight={600}>
                          {status.value}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant='determinate'
                        value={totalProposals ? (status.value / totalProposals) * 100 : 0}
                        sx={{
                          height: 10,
                          borderRadius: 10,
                          bgcolor: alpha(status.color, 0.15),
                          '& .MuiLinearProgress-bar': { bgcolor: status.color },
                          mt: 1,
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper
                elevation={isDarkMode ? 5 : 1}
                sx={{ p: 3, borderRadius: 3, height: '100%' }}
              >
                <Typography variant='h6' fontWeight={600} sx={{ mb: 2 }}>
                  Access & Region Context
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant='caption' color='text.secondary'>Active Region</Typography>
                    <Typography variant='body1' fontWeight={600}>
                      {regionName || 'Region not assigned'}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant='caption' color='text.secondary'>Access Level</Typography>
                    <Typography variant='body1' fontWeight={600}>
                      {displayInfo.level}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {displayInfo.scope}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant='caption' color='text.secondary'>Upcoming Actions</Typography>
                    <Typography variant='body2'>
                      {pendingProposals > 0
                        ? 'Review pending submissions to keep the pipeline moving.'
                        : 'All caught up! No pending items at the moment.'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Quick Actions */}
          <Box>
            <Typography variant='h6' fontWeight='bold' sx={{ mb: 3 }}>
              🚀 Quick Actions
            </Typography>

            <Grid container spacing={3}>
              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard
                    title='Create New Proposal'
                    description='Start a new budget proposal submission'
                    icon={AddCircleOutlineIcon}
                    color={theme.palette.primary.main}
                    onClick={handleCreateProposal}
                    buttonText='Get Started'
                  />
                </Grid>
              )}

              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard
                    title='My Proposals'
                    description='View and manage your submitted proposals'
                    icon={ListAltIcon}
                    color={theme.palette.secondary.main}
                    onClick={handleViewProposals}
                    buttonText='View Proposals'
                  />
                </Grid>
              )}

              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard
                    title='New Proposal Workflow'
                    description='Use the new 6-step proposal workflow system'
                    icon={ListAltIcon}
                    color='#ff9800'
                    onClick={() => navigate('/new-proposal-workflow')}
                    buttonText='Open Workflow'
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6} md={4}>
                <ActionCard
                  title='Generate Reports'
                  description='Create customized reports and export data'
                  icon={AssessmentIcon}
                  color='#10b981'
                  onClick={handleGenerateReports}
                  buttonText='Generate Reports'
                />
              </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <ActionCard
                title='Employee List'
                description='Manage and review employees'
                icon={ListAltIcon}
                color='#2e7d32'
                onClick={() => navigate('/employee')}
                buttonText='Open Employees'
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <ActionCard
                title='Employee Benefits'
                description='Access benefits and allowances modules'
                icon={ListAltIcon}
                color='#1e88e5'
                onClick={() => navigate('/employeeBenefits')}
                buttonText='Open Benefits'
              />
            </Grid>
          </Grid>
          </Box>
        </Stack>
      </Container>
    </>
  );
};

export default HomePage;
