import React, { useMemo, useState, useEffect } from 'react';
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
import { hasPermission } from '../utils/permissions';
import WorkflowTemplateSelector from '../components/workflow/WorkflowTemplateSelector';
import DashboardAnalytics from '../components/dashboard/DashboardAnalytics';
import InAppHelp from '../components/common/InAppHelp';
import DeadlineReminder from '../components/common/DeadlineReminder';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// --- ENHANCED REUSABLE COMPONENTS ---

const StatCard = ({ title, value, color, icon: Icon, isLoading, subtitle }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 5,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: isDarkMode ? alpha(color, 0.08) : '#ffffff',
        border: `1px solid ${alpha(color, 0.15)}`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: `0 20px 40px -15px ${alpha(color, 0.35)}`,
          borderColor: alpha(color, 0.4),
          '& .stat-icon-container': {
            transform: 'scale(1.1) rotate(5deg)',
            bgcolor: color,
            color: '#fff'
          }
        }
      }}
    >
      <CardContent sx={{ p: 3.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography 
              variant='overline' 
              fontWeight='800' 
              sx={{ 
                color: 'text.secondary', 
                opacity: 0.7, 
                letterSpacing: 1.5,
                display: 'block',
                mb: 1
              }}
            >
              {title}
            </Typography>
            <Typography variant='h3' fontWeight='900' sx={{ color: color, letterSpacing: -0.5 }}>
              {isLoading ? <CircularProgress size={28} color="inherit" /> : value}
            </Typography>
          </Box>
          <Box 
            className="stat-icon-container"
            sx={{
              display: 'flex',
              p: 2,
              borderRadius: 4,
              bgcolor: alpha(color, 0.12),
              color: color,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 8px 16px -4px ${alpha(color, 0.2)}`
            }}
          >
            <Icon sx={{ fontSize: 32 }} />
          </Box>
        </Stack>
        {subtitle && (
          <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant='caption' sx={{ color: 'text.secondary', fontWeight: 700, bgcolor: alpha(color, 0.06), px: 1.5, py: 0.5, borderRadius: 1.5 }}>
              {subtitle}
            </Typography>
          </Box>
        )}
      </CardContent>
      {/* Decorative background element */}
      <Box sx={{
        position: 'absolute',
        bottom: -20,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: '50%',
        bgcolor: alpha(color, 0.03),
        zIndex: 0
      }} />
    </Card>
  );
};

const ActionCard = ({ title, description, icon: Icon, color, onClick, buttonText }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 5,
        height: '100%',
        border: `1px solid ${alpha(isDarkMode ? '#fff' : '#000', 0.06)}`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        background: isDarkMode ? alpha('#1e293b', 0.4) : '#ffffff',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          borderColor: alpha(color, 0.3),
          bgcolor: isDarkMode ? alpha(color, 0.04) : alpha(color, 0.01),
          transform: 'translateY(-6px)',
          boxShadow: '0 25px 50px -20px rgba(0,0,0,0.12)',
          '& .action-icon-box': { 
            bgcolor: color, 
            color: '#fff',
            transform: 'scale(1.1) rotate(-5deg)'
          },
          '& .action-button': {
            bgcolor: color,
            color: '#fff',
            transform: 'translateY(-2px)'
          }
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>
        <Box className="action-icon-box" sx={{
          display: 'inline-flex',
          p: 2,
          borderRadius: 3,
          bgcolor: alpha(color, 0.1),
          color: color,
          mb: 3,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 10px 20px -5px ${alpha(color, 0.2)}`
        }}>
          <Icon sx={{ fontSize: 30 }} />
        </Box>
        <Typography variant='h5' fontWeight='800' gutterBottom sx={{ letterSpacing: -0.5 }}>
          {title}
        </Typography>
        <Typography variant='body1' color='text.secondary' sx={{ mb: 4, flexGrow: 1, lineHeight: 1.7, opacity: 0.8 }}>
          {description}
        </Typography>
        <Button
          fullWidth
          variant='outlined'
          className="action-button"
          sx={{
            borderRadius: 3,
            textTransform: 'none',
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 700,
            color: color,
            borderColor: alpha(color, 0.3),
            transition: 'all 0.3s ease',
            '&:hover': { borderColor: color, bgcolor: color, color: '#fff' }
          }}
        >
          {buttonText}
        </Button>
      </CardContent>
      {/* Decorative gradient blur */}
      <Box sx={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(color, 0.08)} 0%, transparent 70%)`,
        zIndex: 0
      }} />
    </Card>
  );
};

// --- MAIN PAGE COMPONENT ---

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode } = useThemeContext();
  const { currentUser } = useUser();
  const { activeRegion, availableRegions } = useRegion();
  const queryClient = useQueryClient();
  const isDarkMode = mode === 'dark';

  const THEME_COLORS = {
    primary: '#2d6a4f',
    secondary: '#40916c',
    deepGreen: '#1b4332',
    success: '#52b788',
    warning: '#f79009',
    error: '#f04438',
    info: '#0086ff',
    accent: '#95d5b2'
  };

  const userRoles = Array.isArray(currentUser?.Roles) ? currentUser.Roles : currentUser?.Roles ? [currentUser.Roles] : [];
  const isPreparer = userRoles.includes('BUDGET_PREPARER');

  let userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  let userDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;

  if (isPreparer && (userAccessLevel === 'REGION' || !userAccessLevel || userAccessLevel === 'BUDGET_AND_REVENUE_DIVISION')) {
    userAccessLevel = 'DIVISION';
  }

  const divisionName = typeof userDivision === 'string' ? userDivision : (userDivision?.name || userDivision?.divisionName);
  const normRole = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_').trim();
  const isBudgetManager = (currentUser?.Roles || []).some((r) => normRole(r) === 'BUDGET_MANAGER' || normRole(r) === 'OVERALL_BUDGET_APPROVER');
  const regionName = (isBudgetManager && availableRegions?.length > 1) ? 'All Regions' : (activeRegion?.name || activeRegion?.regionName);

  const getDisplayInfo = () => {
    switch (userAccessLevel) {
      case 'DIVISION': return { level: 'Division', name: divisionName || 'Your Division', scope: `${divisionName || 'Division'} (${userDepartment || 'Dept'}, ${regionName})` };
      case 'DEPARTMENT': return { level: 'Department', name: userDepartment || 'Your Department', scope: `${userDepartment || 'Dept'} (${regionName})` };
      case 'FULL': return { level: 'System', name: 'All Regions', scope: 'Full System Access' };
      default: return { level: 'Region', name: regionName || 'Your Region', scope: `${regionName || 'Region'}` };
    }
  };

  const displayInfo = getDisplayInfo();

  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboardStats', regionName, userAccessLevel],
    queryFn: async () => {
      const regionParam = regionName ? encodeURIComponent(regionName) : '';
      const res = await api.get(`/stats/overview${regionParam ? `?region=${regionParam}` : ''}`);
      setLastUpdated(new Date());
      return res.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
    onError: (error) => handleApiError(error, toast, 'Loading dashboard stats'),
  });

  const totalProposals = stats?.totalProposals || 0;
  const pendingProposals = stats?.pendingProposals || 0;
  const approvedProposals = stats?.approvedProposals || 0;
  const rejectedProposals = stats?.rejectedProposals || 0;
  const completionRate = totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0;
  const fiscalYear = stats?.fiscalYear || new Date().getFullYear();

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [canAccessCreateProposal, setCanAccessCreateProposal] = useState(false);

  const userRolesUpper = useMemo(() => (currentUser?.Roles || []).map((role) => String(role).toUpperCase()), [currentUser]);

  const hasCreateProposalEligibility = useMemo(() => {
    const isSuperAdminUser = userRolesUpper.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(r));
    if (isSuperAdminUser) return true;
    const hasCreatePermission = hasPermission(currentUser, 'CreateProposals') || hasPermission(currentUser, 'EditOwnProposals');
    const hasBlockedRole = userRolesUpper.some(r => [
      'BUDGET MANAGER', 'BUDGET_MANAGER',
      'BUDGET OFFICER', 'BUDGET_OFFICER',
      'BUDGET APPROVER', 'BUDGET_APPROVER',
      'BUDGET REVIEWER', 'BUDGET_REVIEWER',
      'BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST',
    ].includes(r));
    return hasCreatePermission && !hasBlockedRole;
  }, [currentUser, userRolesUpper]);

  useEffect(() => {
    let isMounted = true;
    const checkCreateProposalAccess = async () => {
      if (!currentUser || !hasCreateProposalEligibility) {
        if (isMounted) setCanAccessCreateProposal(false);
        return;
      }
      try {
        const response = await api.get('/allproposal/proposals/preparer-create-access');
        if (isMounted) setCanAccessCreateProposal(!response?.data?.hasInProcessProposal);
      } catch (error) {
        if (isMounted) setCanAccessCreateProposal(false);
      }
    };
    checkCreateProposalAccess();
    return () => { isMounted = false; };
  }, [currentUser, hasCreateProposalEligibility]);

  const { data: activeSettings } = useQuery({
    queryKey: ['activeSettings'],
    queryFn: async () => {
      const res = await api.get('/settings/active');
      return res.data;
    },
  });

  const handleCreateProposal = () => canAccessCreateProposal ? navigate('/proposal') : toast.error('Creation restricted.');
  const handleRefreshStats = () => queryClient.invalidateQueries(['dashboardStats']);
  const handleGenerateReports = () => navigate('/comprehensive-reports');

  useKeyboardShortcuts({
    'ctrl+r': (e) => { e.preventDefault(); handleRefreshStats(); },
    'ctrl+shift+h': (e) => { e.preventDefault(); setHelpOpen(true); },
  }, [regionName]);

  const statusBreakdown = [
    { label: 'Pending Review', value: pendingProposals, color: THEME_COLORS.warning },
    { label: 'Approved/Finalized', value: approvedProposals, color: THEME_COLORS.success },
    { label: 'Rejected/Returned', value: rejectedProposals, color: THEME_COLORS.error },
  ];

  const analyticsData = {
    trends: [{ date: String(fiscalYear), total: totalProposals, approved: approvedProposals, pending: pendingProposals }],
    statusDistribution: statusBreakdown.map((s) => ({ name: s.label, value: s.value })),
    budgetTypeDistribution: [
      stats?.breakdown?.legacy?.total > 0 && { name: 'Legacy', value: stats.breakdown.legacy.total },
      stats?.breakdown?.newWorkflow?.total > 0 && { name: 'New Workflow', value: stats.breakdown.newWorkflow.total },
    ].filter(Boolean),
  };

  const actionChips = [
    { label: `FY: ${fiscalYear}`, icon: '📅' },
    { label: `Access: ${displayInfo.level}`, icon: '🔑' },
    { label: `Region: ${regionName}`, icon: '📍' },
  ];

  return (
    <>
      <Container maxWidth='xl' sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={4}>
          
        {/* --- HERO SECTION --- */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 5 },
              borderRadius: 6,
              position: 'relative',
              overflow: 'hidden',
              // Updated gradient base sa request mo
              background: isDarkMode
                ? `linear-gradient(135deg, #264524 0%, #0f172a 100%)`
                : `linear-gradient(135deg, #264524 0%, #375e38 100%)`,
              color: 'white',
              boxShadow: '0 20px 40px -8px rgba(0,0,0,0.3)',
            }}
          >
            {/* Background Decorations */}
            <Box sx={{
              position: 'absolute',
              top: -120,
              right: -120,
              width: 350,
              height: 350,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha('#fff', 0.1)} 0%, transparent 70%)`,
              zIndex: 0
            }} />

            <Grid container spacing={4} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} lg={8.5}>
                <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                  <Typography variant='overline' sx={{ letterSpacing: 3, opacity: 0.9, fontWeight: 800, color: THEME_COLORS.accent, fontSize: '0.75rem' }}>
                    OFFICIAL DASHBOARD
                  </Typography>
                  <Typography variant='h3' fontWeight={900} sx={{ mt: 0.5, letterSpacing: -1, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.2 }}>
                    Mabuhay, {currentUser?.FirstName || 'User'}!
                  </Typography>
                </Stack>
                
                <Typography variant='body1' sx={{ opacity: 0.85, maxWidth: 580, mb: 4, lineHeight: 1.6, fontSize: '1rem', fontWeight: 500 }}>
                  {isPreparer
                    ? `Streamline your budget management for ${displayInfo.name}. Your central hub for submissions and compliance tracking for FY ${fiscalYear}.`
                    : `Comprehensive overview of all budget submissions for ${displayInfo.name}. Monitor progress and review pending items in real-time.`}
                </Typography>
                
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mb: 4 }}>
                  {actionChips.map((chip) => (
                    <Chip
                      key={chip.label}
                      label={chip.label}
                      icon={<span style={{ fontSize: '1rem' }}>{chip.icon}</span>}
                      sx={{
                        bgcolor: alpha('#fff', 0.06),
                        color: '#fff',
                        backdropFilter: 'blur(8px)',
                        border: `1px solid ${alpha('#fff', 0.1)}`,
                        fontWeight: 700,
                        px: 1,
                        py: 2,
                        borderRadius: 2.5,
                        height: 32,
                        fontSize: '0.85rem',
                        transition: 'all 0.3s',
                        '&:hover': { bgcolor: alpha('#fff', 0.12), transform: 'translateY(-1px)' }
                      }}
                    />
                  ))}
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {isPreparer && canAccessCreateProposal && (
                    <Button
                      variant='contained'
                      size="large"
                      onClick={handleCreateProposal}
                      startIcon={<AddCircleOutlineIcon />}
                      sx={{
                        bgcolor: '#fff',
                        color: '#264524', // Match sa deep green para cohesive
                        fontWeight: 800,
                        px: 4,
                        py: 1.5,
                        borderRadius: 3,
                        fontSize: '0.95rem',
                        boxShadow: '0 8px 16px -4px rgba(0,0,0,0.2)',
                        '&:hover': { bgcolor: alpha('#fff', 0.95), transform: 'translateY(-2px)' },
                        transition: 'all 0.2s'
                      }}
                    >
                      New Proposal
                    </Button>
                  )}
                  <Button
                    variant='outlined'
                    size="large"
                    onClick={handleRefreshStats}
                    sx={{
                      color: '#fff',
                      borderColor: alpha('#fff', 0.3),
                      borderWidth: 1.5,
                      fontWeight: 700,
                      px: 3.5,
                      py: 1.5,
                      borderRadius: 3,
                      fontSize: '0.9rem',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08), borderWidth: 1.5, transform: 'translateY(-2px)' },
                      transition: 'all 0.2s'
                    }}
                  >
                    Refresh Analytics
                  </Button>
                </Stack>
              </Grid>

              <Grid item xs={12} lg={3.5}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  bgcolor: alpha('#fff', 0.05),
                  p: 3.5,
                  borderRadius: 5,
                  border: `1px solid ${alpha('#fff', 0.1)}`,
                  textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                }}>
                   <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2.5 }}>
                      <CircularProgress
                        variant="determinate"
                        value={100}
                        size={120}
                        thickness={4.5}
                        sx={{ color: alpha('#fff', 0.1) }}
                      />
                      <CircularProgress
                        variant="determinate"
                        value={Number(completionRate)}
                        size={120}
                        thickness={4.5}
                        sx={{ 
                          color: THEME_COLORS.accent, 
                          position: 'absolute', 
                          left: 0, 
                          strokeLinecap: 'round',
                        }}
                      />
                      <Box sx={{
                        top: 0, left: 0, bottom: 0, right: 0,
                        position: 'absolute', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: -0.5 }}>{completionRate}%</Typography>
                      </Box>
                   </Box>
                   <Typography variant="h6" fontWeight="800" sx={{ mb: 0.5, fontSize: '1.1rem' }}>Submission Health</Typography>
                   <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600, maxWidth: 180, display: 'block' }}>Approved vs Total Submissions for FY {fiscalYear}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* --- STATS CARDS --- */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, ml: 0.5 }}>
              <Typography variant='h5' fontWeight='900' sx={{ display: 'flex', alignItems: 'center', gap: 2, letterSpacing: -0.5 }}>
                <AssessmentIcon sx={{ color: THEME_COLORS.primary, fontSize: 32 }} /> Key Performance Indicators
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, bgcolor: alpha(theme.palette.divider, 0.05), px: 2, py: 0.8, borderRadius: 2 }}>
                Last synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Typography>
            </Stack>
            {isLoading ? (
              <StatCardSkeleton count={4} />
            ) : (
              <Grid container spacing={4}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard title='Total Proposals' value={totalProposals} color={THEME_COLORS.info} icon={TrendingUpIcon} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard title='Pending Review' value={pendingProposals} color={THEME_COLORS.warning} icon={PendingActionsIcon} subtitle={`${totalProposals > 0 ? ((pendingProposals / totalProposals) * 100).toFixed(1) : 0}% of total`} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard title='Approved' value={approvedProposals} color={THEME_COLORS.success} icon={CheckCircleIcon} subtitle={`${totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatCard title='Rejected' value={rejectedProposals} color={THEME_COLORS.error} icon={CancelIcon} subtitle={`${totalProposals > 0 ? ((rejectedProposals / totalProposals) * 100).toFixed(1) : 0}% of total`} />
                </Grid>
              </Grid>
            )}
          </Box>
{/* --- HEALTH & CONTEXT SECTION --- */}
<Grid 
  container 
  spacing={4} 
  alignItems="stretch" 
  sx={{ 
    width: '100%', 
    margin: 0, // Sinisiguro na walang extra margin na hihila sa Grid
    '& .MuiGrid-item': {
      paddingTop: 4, // Manual override para sa spacing alignment
      paddingBottom: 0
    }
  }}
