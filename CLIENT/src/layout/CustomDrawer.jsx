import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  IconButton,
  List,
  Tooltip,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  LuLayoutDashboard,
  LuFileText,
  LuUsers,
  LuSettings,
  LuLink,
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
  LuContact,
  LuHistory,
  LuFilePlus,
  LuLayers,
  LuDatabase,
  LuShieldCheck,
  LuBriefcase,
  LuReceipt,
  LuBanknote,
  LuWallet,
  LuClock,
  LuTrendingUp,
  LuCar,
  LuBuilding,
  LuNetwork,
  LuUserCog,
} from 'react-icons/lu';

import { useNavigate } from 'react-router-dom';

// Logic & Utils from Original Code
import LinkTo from '../global/components/LinkTo';
import { isSuperAdmin } from '../utils/checkRole';
import { hasPermission } from '../utils/permissions';
import {
  JOB_ROLES,
  isBRDLevelUser,
  hasApproverRole as checkHasApproverRole,
} from '../constants/roles';
import { useUser } from '../context/UserContext';
import { useDrawer } from '../context/DrawerContext';
import { useRoutePermissions } from '../context/RoutePermissionContext';
import { canAccessRoutePermission } from '../utils/routePermissionAccess';
import { canAccessTierPage } from '../utils/tierAccess';
import IS_PRODUCTION from '../utils/IS_PRODUCTION';
import api from '../config/api';
import logger from '../utils/logger';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

