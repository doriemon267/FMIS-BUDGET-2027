import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
  alpha,
  LinearProgress,
  CircularProgress,
  CardActionArea,
  useTheme
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Icons
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InboxIcon from '@mui/icons-material/Inbox';

// Contexts & Hooks
import { useThemeContext } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useRegion } from '../context/RegionContext';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

// Config & Utils
import api from '../config/api';
import { handleApiError } from '../utils/errorHandler';
import { hasPermission } from '../utils/permissions';
// import logger from '../utils/logger'; // Kept available if needed for debugging

// Components
import { StatCardSkeleton } from '../components/common/LoadingSkeleton';
import WorkflowTemplateSelector from '../components/workflow/WorkflowTemplateSelector';
import DashboardAnalytics from '../components/dashboard/DashboardAnalytics';
import InAppHelp from '../components/common/InAppHelp';
import DeadlineReminder from '../components/common/DeadlineReminder';

// --- ENTERPRISE UTILS ---

/**
 * Formats user display name securely with fallbacks
 */
const formatDisplayName = (user) => {
  if (!user) return "User";
  
  const first = user.FirstName || user.firstName || "";
  const last = user.LastName || user.lastName || "";
  if (first && last) return `${first} ${last}`;
  if (first) return first;

  const rawFallback = user.DisplayName || user.displayName || user.Username || user.username;
  const fallback = Array.isArray(rawFallback) ? rawFallback[0] : rawFallback;

  if (fallback && typeof fallback === "string" && !fallback.toLowerCase().includes("dev user")) {
    return fallback;
  }

  const roles = user.Roles || [];
  if (roles.length > 0) {
    const primary = roles[0];
    if (primary.toLowerCase().includes("super")) return "Super Admin";
    return primary.replace(/_/g, " ");
  }

  return "User";
};