>
  {/* LEFT COLUMN: Proposal Distribution */}
  <Grid item xs={12} md={7} sx={{ pl: '0 !important' }}> {/* Tinanggal ang padding-left sa leftmost item */}
    <Paper 
      elevation={0} 
      sx={{ 
        p: 4, 
        borderRadius: 6, 
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, 
        height: '100%',
        bgcolor: isDarkMode ? alpha('#fff', 0.01) : '#fff',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight="900" sx={{ letterSpacing: -0.5 }}>Proposal Distribution</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Real-time status tracking</Typography>
        </Box>
        <Button 
          variant="soft" 
          size="small"
          onClick={() => navigate('/allproposal')} 
          sx={{ fontWeight: 800, bgcolor: alpha(THEME_COLORS.primary, 0.08), color: THEME_COLORS.primary }}
        >
          VIEW ALL
        </Button>
      </Stack>

      <Stack spacing={4} sx={{ mt: 'auto', mb: 'auto' }}>
        {statusBreakdown.map((status) => (
          <Box key={status.label}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight="700">{status.label}</Typography>
              <Typography variant="body2" fontWeight="900" sx={{ color: status.color }}>{status.value}</Typography>
            </Stack>
            <LinearProgress 
              variant="determinate" 
              value={totalProposals ? (status.value / totalProposals) * 100 : 0} 
              sx={{ height: 10, borderRadius: 5, bgcolor: alpha(status.color, 0.08) }}
            />
          </Box>
        ))}
      </Stack>
    </Paper>
  </Grid>

  {/* RIGHT COLUMN: System Context */}
  <Grid item xs={12} md={5} sx={{ pr: '0 !important' }}> {/* Tinanggal ang padding-right sa rightmost item */}
    <Paper 
      elevation={0} 
      sx={{ 
        p: 4, 
        borderRadius: 6, 
        bgcolor: isDarkMode ? alpha('#fff', 0.02) : '#f8fafc', 
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Typography variant="h5" fontWeight="900" sx={{ mb: 4, letterSpacing: -0.5 }}>System Context</Typography>
      <Stack spacing={2.5} sx={{ mt: 'auto', mb: 'auto' }}>
        {[
          { label: 'Active Region', value: regionName, icon: '📍' },
          { label: 'Division', value: divisionName || 'N/A', icon: '🏢' },
          { label: 'Department', value: userDepartment || 'N/A', icon: '📋' },
          { label: 'Access Scope', value: displayInfo.scope, icon: '🔑' }
        ].map((item, idx) => (
          <Box 
            key={idx} 
            sx={{ 
              p: 2, 
              borderRadius: 4, 
              bgcolor: isDarkMode ? alpha('#fff', 0.03) : '#fff',
              border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2.5
            }}
          >
            <Box sx={{ fontSize: '1.3rem', p: 1.2, bgcolor: alpha(THEME_COLORS.primary, 0.05), borderRadius: 3, lineHeight: 1 }}>
              {item.icon}
            </Box>
            <Box>
              <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{item.label}</Typography>
              <Typography variant="body2" fontWeight="700" sx={{ color: 'text.primary' }}>{item.value}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  </Grid>
</Grid>

          {/* --- DEADLINE REMINDER --- */}
          {activeSettings?.dueDate && (
            <DeadlineReminder deadline={activeSettings.dueDate} label="Budget Submission Deadline" showIcon={true} />
          )}

          {/* --- ANALYTICS --- */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 5, 
              borderRadius: 6, 
              bgcolor: isDarkMode ? alpha('#fff', 0.01) : alpha(THEME_COLORS.primary, 0.02),
              border: `1px solid ${alpha(THEME_COLORS.primary, 0.08)}`,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
              <Box>
                <Typography variant='h5' fontWeight='900' sx={{ letterSpacing: -0.5 }}>📊 Visual Analytics</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Historical trends and current distribution</Typography>
              </Box>
              <Button 
                startIcon={<HelpOutlineIcon />} 
                onClick={() => setHelpOpen(true)}
                sx={{ 
                  fontWeight: 700, 
                  textTransform: 'none',
                  color: 'text.secondary',
                  '&:hover': { color: THEME_COLORS.primary, bgcolor: alpha(THEME_COLORS.primary, 0.05) }
                }}
              >
                Help & Legend
              </Button>
            </Stack>
            <Box sx={{ 
              p: 2, 
              bgcolor: isDarkMode ? alpha('#000', 0.2) : '#fff', 
              borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.divider, 0.05)}`
            }}>
              <DashboardAnalytics data={analyticsData} />
            </Box>
          </Paper>

          {/* --- QUICK ACTIONS --- */}
          <Box sx={{ pb: 6 }}>
            <Box sx={{ mb: 4, ml: 0.5 }}>
              <Typography variant='h5' fontWeight='900' sx={{ letterSpacing: -0.5 }}>🚀 Quick Operations</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Common tasks and shortcuts for your role</Typography>
            </Box>
            <Grid container spacing={4}>
              {isPreparer && canAccessCreateProposal && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard title='New Proposal' description='Initiate a fresh budget proposal using the official 6-step wizard.' icon={AddCircleOutlineIcon} color={THEME_COLORS.primary} onClick={handleCreateProposal} buttonText='Start Creation' />
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={4}>
                <ActionCard title='Deep Analytics' description='Explore granular data with customizable reporting tools.' icon={AssessmentIcon} color={THEME_COLORS.info} onClick={handleGenerateReports} buttonText='Open Reports' />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <ActionCard title='Workflow Tracker' description='Monitor every stage of your submissions in the central pipeline.' icon={ListAltIcon} color={THEME_COLORS.warning} onClick={() => navigate('/allproposal')} buttonText='View Tracker' />
              </Grid>
            </Grid>
          </Box>

        </Stack>
      </Container>

      <WorkflowTemplateSelector open={templateSelectorOpen} onClose={() => setTemplateSelectorOpen(false)} onSelectTemplate={(t) => console.log(t)} fiscalYear={activeSettings?.fiscalYear} />
      <InAppHelp open={helpOpen} onClose={() => setHelpOpen(false)} context="dashboard" />
    </>
  );
};

export default HomePage;