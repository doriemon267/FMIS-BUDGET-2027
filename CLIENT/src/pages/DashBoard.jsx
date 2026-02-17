import React, { useState } from 'react';
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
import { StatCardSkeleton } from '../components/common/LoadingSkeleton';
import { handleApiError } from '../utils/errorHandler';
import logger from '../utils/logger';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ErrorAlert from '../components/common/ErrorAlert';
import { useThemeContext } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useRegion } from '../context/RegionContext';
import WorkflowTemplateSelector from '../components/workflow/WorkflowTemplateSelector';
import DashboardAnalytics from '../components/dashboard/DashboardAnalytics';
import InAppHelp from '../components/common/InAppHelp';
import DeadlineReminder from '../components/common/DeadlineReminder';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// Reusable Stat Card Component
const StatCard = ({ title, value, color, icon: Icon, isLoading, subtitle, filled = true }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  const baseCardBg = filled
    ? (isDarkMode ? alpha(color, 0.14) : alpha(color, 0.1))
    : (isDarkMode ? alpha(color, 0.08) : '#ffffff');

  return (
    <Card
      elevation={isDarkMode ? 4 : 2}
      sx={{
        height: '100%',
        borderRadius: 2.5,
        backgroundColor: baseCardBg,
        backgroundImage: 'none',
        border: `1px solid ${alpha(color, filled ? 0.4 : 0.2)}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDarkMode
            ? `0 10px 25px ${alpha(color, 0.2)}`
            : `0 10px 20px ${alpha(color, 0.15)}`
        }
      }}
    >
      <CardContent
        sx={{
          textAlign: 'center',
          p: { xs: 2.5, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%'
        }}
      >
        <Box sx={{
          display: 'inline-flex',
          p: 1.25,
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
        borderRadius: 2.5,
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
      <CardContent sx={{ p: { xs: 2.5, md: 3 }, height: '100%' }}>
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
  
  // Theme colors aligned with muiTheme.js
  const THEME_COLORS = {
    primary: '#264524',      // Dark green
    secondary: '#375e38',    // Medium green
    deepGreen: '#2d5016',   // Deep green
    success: '#2e7d32',      // Success green
    warning: '#f57c00',      // Orange for pending
    error: '#c62828',        // Red for rejected/returned
    info: '#1976d2',         // Blue for info
  };
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

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboardStats', regionName, userAccessLevel],
    queryFn: async () => {
      const regionParam = regionName ? encodeURIComponent(regionName) : '';
      const res = await api.get(`/stats/overview${regionParam ? `?region=${regionParam}` : ''}`);
      return res.data;
    },
    refetchInterval: 30000, // Less frequent updates
    staleTime: 10000,
    enabled: true, // Always fetch; server accepts region name or empty (uses hierarchicalFilters)
    onError: (error) => {
      handleApiError(error, toast, 'Loading dashboard stats');
    },
  });

  // Fallback values if data is not yet loaded
  const totalProposals = stats?.totalProposals || 0;
  const pendingProposals = stats?.pendingProposals || 0;
  const approvedProposals = stats?.approvedProposals || 0;
  const rejectedProposals = stats?.rejectedProposals || 0;
  
  // Breakdown data
  const legacyBreakdown = stats?.breakdown?.legacy || {};
  const newWorkflowBreakdown = stats?.breakdown?.newWorkflow || {};
  const fiscalYear = stats?.fiscalYear || new Date().getFullYear();

  // Calculate completion percentage
  const completionRate = totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0;

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Fetch active settings for template selector
  const { data: activeSettings } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => {
      const res = await api.get('/settings/active');
      return res.data;
    },
  });

  const handleCreateProposal = () => navigate('/proposal');
  
  const handleCreateFromTemplate = () => {
    setTemplateSelectorOpen(true);
  };

  const handleSelectTemplate = async (template) => {
    try {
      const response = await api.post(`/api/workflow-templates/${template._id}/create-proposal`);
      if (response.data.success) {
        toast.success('Proposal created from template successfully!');
        navigate(`/allproposal?proposalId=${response.data.proposal._id}`);
        setTemplateSelectorOpen(false);
      }
    } catch (error) {
      handleApiError(error, toast, 'Creating proposal from template');
    }
  };
  const handleViewProposals = () => navigate('/myProposals');
  const handleGenerateReports = () => navigate('/comprehensive-reports');
  const handleViewAllProposals = () => navigate('/allproposal');
  const handleRefreshStats = async () => {
    await queryClient.invalidateQueries(['dashboardStats', regionName, userAccessLevel]);
  };

  const statusBreakdown = [
    {
      label: 'Pending Review',
      value: pendingProposals,
      color: THEME_COLORS.warning,
    },
    {
      label: 'Approved/Finalized',
      value: approvedProposals,
      color: THEME_COLORS.success,
    },
    {
      label: 'Rejected/Returned',
      value: rejectedProposals,
      color: THEME_COLORS.error,
    },
  ];

  // Analytics data for DashboardAnalytics (derived from stats)
  const analyticsData = {
    trends: [
      {
        date: String(fiscalYear),
        total: totalProposals,
        approved: approvedProposals,
        pending: pendingProposals,
      },
    ],
    statusDistribution: statusBreakdown.map((s) => ({ name: s.label, value: s.value })),
    budgetTypeDistribution: [
      legacyBreakdown.total > 0 && { name: 'Legacy System', value: legacyBreakdown.total },
      newWorkflowBreakdown.total > 0 && { name: 'New Workflow', value: newWorkflowBreakdown.total },
    ].filter(Boolean),
  };

  const actionChips = [
    {
      label: `Fiscal Year: ${fiscalYear}`,
      color: 'primary',
      variant: 'outlined',
    },
    {
      label: `Access: ${displayInfo.level}`,
      color: 'secondary',
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
      <Container maxWidth='xl' sx={{ py: { xs: 2.5, md: 3.5 } }}>
        <Stack spacing={4}>
          {/* Hero / Welcome Section */}
          <Paper
            elevation={isDarkMode ? 6 : 3}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              background: isDarkMode
                ? 'linear-gradient(135deg, #0f172a 0%, #0b3d2e 100%)'
                : `linear-gradient(135deg, ${THEME_COLORS.deepGreen} 0%, ${THEME_COLORS.primary} 40%, ${THEME_COLORS.secondary} 100%)`,
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
                <Typography
                  variant='h4'
                  fontWeight={700}
                  sx={{ mt: 1, mb: 1, fontSize: { xs: '1.6rem', md: '2rem' } }}
                >
                  Welcome back, {currentUser?.FirstName || 'Team Member'}
                </Typography>
                <Typography variant='body1' sx={{ opacity: 0.9, mb: 2, maxWidth: 680 }}>
                  Monitor submissions, act on pending work, and keep {displayInfo.name} on track for the current fiscal cycle.
                </Typography>
                <Stack
                  direction='row'
                  spacing={1}
                  flexWrap='wrap'
                  useFlexGap
                  sx={{ mb: 3 }}
                >
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
                      }}
                    />
                  ))}
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  {isPreparer && (
                    <>
                      <Button
                        variant='contained'
                        onClick={handleCreateProposal}
                        sx={{
                          minWidth: 180,
                          textTransform: 'none',
                          fontWeight: 600,
                          bgcolor: THEME_COLORS.secondary,
                          '&:hover': {
                            bgcolor: THEME_COLORS.primary,
                          },
                        }}
                      >
                        New Proposal
                      </Button>
                      <Button
                        variant='outlined'
                        onClick={handleCreateFromTemplate}
                        sx={{
                          minWidth: 180,
                          textTransform: 'none',
                          fontWeight: 600,
                          borderColor: THEME_COLORS.secondary,
                          color: THEME_COLORS.secondary,
                          '&:hover': {
                            borderColor: THEME_COLORS.primary,
                            bgcolor: alpha(THEME_COLORS.primary, 0.1),
                          },
                        }}
                      >
                        From Template
                      </Button>
                    </>
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
                    startIcon={isLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : null}
                    disabled={isLoading}
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
                    sx={{ color: isDarkMode ? '#4caf50' : '#a7ffeb' }}
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
            {isLoading ? (
              <StatCardSkeleton count={4} />
            ) : statsError ? (
              <Box sx={{ p: 2 }}>
                <ErrorAlert
                  error={statsError}
                  onRetry={() => queryClient.refetchQueries(['dashboardStats'])}
                />
              </Box>
            ) : (
              <Grid container spacing={{ xs: 2, md: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title='Total Proposals'
                    value={totalProposals}
                    color={THEME_COLORS.primary}
                    icon={TrendingUpIcon}
                    isLoading={false}
                    filled
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title='Pending Review'
                    value={pendingProposals}
                    color={THEME_COLORS.warning}
                    icon={PendingActionsIcon}
                    isLoading={false}
                    subtitle={`${totalProposals > 0 ? ((pendingProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                    filled
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title='Approved/Finalized'
                    value={approvedProposals}
                    color={THEME_COLORS.success}
                    icon={CheckCircleIcon}
                    isLoading={false}
                    subtitle={`${totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                    filled
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard
                    title='Rejected/Returned'
                    value={rejectedProposals}
                    color={THEME_COLORS.error}
                    icon={CancelIcon}
                    isLoading={false}
                    subtitle={`${totalProposals > 0 ? ((rejectedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`}
                    filled
                  />
                </Grid>
              </Grid>
            )}
          </Box>

          {/* Health + Context */}
          <Grid container spacing={{ xs: 2, md: 3 }}>
            <Grid item xs={12} md={7}>
              <Paper
                elevation={isDarkMode ? 5 : 1}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  border: `1px solid ${alpha(THEME_COLORS.primary, 0.1)}`,
                }}
              >
                <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                  <Typography variant='h6' fontWeight={600} sx={{ color: THEME_COLORS.primary }}>
                    Submission Health
                  </Typography>
                  <Button
                    size='small'
                    onClick={handleViewAllProposals}
                    sx={{
                      textTransform: 'none',
                      color: THEME_COLORS.secondary,
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: alpha(THEME_COLORS.secondary, 0.1),
                      },
                    }}
                  >
                    View All
                  </Button>
                </Stack>
                <Stack spacing={2.5}>
                  {statusBreakdown.map((status) => (
                    <Box key={status.label}>
                      <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 0.5 }}>
                        <Typography variant='body2' fontWeight={500} color='text.primary'>
                          {status.label}
                        </Typography>
                        <Typography variant='body1' fontWeight={700} sx={{ color: status.color }}>
                          {status.value}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant='determinate'
                        value={totalProposals ? (status.value / totalProposals) * 100 : 0}
                        sx={{
                          height: 12,
                          borderRadius: 6,
                          bgcolor: alpha(status.color, 0.15),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: status.color,
                            borderRadius: 6,
                          },
                        }}
                      />
                      {totalProposals > 0 && (
                        <Typography variant='caption' color='text.secondary' sx={{ mt: 0.5, display: 'block' }}>
                          {((status.value / totalProposals) * 100).toFixed(1)}% of total proposals
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
                {(legacyBreakdown.total > 0 || newWorkflowBreakdown.total > 0) && (
                  <>
                    <Divider sx={{ my: 2.5 }} />
                    <Typography variant='caption' fontWeight={600} color='text.secondary' sx={{ mb: 1.5, display: 'block' }}>
                      System Breakdown
                    </Typography>
                    <Stack spacing={1.5}>
                      {legacyBreakdown.total > 0 && (
                        <Box>
                          <Stack direction='row' justifyContent='space-between' alignItems='center'>
                            <Typography variant='body2' color='text.secondary'>
                              Legacy System
                            </Typography>
                            <Typography variant='body2' fontWeight={600}>
                              {legacyBreakdown.total} proposals
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                      {newWorkflowBreakdown.total > 0 && (
                        <Box>
                          <Stack direction='row' justifyContent='space-between' alignItems='center'>
                            <Typography variant='body2' color='text.secondary'>
                              New Workflow System
                            </Typography>
                            <Typography variant='body2' fontWeight={600} sx={{ color: THEME_COLORS.success }}>
                              {newWorkflowBreakdown.total} proposals
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper
                elevation={isDarkMode ? 5 : 1}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  height: '100%',
                  border: `1px solid ${alpha(THEME_COLORS.primary, 0.1)}`,
                }}
              >
                <Typography variant='h6' fontWeight={600} sx={{ mb: 2, color: THEME_COLORS.primary }}>
                  Access & Region Context
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant='caption' color='text.secondary'>Fiscal Year</Typography>
                    <Typography variant='body1' fontWeight={600}>
                      {fiscalYear}
                    </Typography>
                  </Box>
                  <Divider />
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
                  {newWorkflowBreakdown.total > 0 && (
                    <>
                      <Box>
                        <Typography variant='caption' color='text.secondary'>New Workflow System</Typography>
                        <Typography variant='body2' fontWeight={600} color={THEME_COLORS.success}>
                          {newWorkflowBreakdown.total} proposals
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {newWorkflowBreakdown.finalized || 0} finalized
                        </Typography>
                      </Box>
                      <Divider />
                    </>
                  )}
                  <Box>
                    <Typography variant='caption' color='text.secondary'>Upcoming Actions</Typography>
                    <Typography variant='body2'>
                      {pendingProposals > 0
                        ? `Review ${pendingProposals} pending submission${pendingProposals > 1 ? 's' : ''} to keep the pipeline moving.`
                        : 'All caught up! No pending items at the moment.'}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Submission deadline reminder */}
          {activeSettings?.dueDate && (
            <Box sx={{ mb: 1 }}>
              <DeadlineReminder
                deadline={activeSettings.dueDate}
                label="Budget submission"
                showIcon={true}
              />
            </Box>
          )}

          {/* Analytics section */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant='h6' fontWeight='bold'>
                📊 Analytics
              </Typography>
              <Button
                size="small"
                startIcon={<HelpOutlineIcon />}
                onClick={() => setHelpOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                Help
              </Button>
            </Stack>
            <DashboardAnalytics data={analyticsData} />
          </Box>

          {/* Quick Actions */}
          <Box>
            <Typography variant='h6' fontWeight='bold' sx={{ mb: 3 }}>
              🚀 Quick Actions
            </Typography>

            <Grid container spacing={{ xs: 2, md: 3 }}>
              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard
                    title='Create New Proposal'
                    description='Start a new budget proposal submission'
                    icon={AddCircleOutlineIcon}
                    color={THEME_COLORS.primary}
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
                    color={THEME_COLORS.secondary}
                    onClick={handleViewProposals}
                    buttonText='View Proposals'
                  />
                </Grid>
              )}

              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard
                    title='Proposal Workflow'
                    description='Use the new 6-step proposal workflow system'
                    icon={ListAltIcon}
                    color={THEME_COLORS.warning}
                    onClick={() => navigate('/allproposal')}
                    buttonText='Open Workflow'
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6} md={4}>
                <ActionCard
                  title='Generate Reports'
                  description='Create customized reports and export data'
                  icon={AssessmentIcon}
                  color={THEME_COLORS.success}
                  onClick={handleGenerateReports}
                  buttonText='Generate Reports'
                />
              </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <ActionCard
                title='Employee List'
                description='Manage and review employees'
                icon={ListAltIcon}
                color={THEME_COLORS.secondary}
                onClick={() => navigate('/employee')}
                buttonText='Open Employees'
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <ActionCard
                title='Employee Benefits'
                description='Access benefits and allowances modules'
                icon={ListAltIcon}
                color={THEME_COLORS.info}
                onClick={() => navigate('/employeeBenefits')}
                buttonText='Open Benefits'
              />
            </Grid>
          </Grid>
          </Box>
        </Stack>
      </Container>

      <WorkflowTemplateSelector
        open={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        fiscalYear={activeSettings?.fiscalYear}
        budgetType={activeSettings?.budgetType}
      />

      <InAppHelp open={helpOpen} onClose={() => setHelpOpen(false)} context="dashboard" />
    </>
  );
};

export default HomePage;