/**
 * Formats large numbers for enterprise dashboards (e.g., 1500 -> 1.5k)
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
};

// --- ENHANCED REUSABLE COMPONENTS ---

// Ideal for future refactoring: Move StatCard and ActionCard to their own files in /components
const StatCard = React.memo(({ title, value, color, icon: Icon, isLoading, subtitle }) => {
  const { mode } = useThemeContext();
  const isDarkMode = mode === 'dark';

  return (
    <Card
      elevation={0}
      component="article"
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
            <Typography variant='h3' fontWeight='900' sx={{ color: color, letterSpacing: -0.5 }} aria-live="polite">
              {isLoading ? <CircularProgress size={28} color="inherit" /> : formatNumber(value)}
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
            <Icon sx={{ fontSize: 32 }} aria-hidden="true" />
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
      <Box sx={{
        position: 'absolute', bottom: -20, right: -20, width: 100, height: 100,
        borderRadius: '50%', bgcolor: alpha(color, 0.03), zIndex: 0, pointerEvents: 'none'
      }} />
    </Card>
  );
});

const ActionCard = React.memo(({ title, description, icon: Icon, color, onClick, buttonText }) => {
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
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          borderColor: alpha(color, 0.3),
          bgcolor: isDarkMode ? alpha(color, 0.04) : alpha(color, 0.01),
          transform: 'translateY(-6px)',
          boxShadow: '0 25px 50px -20px rgba(0,0,0,0.12)',
          '& .action-icon-box': { 
            bgcolor: color, color: '#fff', transform: 'scale(1.1) rotate(-5deg)'
          },
          '& .action-button': {
            bgcolor: color, color: '#fff', transform: 'translateY(-2px)'
          }
        },
      }}
    >
      {/* CardActionArea ensures enterprise-level keyboard accessibility (Tab + Enter) */}
      <CardActionArea onClick={onClick} sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 4, zIndex: 1 }}>
        <Box className="action-icon-box" sx={{
          display: 'inline-flex', p: 2, borderRadius: 3, bgcolor: alpha(color, 0.1),
          color: color, mb: 3, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 10px 20px -5px ${alpha(color, 0.2)}`
        }}>
          <Icon sx={{ fontSize: 30 }} aria-hidden="true" />
        </Box>
        <Typography variant='h5' fontWeight='800' gutterBottom sx={{ letterSpacing: -0.5 }}>
          {title}
        </Typography>
        <Typography variant='body1' color='text.secondary' sx={{ mb: 4, flexGrow: 1, lineHeight: 1.7, opacity: 0.8 }}>
          {description}
        </Typography>
        <Button
          component="div" // Use div to avoid invalid HTML (nested button inside button/CardActionArea)
          fullWidth
          variant='outlined'
          className="action-button"
          tabIndex={-1}
          sx={{
            borderRadius: 3, textTransform: 'none', py: 1.5, fontSize: '1rem',
            fontWeight: 700, color: color, borderColor: alpha(color, 0.3),
            transition: 'all 0.3s ease', pointerEvents: 'none' // Let CardActionArea handle the click
          }}
        >
          {buttonText}
        </Button>
      </CardActionArea>
      <Box sx={{
        position: 'absolute', top: -50, right: -50, width: 150, height: 150,
        borderRadius: '50%', background: `radial-gradient(circle, ${alpha(color, 0.08)} 0%, transparent 70%)`,
        zIndex: 0, pointerEvents: 'none'
      }} />
    </Card>
  );
});

// --- MAIN PAGE COMPONENT ---

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode } = useThemeContext();
  const { currentUser } = useUser();
  const { activeRegion, availableRegions } = useRegion();
  const queryClient = useQueryClient();
  
  const isDarkMode = mode === 'dark';

  const THEME_COLORS = useMemo(() => ({
    primary: '#60a561',
    secondary: '#386641',
    deepGreen: '#1b4332',
    success: '#6a994e',
    warning: '#f48c06',
    error: '#d00000',
    info: '#0077b6',
    accent: '#a7c957'
  }), []);

  const userRoles = useMemo(() => 
    Array.isArray(currentUser?.Roles) ? currentUser.Roles : currentUser?.Roles ? [currentUser.Roles] : []
  , [currentUser]);
  
  const isPreparer = userRoles.includes('BUDGET_PREPARER');

  const rawScope = String(currentUser?.hierarchicalAccess?.scope || 'REGION').toUpperCase();
  const accessibleDivisions = currentUser?.hierarchicalAccess?.accessibleDivisions || [];
  const accessibleDepartments = currentUser?.hierarchicalAccess?.accessibleDepartments || [];
  
  const hasDivisionAssignment = accessibleDivisions.length > 0;
  const hasDepartmentAssignment = accessibleDepartments.length > 0;

  let userAccessLevel = rawScope;
  let userDivision = accessibleDivisions[0];
  const userDepartment = accessibleDepartments[0]?.departmentName;

  if (rawScope === 'BUDGET_AND_REVENUE_DIVISION' || hasDivisionAssignment) {
    userAccessLevel = 'DIVISION';
  } else if (rawScope === 'DEPARTMENT' || hasDepartmentAssignment) {
    userAccessLevel = 'DEPARTMENT';
  }

  if (isPreparer && (userAccessLevel === 'REGION' || !userAccessLevel || userAccessLevel === 'BUDGET_AND_REVENUE_DIVISION')) {
    userAccessLevel = 'DIVISION';
  }

  const divisionName = typeof userDivision === 'string' ? userDivision : (userDivision?.name || userDivision?.divisionName);
  const normRole = (r) => String(r || '').toUpperCase().replace(/\s+/g, '_').trim();
  const isBudgetManager = useMemo(() => 
    userRoles.some((r) => normRole(r) === 'BUDGET_MANAGER' || normRole(r) === 'OVERALL_BUDGET_APPROVER')
  , [userRoles]);
  
  const regionName = (isBudgetManager && availableRegions?.length > 1) ? 'All Regions' : (activeRegion?.name || activeRegion?.regionName);

  const displayInfo = useMemo(() => {
    switch (userAccessLevel) {
      case 'DIVISION': return { level: 'Division', name: divisionName || 'Your Division', scope: `${divisionName || 'Division'} (${userDepartment || 'Dept'}, ${regionName})` };
      case 'DEPARTMENT': return { level: 'Department', name: userDepartment || 'Your Department', scope: `${userDepartment || 'Dept'} (${regionName})` };
      case 'FULL': return { level: 'System', name: 'All Regions', scope: 'Full System Access' };
      default: return { level: 'Region', name: regionName || 'Your Region', scope: `${regionName || 'Region'}` };
    }
  }, [userAccessLevel, divisionName, userDepartment, regionName]);

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

  const hasCreateProposalEligibility = useMemo(() => {
    const userRolesUpper = userRoles.map((role) => String(role).toUpperCase());
    const isSuperAdminUser = userRolesUpper.some(r => ['SUPER ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(r));
    if (isSuperAdminUser) return true;
    
    const hasCreatePermission = hasPermission(currentUser, 'CreateProposals') || hasPermission(currentUser, 'EditOwnProposals');
    const hasBlockedRole = userRolesUpper.some(r => [
      'BUDGET MANAGER', 'BUDGET_MANAGER', 'BUDGET OFFICER', 'BUDGET_OFFICER',
      'BUDGET APPROVER', 'BUDGET_APPROVER', 'BUDGET REVIEWER', 'BUDGET_REVIEWER',
      'BUDGET PLANNING ANALYST', 'BUDGET_PLANNING_ANALYST',
    ].includes(r));
    
    return hasCreatePermission && !hasBlockedRole;
  }, [currentUser, userRoles]);

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

  // Enterprise optimization: Wrap handlers in useCallback
  const handleCreateProposal = useCallback(() => {
    if (canAccessCreateProposal) navigate('/proposal');
    else toast.error('Creation restricted or you have an active proposal pending.');
  }, [canAccessCreateProposal, navigate]);

  const handleRefreshStats = useCallback(() => {
    queryClient.invalidateQueries(['dashboardStats']);
    toast.info('Analytics refreshing...');
  }, [queryClient]);

  const handleGenerateReports = useCallback(() => navigate('/comprehensive-reports'), [navigate]);

  useKeyboardShortcuts({
    'ctrl+r': (e) => { e.preventDefault(); handleRefreshStats(); },
    'ctrl+shift+h': (e) => { e.preventDefault(); setHelpOpen(true); },
  }, [handleRefreshStats]);

  const statusBreakdown = useMemo(() => [
    { label: 'Pending Review', value: pendingProposals, color: THEME_COLORS.warning },
    { label: 'Approved/Finalized', value: approvedProposals, color: THEME_COLORS.success },
    { label: 'Rejected/Returned', value: rejectedProposals, color: THEME_COLORS.error },
  ], [pendingProposals, approvedProposals, rejectedProposals, THEME_COLORS]);

  const analyticsData = useMemo(() => ({
    trends: [{ date: String(fiscalYear), total: totalProposals, approved: approvedProposals, pending: pendingProposals }],
    statusDistribution: statusBreakdown.map((s) => ({ name: s.label, value: s.value })),
    budgetTypeDistribution: [
      stats?.breakdown?.legacy?.total > 0 && { name: 'Legacy', value: stats.breakdown.legacy.total },
      stats?.breakdown?.newWorkflow?.total > 0 && { name: 'New Workflow', value: stats.breakdown.newWorkflow.total },
    ].filter(Boolean),
  }), [fiscalYear, totalProposals, approvedProposals, pendingProposals, statusBreakdown, stats]);

  const actionChips = useMemo(() => [
    { label: `FY: ${fiscalYear}`, icon: '📅' },
    { label: `Access: ${displayInfo.level}`, icon: '🔑' },
    { label: `Region: ${regionName}`, icon: '📍' },
  ], [fiscalYear, displayInfo.level, regionName]);

  return (
    <>
      <Container maxWidth={false} sx={{ pt: { xs: 2, md: 1 }, pb: { xs: 4, md: 5 }, px: { xs: 2, md: 3 } }}>
        <Stack spacing={4}>
          
          {/* --- HERO SECTION --- */}
          <Paper
            elevation={0}
            component="section"
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 5,
              position: 'relative',
              overflow: 'hidden',
              bgcolor: isDarkMode ? alpha('#fff', 0.02) : '#fff',
              border: `1px solid ${isDarkMode ? alpha('#fff', 0.1) : alpha('#000', 0.06)}`,
              boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)',
            }}
          >
            <Box sx={{
              position: 'absolute', top: -100, right: -50, width: 400, height: 400,
              borderRadius: '50%', background: `radial-gradient(circle, ${alpha(THEME_COLORS.primary, 0.03)} 0%, transparent 70%)`, zIndex: 0
            }} />
            <Box sx={{
              position: 'absolute', bottom: -50, left: -50, width: 300, height: 300,
              borderRadius: '50%', background: `radial-gradient(circle, ${alpha(THEME_COLORS.accent, 0.05)} 0%, transparent 70%)`, zIndex: 0
            }} />

            <Grid container spacing={4} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              <Grid item xs={12} lg={8}>
                <Stack spacing={1} sx={{ mb: 3 }}>
                  <Typography variant='overline' component="h2" sx={{ letterSpacing: 3, fontWeight: 800, color: THEME_COLORS.primary, fontSize: '0.75rem' }}>
                    OFFICIAL BUDGET SYSTEM
                  </Typography>
                  <Typography variant='h4' component="h1" fontWeight={900} sx={{ mt: 0.5, letterSpacing: -0.8, fontSize: { xs: '1.5rem', md: '1.8rem' }, lineHeight: 1.2, color: isDarkMode ? '#fff' : '#1a1a1a' }}>
                    Mabuhay, {formatDisplayName(currentUser)}!
                  </Typography>
                </Stack>
                
                <Typography variant='body1' sx={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)', maxWidth: 600, mb: 4, lineHeight: 1.7, fontSize: '1.05rem', fontWeight: 500 }}>
                  {isPreparer
                    ? `Welcome back to your central hub for FMIS budget management. You can now manage your budget proposals and track compliance for FY ${fiscalYear}.`
                    : `Welcome back! Here is an overview of budget submissions for ${displayInfo.name}. You can monitor progress and review pending items in real-time.`}
                </Typography>
                
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mb: 0 }}>
                  {actionChips.map((chip) => (
                    <Chip
                      key={chip.label}
                      label={chip.label}
                      icon={<span style={{ fontSize: '1rem' }}>{chip.icon}</span>}
                      sx={{
                        bgcolor: isDarkMode ? alpha('#fff', 0.05) : alpha(THEME_COLORS.primary, 0.05),
                        color: isDarkMode ? '#fff' : THEME_COLORS.secondary,
                        border: `1px solid ${isDarkMode ? alpha('#fff', 0.1) : alpha(THEME_COLORS.primary, 0.1)}`,
                        fontWeight: 700, px: 1, borderRadius: 2.5, height: 32, fontSize: '0.85rem',
                        transition: 'all 0.2s', '&:hover': { bgcolor: isDarkMode ? alpha('#fff', 0.1) : alpha(THEME_COLORS.primary, 0.1) }
                      }}
                    />
                  ))}
                </Stack>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Box sx={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  bgcolor: isDarkMode ? alpha('#fff', 0.03) : '#f8fafc', p: 3, borderRadius: 5,
                  border: `1px solid ${isDarkMode ? alpha('#fff', 0.1) : 'rgba(0,0,0,0.04)'}`, textAlign: 'center',
                  boxShadow: isDarkMode ? 'none' : 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}>
                   <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                      <CircularProgress variant="determinate" value={100} size={120} thickness={5} sx={{ color: isDarkMode ? alpha('#fff', 0.05) : alpha(THEME_COLORS.primary, 0.08) }} />
                      <CircularProgress
                        variant="determinate" value={Number(completionRate)} size={120} thickness={5}
                        sx={{ 
                          color: THEME_COLORS.primary, position: 'absolute', left: 0, strokeLinecap: 'round',
                          filter: `drop-shadow(0 0 10px ${alpha(THEME_COLORS.primary, 0.3)})`
                        }}
                      />
                      <Box sx={{
                        top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex',
                        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="h3" fontWeight="900" sx={{ letterSpacing: -1, color: isDarkMode ? '#fff' : THEME_COLORS.secondary }}>{completionRate}%</Typography>
                      </Box>
                   </Box>
                   <Typography variant="h6" fontWeight="900" sx={{ mb: 0.5, fontSize: '1.1rem', color: isDarkMode ? '#fff' : '#1a1a1a' }}>Submission Health</Typography>
                   <Typography variant="caption" sx={{ color: isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontWeight: 700, maxWidth: 200, display: 'block' }}>Approved vs Total for FY {fiscalYear}</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* --- DEADLINE REMINDER --- */}
          {activeSettings?.dueDate && (
            <DeadlineReminder deadline={activeSettings.dueDate} label="Budget Submission Deadline" showIcon={true} />
          )}

          {/* --- QUICK ACTIONS (Moved up for better UX/Enterprise workflow) --- */}
          <Box component="section">
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 3 }}>
              <Box>
                <Typography variant='h5' component="h2" fontWeight='900' sx={{ letterSpacing: -0.5 }}>🚀 Quick Operations</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Common tasks and shortcuts for your role</Typography>
              </Box>
              <Button
                variant='outlined'
                size="small"
                onClick={handleRefreshStats}
                sx={{
                  color: THEME_COLORS.primary, borderColor: alpha(THEME_COLORS.primary, 0.3), fontWeight: 700, borderRadius: 2,
                  '&:hover': { borderColor: THEME_COLORS.primary, bgcolor: alpha(THEME_COLORS.primary, 0.05) }
                }}
              >
                Refresh Data
              </Button>
            </Stack>
            <Grid container spacing={3}>
              {isPreparer && (
                <Grid item xs={12} sm={6} md={4}>
                  <ActionCard 
                    title='New Proposal' 
                    description='Initiate a fresh budget proposal using the official 6-step wizard.' 
                    icon={AddCircleOutlineIcon} 
                    color={THEME_COLORS.primary} 
                    onClick={handleCreateProposal} 
                    buttonText={canAccessCreateProposal ? 'Start Creation' : 'Creation Restricted'} 
                  />
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

          {/* --- STATS CARDS --- */}
          <Box component="section">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Typography variant='h5' component="h2" fontWeight='900' sx={{ display: 'flex', alignItems: 'center', gap: 2, letterSpacing: -0.5 }}>
                <AssessmentIcon sx={{ color: THEME_COLORS.primary, fontSize: 32 }} /> Key Performance Indicators
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, bgcolor: alpha(theme.palette.divider, 0.05), px: 2, py: 0.8, borderRadius: 2 }}>
                Last synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Typography>
            </Stack>
            {isLoading ? (
              <StatCardSkeleton count={4} />
            ) : (
              <Grid container spacing={3}>
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
          <Grid container spacing={3} alignItems="stretch" component="section">
            {/* LEFT COLUMN: Proposal Distribution */}
            <Grid item xs={12} md={7}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 4, borderRadius: 6, border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, height: '100%',
                  bgcolor: isDarkMode ? alpha('#fff', 0.01) : '#fff', display: 'flex', flexDirection: 'column'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 4 }}>
                  <Box>
                    <Typography variant="h5" component="h3" fontWeight="900" sx={{ letterSpacing: -0.5 }}>Proposal Distribution</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Real-time status tracking</Typography>
                  </Box>
                  <Button 
                    variant="soft" size="small" onClick={() => navigate('/allproposal')} 
                    sx={{ fontWeight: 800, bgcolor: alpha(THEME_COLORS.primary, 0.08), color: THEME_COLORS.primary }}
                  >
                    VIEW ALL
                  </Button>
                </Stack>

                <Stack spacing={4} sx={{ mt: 'auto', mb: 'auto', flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
                  {totalProposals > 0 ? (
                    statusBreakdown.map((status) => (
                      <Box key={status.label}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 1.5 }}>
                          <Typography variant="body2" fontWeight="700">{status.label}</Typography>
                          <Typography variant="body2" fontWeight="900" sx={{ color: status.color }}>{formatNumber(status.value)}</Typography>
                        </Stack>
                        <LinearProgress 
                          variant="determinate" 
                          value={(status.value / totalProposals) * 100} 
                          sx={{ height: 10, borderRadius: 5, bgcolor: alpha(status.color, 0.08) }}
                        />
                      </Box>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4, opacity: 0.8 }}>
                      <InboxIcon sx={{ fontSize: 64, mb: 2, color: 'text.disabled' }} />
                      <Typography variant="body1" fontWeight="700" color="text.secondary">No Proposals Yet</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>Data will appear once submissions begin.</Typography>
                      {isPreparer && (
                        <Button 
                          variant="outlined" 
                          onClick={handleCreateProposal}
                          disabled={!canAccessCreateProposal}
                          sx={{ borderColor: THEME_COLORS.primary, color: THEME_COLORS.primary }}
                        >
                          Create First Proposal
                        </Button>
                      )}
                    </Box>
                  )}
                </Stack>
              </Paper>
            </Grid>

            {/* RIGHT COLUMN: System Context */}
            <Grid item xs={12} md={5}>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 4, borderRadius: 6, bgcolor: isDarkMode ? alpha('#fff', 0.02) : '#f8fafc', 
                  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, height: '100%',
                  display: 'flex', flexDirection: 'column'
                }}
              >
                <Typography variant="h5" component="h3" fontWeight="900" sx={{ mb: 4, letterSpacing: -0.5 }}>System Context</Typography>
                <Stack spacing={2.5} sx={{ mt: 'auto', mb: 'auto' }}>
                  {[
                    { label: 'Active Region', value: regionName, icon: '📍' },
                    { label: 'Division', value: divisionName || 'N/A', icon: '🏢' },
                    { label: 'Department', value: userDepartment || 'N/A', icon: '📋' },
                    { label: 'Access Scope', value: displayInfo.level, icon: '🔑' }
                  ].map((item, idx) => (
                    <Box 
                      key={idx} 
                      sx={{ 
                        p: 2, borderRadius: 4, bgcolor: isDarkMode ? alpha('#fff', 0.03) : '#fff',
                        border: `1px solid ${alpha(theme.palette.divider, 0.05)}`, display: 'flex',
                        alignItems: 'center', gap: 2.5
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

          {/* --- ANALYTICS --- */}
          <Paper 
            elevation={0} 
            component="section"
            sx={{ 
              p: 4, borderRadius: 6, bgcolor: isDarkMode ? alpha('#fff', 0.01) : alpha(THEME_COLORS.primary, 0.02),
              border: `1px solid ${alpha(THEME_COLORS.primary, 0.08)}`, overflow: 'hidden', position: 'relative', mb: 6
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 5 }}>
              <Box>
                <Typography variant='h5' component="h2" fontWeight='900' sx={{ letterSpacing: -0.5 }}>📊 Visual Analytics</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Historical trends and current distribution</Typography>
              </Box>
              <Button 
                startIcon={<HelpOutlineIcon />} 
                onClick={() => setHelpOpen(true)}
                sx={{ 
                  fontWeight: 700, textTransform: 'none', color: 'text.secondary',
                  '&:hover': { color: THEME_COLORS.primary, bgcolor: alpha(THEME_COLORS.primary, 0.05) }
                }}
              >
                Help & Legend
              </Button>
            </Stack>
            <Box sx={{ 
              p: 2, bgcolor: isDarkMode ? alpha('#000', 0.2) : '#fff', borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.divider, 0.05)}`
            }}>
              <DashboardAnalytics data={analyticsData} />
            </Box>
          </Paper>

        </Stack>
      </Container>

      <WorkflowTemplateSelector open={templateSelectorOpen} onClose={() => setTemplateSelectorOpen(false)} onSelectTemplate={(t) => console.log(t)} fiscalYear={activeSettings?.fiscalYear} />
      <InAppHelp open={helpOpen} onClose={() => setHelpOpen(false)} context="dashboard" />
    </>
  );
};

export default HomePage;