const CustomDrawer = () => {
  const { currentUser, logout } = useUser();
  const { open, collapsed: isCollapsed, toggleCollapsed } = useDrawer();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const collapsed = isMobile ? !open : isCollapsed;
  const showDesktopCollapseControls = !isMobile;
  const navigate = useNavigate();

  const getResponsivePadding = () => {
    if (isXs) return '6px 8px';
    if (isMobile) return '8px 10px';
    if (collapsed) return '8px 12px';
    return 2;
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to sign out?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#386641',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      allowOutsideClick: false,
    });

    if (result.isConfirmed) {
      try {
        await logout();
        toast.success('Logged out successfully');
      } catch (err) {
        logger.error('Logout failed', err);
        toast.error('Logout failed');
      }
    }
  };

  const [hasFinalizedProposals, setHasFinalizedProposals] = useState(false);
  const [canAccessCreateProposal, setCanAccessCreateProposal] = useState(false);
  const [activeBudgetType, setActiveBudgetType] = useState(null);

  const roles = (currentUser?.Roles || []).map(String);
  const workflowRoles = (currentUser?.workflowRoles || currentUser?.hierarchicalAccess?.workflowRoles || []).map(String);

  const isOverallApprover = roles.some(r => String(r) === JOB_ROLES.BUDGET_MANAGER);
  const isBudgetOfficer = roles.some(r => String(r) === JOB_ROLES.BUDGET_OFFICER);
  const isApprover = checkHasApproverRole(roles, workflowRoles);
  const isReviewer = roles.some(r => String(r) === JOB_ROLES.BUDGET_REVIEWER);
  const isPreparer = roles.some(r => String(r) === JOB_ROLES.BUDGET_PREPARER);
  const isBudgetPlanningAnalyst = roles.some(r => String(r) === JOB_ROLES.BUDGET_PLANNING_ANALYST);
  const isBRDLevel = isBRDLevelUser(currentUser);

  const reportLinkName = (name) => {
    if (isBRDLevel) return name;
    return name.replace(/Consolidated /gi, '');
  };

  const displayRole = useMemo(() => {
    if (!roles.length) {
      if (isSuperAdmin(currentUser)) return 'Admin';
      return 'User';
    }
    
    // Prioritize budget-related roles
    const budgetRoles = [
      JOB_ROLES.BUDGET_PREPARER,
      JOB_ROLES.BUDGET_REVIEWER,
      JOB_ROLES.BUDGET_APPROVER,
      JOB_ROLES.BUDGET_MANAGER,
      JOB_ROLES.BUDGET_OFFICER,
      JOB_ROLES.OVERALL_BUDGET_APPROVER,
      JOB_ROLES.BUDGET_PLANNING_ANALYST,
      JOB_ROLES.BUDGET_COORDINATOR,
    ];
    
    for (const budgetRole of budgetRoles) {
      if (roles.includes(budgetRole)) {
        return budgetRole.replace(/_/g, ' ');
      }
    }
    
    // Fall back to first role if no budget role found
    const primary = roles[0];
    if (primary.toLowerCase().includes('super')) return 'Admin';
    return primary.replace(/_/g, ' ');
  }, [roles, currentUser]);

  const canSeeBRDOnlyMenus =
    isBRDLevel ||
    isBudgetPlanningAnalyst ||
    isBudgetOfficer ||
    isOverallApprover ||
    isSuperAdmin(currentUser);
  const canSeeTierMenu = canAccessTierPage(currentUser, activeBudgetType);

  const { getRoutePermission, isLoading: permissionsLoading } = useRoutePermissions();

  const checkAccess = (path, fallbackAllow) => {
    const perm = getRoutePermission(path);
    return canAccessRoutePermission({
      currentUser,
      path,
      routePermission: perm,
      fallbackAllow,
      isLoading: permissionsLoading,
    });
  };

  useEffect(() => {
    let isMounted = true;
    const fetchHasFinalized = async () => {
      try {
        const settingsRes = await api.get('/settings/active');
        const fiscalYear = settingsRes?.data?.fiscalYear;
        if (isMounted) {
          setActiveBudgetType(settingsRes?.data?.budgetType || null);
        }
        const params = fiscalYear ? { fiscalYear } : {};
        const res = await api.get('/allproposal/proposals/has-finalized', { params });
        if (isMounted && res?.data?.success) {
          setHasFinalizedProposals(!!res.data.hasFinalized);
        }
      } catch (err) {
        logger.error('Failed to check finalized proposals', err);
        if (isMounted) {
          setHasFinalizedProposals(false);
          setActiveBudgetType(null);
        }
      }
    };
    fetchHasFinalized();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkCreateProposalAccess = async () => {
      try {
        if (isSuperAdmin(currentUser)) {
          if (isMounted) setCanAccessCreateProposal(true);
          return;
        }
        const isCreateProposalCandidate =
          isPreparer ||
          ((hasPermission(currentUser, 'CreateProposals') ||
            hasPermission(currentUser, 'EditOwnProposals')) &&
          !isOverallApprover &&
          !isBudgetOfficer &&
          !isApprover &&
          !isReviewer &&
          !isBudgetPlanningAnalyst);

        if (!isCreateProposalCandidate) {
          if (isMounted) setCanAccessCreateProposal(false);
          return;
        }
        const response = await api.get('/allproposal/proposals/preparer-create-access');
        if (isMounted) setCanAccessCreateProposal(!response?.data?.hasInProcessProposal);
      } catch (err) {
        logger.warn('Failed to evaluate create proposal access', err);
      }
    };
    if (currentUser) checkCreateProposalAccess();
    return () => {
      isMounted = false;
    };
  }, [
    currentUser,
    isOverallApprover,
    isBudgetOfficer,
    isApprover,
    isReviewer,
    isPreparer,
    isBudgetPlanningAnalyst,
  ]);

  const tooltipSx = {
    tooltip: {
      sx: {
        bgcolor: 'rgba(0, 0, 0, 0.95)',
        fontSize: '0.875rem',
        fontWeight: 500,
        backdropFilter: 'blur(4px)',
        borderRadius: '8px',
        '& .MuiTooltip-arrow': { color: 'rgba(0, 0, 0, 0.95)' },
      },
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        overflow: 'visible',
        background: '#041C0F', // Deeper forest green
        position: 'relative',
      }}
    >
      {/* Fixed Header with Logo */}
      <Tooltip
        title="Financial Management Information System - Online Submission of Budget Proposal Information System"
        placement="right"
        arrow
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: 'rgba(1, 19, 9, 0.97)',
              color: '#d4f0dd',
              fontSize: '0.78rem',
              fontWeight: 600,
              backdropFilter: 'blur(6px)',
              borderRadius: '10px',
              border: '1px solid rgba(105, 216, 146, 0.25)',
              maxWidth: 260,
              lineHeight: 1.5,
              px: 1.5,
              py: 1,
              '& .MuiTooltip-arrow': { color: 'rgba(4, 28, 15, 0.97)' },
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minHeight: 70, // Matches standard app bar height
            px: collapsed ? 0 : 2.5,
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            cursor: 'default',
          }}
        >
          <Box
            sx={{
              width: collapsed ? 36 : 28,
              height: collapsed ? 36 : 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': { transform: 'scale(1.1)' },
            }}
            onClick={() => navigate('/')}
          >
            <img
              src="/2020-nia-logo.svg"
              alt="Logo"
              style={{ height: '100%', width: '100%', objectFit: 'contain' }}
            />
          </Box>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1 }}
              >
                FMIS-OSBPIS
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.6rem',
                  display: 'block',
                  mt: '2px',
                }}
              >
                Budget Proposal
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>

      {/* Moved Collapse Icon */}
      {showDesktopCollapseControls && (
        <Tooltip
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          placement="right"
          slotProps={tooltipSx}
        >
          <IconButton
            onClick={toggleCollapsed}
            size="small"
            sx={{
              position: 'absolute',
              right: -12,
              top: 70, // Aligned exactly with the bottom border
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: '#69d892',
              border: '2px solid #041C0F',
              color: '#041C0F',
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                bgcolor: '#55c07b',
                color: '#041C0F',
                transform: 'translateY(-50%) scale(1.1)',
              },
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              transition: 'all 0.2s',
            }}
          >
            {collapsed ? <LuChevronRight size={14} /> : <LuChevronLeft size={14} />}
          </IconButton>
        </Tooltip>
      )}

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          zIndex: 1,
          p: getResponsivePadding(),
          pt: 3,
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
          },
        }}
      >
        <Tooltip
          title={collapsed ? `Role: ${displayRole}` : ''}
          placement="right"
          slotProps={tooltipSx}
        >
          <Box
            sx={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              p: collapsed ? '10px 0' : '12px 14px',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 1.5,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              width: collapsed ? 40 : 'auto',
              mx: collapsed ? 'auto' : 0,
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            <Avatar
              sx={{
                background: 'rgba(105, 216, 146, 0.1)',
                width: 32,
                height: 32,
                color: '#69d892',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LuShieldCheck size={18} />
            </Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#69d892',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    display: 'block',
                    letterSpacing: '0.05em',
                  }}
                >
                  CURRENT ROLE
                </Typography>
                <Typography
                  sx={{
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayRole}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>

        <List sx={{ py: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <LinkTo
            icon={<LuLayoutDashboard size={18} />}
            name="Dashboard"
            link="/dashboard"
            isAllow={checkAccess('/dashboard', true)}
            collapsed={collapsed}
          />

          <LinkTo
            icon={<LuFileText size={18} />}
            name="Proposal Management"
            isAllow={true}
            collapsed={collapsed}
            subLinks={[
              {
                link: '/proposal',
                name: 'Create Proposal',
                isAllow: checkAccess('/proposal', canAccessCreateProposal),
                icon: <LuFilePlus size={18} />,
              },
              {
                link: '/allproposal',
                name: 'All Proposals',
                isAllow: checkAccess('/allproposal', true),
                icon: <LuFileText size={18} />,
              },
              {
                link: '/brd-consolidation',
                name: 'BRD Consolidation',
                isAllow: checkAccess('/brd-consolidation', canSeeBRDOnlyMenus),
                icon: <LuDatabase size={18} />,
              },
              {
                link: '/nep-ceiling',
                name: 'NEP Ceiling',
                isAllow: checkAccess('/nep-ceiling', canSeeBRDOnlyMenus && hasFinalizedProposals),
                icon: <LuLayoutDashboard size={18} />,
              },
              {
                link: '/tier',
                name: 'Tier',
                isAllow: canSeeTierMenu && checkAccess('/tier', canSeeTierMenu),
                icon: <LuLayers size={18} />,
              },
            ]}
          />

          <LinkTo
            icon={<LuLayoutDashboard size={18} />}
            name="Reports & Analytics"
            isAllow={true}
            collapsed={collapsed}
            subLinks={[
              {
                link: '/consolidated-corporate-income',
                name: reportLinkName('Consolidated Corporate Income'),
                isAllow: checkAccess('/consolidated-corporate-income', true),
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/consolidated-reports',
                name: reportLinkName('Consolidated MOOE'),
                isAllow: checkAccess('/consolidated-reports', true),
                icon: <LuFileText size={18} />,
              },
              {
                link: '/consolidated-capital-outlay-reports',
                name: reportLinkName('Consolidated Capital Outlay Reports'),
                isAllow: checkAccess('/consolidated-capital-outlay-reports', true),
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/consolidated-personnel-services-reports',
                name: reportLinkName('Personnel Services Reports'),
                isAllow: checkAccess('/consolidated-personnel-services-reports', true),
                icon: <LuUsers size={18} />,
              },
              // {
              //   link: '/comparative-report',
              //   name: 'Comparative Budget Report',
              //   isAllow: checkAccess('/comparative-report', true),
              //   icon: <LuLayoutDashboard size={18} />,
              // },
              {
                link: '/comprehensive-reports',
                name: 'Budget Summary Report',
                isAllow: checkAccess('/comprehensive-reports', true),
                icon: <LuLayoutDashboard size={18} />,
              },
            ]}
          />

          <LinkTo
            icon={<LuUsers size={18} />}
            name="Employees"
            link="/employee"
            isAllow={checkAccess('/employee', canSeeBRDOnlyMenus && !isReviewer && !isOverallApprover && !isBudgetOfficer)}
            collapsed={collapsed}
          />
          <LinkTo
            icon={<LuBriefcase size={18} />}
            name="Benefits"
            link="/employeeBenefits"
            isAllow={checkAccess('/employeeBenefits', canSeeBRDOnlyMenus && !isReviewer && !isOverallApprover && !isBudgetOfficer)}
            collapsed={collapsed}
          />

          <LinkTo
            icon={<LuSettings size={18} />}
            name="Settings"
            isAllow={true}
            collapsed={collapsed}
            subLinks={[
              {
                link: '/fysettings',
                name: 'Set Cut-Off',
                isAllow: checkAccess('/fysettings', false),
                icon: <LuClock size={18} strokeWidth={1.5} />,
              },
              {
                link: '/compensation-management',
                name: 'Compensation Management Settings',
                isAllow: checkAccess('/compensation-management', false),
                icon: <LuTrendingUp size={18} strokeWidth={1.5} />,
              },
              { link: '/rata', name: 'RATA', isAllow: checkAccess('/rata', false), icon: <LuCar size={18} strokeWidth={1.5} /> },
              {
                link: '/categories',
                name: 'Capital Outlay',
                isAllow: checkAccess('/categories', false),
                icon: <LuBuilding size={18} strokeWidth={1.5} />,
              },
              {
                link: '/income-management',
                name: 'Income Management',
                isAllow: checkAccess('/income-management', false),
                icon: <LuWallet size={18} strokeWidth={1.5} />,
              },
              { isDivider: true },
              {
                link: '/salary-table',
                name: 'Permanent & Casual Salary Table',
                isAllow: checkAccess('/salary-table', false),
                icon: <LuBanknote size={18} strokeWidth={1.5} />,
              },
              {
                link: '/cos-salary-table',
                name: 'COS Salary Table',
                isAllow: checkAccess('/cos-salary-table', false),
                icon: <LuBanknote size={18} strokeWidth={1.5} />,
              },
              {
                link: '/position-titles',
                name: 'Position Titles',
                isAllow: checkAccess('/position-titles', false),
                icon: <LuBriefcase size={18} strokeWidth={1.5} />,
              },
              { isDivider: true },
              {
                link: '/setup/organization',
                name: 'Organization Structure Setup',
                isAllow: checkAccess('/setup/organization', false),
                icon: <LuNetwork size={18} strokeWidth={1.5} />,
              },
              {
                link: '/hierarchical-user-assignments',
                name: 'Hierarchical User Assignments',
                isAllow: checkAccess('/hierarchical-user-assignments', false),
                icon: <LuUserCog size={18} strokeWidth={1.5} />,
              },
              {
                link: '/route-permissions',
                name: 'Route Permissions',
                isAllow: checkAccess('/route-permissions', isSuperAdmin(currentUser)),
                icon: <LuShieldCheck size={18} strokeWidth={1.5} />,
              },
              {
                link: '/user-activity-logs',
                name: 'User Activity Logs',
                isAllow: checkAccess('/user-activity-logs', isSuperAdmin(currentUser)),
                icon: <LuHistory size={18} strokeWidth={1.5} />,
              },
              {
                link: '/bulk-upload-management',
                name: 'Bulk Upload Management',
                isAllow: checkAccess('/bulk-upload-management', isSuperAdmin(currentUser)),
                icon: <LuDatabase size={18} strokeWidth={1.5} />,
              },
            ]}
          />

          <Box sx={{ my: 1, mx: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />

          <LinkTo
            icon={<LuLayers size={18} />}
            name="Subsystems"
            isAllow
            collapsed={collapsed}
            subLinks={[
              {
                link: 'https://dv.nia.gov.ph',
                name: 'Dv System',
                isAllow: true,
                icon: <LuReceipt size={18} />,
              },
              {
                link: 'https://cash.nia.gov.ph',
                name: 'Cash System',
                isAllow: true,
                icon: <LuBanknote size={18} />,
              },
              {
                link: 'https://bcd.nia.gov.ph',
                name: 'BCD System',
                isAllow: true,
                icon: <LuDatabase size={18} />,
              },
              {
                link: 'https://itinerary.nia.gov.ph',
                name: 'Itinerary System',
                isAllow: true,
                icon: <LuBriefcase size={18} />,
              },
            ]}
          />
          <LinkTo
            icon={<LuLink size={18} />}
            name="To FMIS Main"
            link={IS_PRODUCTION ? 'https://fmis.nia.gov.ph/' : 'http://localhost:3000'}
            isAllow={true}
            collapsed={collapsed}
          />
          <LinkTo
            icon={<LuContact size={18} />}
            name="Contact Support"
            link={
              IS_PRODUCTION ? 'https://fmis.nia.gov.ph/contacts' : 'http://localhost:3000/contacts'
            }
            isAllow={true}
            collapsed={collapsed}
          />
        </List>
      </Box>

      <Box sx={{ p: collapsed ? 1.5 : 2, pb: 4, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <Tooltip title={collapsed ? 'Logout' : ''} placement="right" slotProps={tooltipSx}>
          <Box
            onClick={handleLogout}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: collapsed ? 0 : 2,
              py: 1.25,
              borderRadius: '12px',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              '&:hover': { background: 'rgba(239, 68, 68, 0.08)', color: '#ff6b6b' },
            }}
          >
            <LuLogOut size={18} />
            {!collapsed && (
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Sign Out</Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CustomDrawer;
