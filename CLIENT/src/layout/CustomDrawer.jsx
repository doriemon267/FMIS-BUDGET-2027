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
  alpha,
} from '@mui/material';
import { keyframes } from '@mui/system';
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
  LuArrowLeftRight,
  LuWallet,
  LuCoins,
  LuPenTool,
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
import IS_PRODUCTION from '../utils/IS_PRODUCTION';
import api from '../config/api';
import logger from '../utils/logger';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import env from '../utils/env';

const CustomDrawer = () => {
  const { currentUser, logout } = useUser();
  const { open, collapsed: isCollapsed, toggleDrawer, toggleCollapsed } = useDrawer();
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

  const roles = (currentUser?.Roles || []).map(String);
  const workflowRoles = (currentUser?.workflowRoles || []).map(String);

  const isOverallApprover = roles.some(r => String(r) === JOB_ROLES.BUDGET_MANAGER);
  const isBudgetAdmin = roles.some(r => String(r) === JOB_ROLES.BUDGET_ADMIN);
  const isBudgetOfficer = roles.some(r => String(r) === JOB_ROLES.BUDGET_OFFICER);
  const isApprover = checkHasApproverRole(roles, workflowRoles);
  const isReviewer = roles.some(r => String(r) === JOB_ROLES.BUDGET_REVIEWER);
  const isBudgetPlanningAnalyst = roles.some(r => String(r) === JOB_ROLES.BUDGET_PLANNING_ANALYST);
  const isBRDLevel = isBRDLevelUser(currentUser);

  const displayRole = useMemo(() => {
    if (!roles.length) {
      if (isSuperAdmin(currentUser)) return 'Admin';
      return 'User';
    }
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

  useEffect(() => {
    let isMounted = true;
    const fetchHasFinalized = async () => {
      try {
        const settingsRes = await api.get('/settings/active');
        const fiscalYear = settingsRes?.data?.fiscalYear;
        const params = fiscalYear ? { fiscalYear } : {};
        const res = await api.get('/allproposal/proposals/has-finalized', { params });
        if (isMounted && res?.data?.success) {
          setHasFinalizedProposals(!!res.data.hasFinalized);
        }
      } catch (err) {
        logger.error('Failed to check finalized proposals', err);
        if (isMounted) setHasFinalizedProposals(false);
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
          (hasPermission(currentUser, 'CreateProposals') ||
            hasPermission(currentUser, 'EditOwnProposals')) &&
          !isOverallApprover &&
          !isBudgetOfficer &&
          !isApprover &&
          !isReviewer &&
          !isBudgetPlanningAnalyst;

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minHeight: 70, // Matches standard app bar height
          px: collapsed ? 0 : 2.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: '#041C0F',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.7)',
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
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
                width: 28,
                height: 28,
                color: '#69d892',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              {displayRole.charAt(0)}
            </Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 700,
                    fontSize: '0.6rem',
                    textTransform: 'uppercase',
                    display: 'block',
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
            isAllow
            collapsed={collapsed}
          />

          <LinkTo
            icon={<LuFileText size={18} />}
            name="Proposal Management"
            isAllow
            collapsed={collapsed}
            subLinks={[
              {
                link: '/proposal',
                name: 'Create Proposal',
                isAllow: canAccessCreateProposal,
                icon: <LuFilePlus size={18} />,
              },
              {
                link: '/allproposal',
                name: 'All Proposals',
                isAllow: true,
                icon: <LuFileText size={18} />,
              },
              {
                link: '/brd-consolidation',
                name: 'BRD Consolidation',
                isAllow: canSeeBRDOnlyMenus,
                icon: <LuDatabase size={18} />,
              },
              {
                link: '/nep-ceiling',
                name: 'NEP Ceiling',
                isAllow: canSeeBRDOnlyMenus && hasFinalizedProposals,
                icon: <LuLayoutDashboard size={18} />,
              },
              {
                link: '/tier',
                name: 'Tier',
                isAllow: canSeeBRDOnlyMenus,
                icon: <LuLayers size={18} />,
              },
            ]}
          />

          <LinkTo
            icon={<LuLayoutDashboard size={18} />}
            name="Reports & Analytics"
            isAllow={canSeeBRDOnlyMenus}
            collapsed={collapsed}
            subLinks={[
              {
                link: '/consolidated-corporate-income',
                name: 'Consolidated Corporate Income',
                isAllow: true,
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/consolidated-reports',
                name: 'Consolidated MOOE',
                isAllow: true,
                icon: <LuFileText size={18} />,
              },
              {
                link: '/consolidated-capital-outlay-reports',
                name: 'Consolidated Capital Outlay Reports',
                isAllow: true,
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/consolidated-personnel-services-reports',
                name: 'Consolidated Personnel Services Reports',
                isAllow: true,
                icon: <LuUsers size={18} />,
              },
              {
                link: '/comparative-report',
                name: 'Comparative Budget Report',
                isAllow: true,
                icon: <LuLayoutDashboard size={18} />,
              },
              {
                link: '/comprehensive-reports',
                name: 'Budget Summary Report',
                isAllow: true,
                icon: <LuLayoutDashboard size={18} />,
              },
            ]}
          />

          <LinkTo
            icon={<LuUsers size={18} />}
            name="Employees"
            link="/employee"
            isAllow={!isReviewer}
            collapsed={collapsed}
          />
          <LinkTo
            icon={<LuBriefcase size={18} />}
            name="Benefits"
            link="/employeeBenefits"
            isAllow={true}
            collapsed={collapsed}
          />

          <LinkTo
            icon={<LuSettings size={18} />}
            name="Settings"
            isAllow={isSuperAdmin(currentUser) || isBudgetAdmin}
            collapsed={collapsed}
            subLinks={[
              {
                link: '/fysettings',
                name: 'Set Cut-Off',
                isAllow: true,
                icon: <LuSettings size={18} />,
              },
              {
                link: '/compensation-management',
                name: 'Compensation Management Settings',
                isAllow: true,
                icon: <LuSettings size={18} />,
              },
              { link: '/rata', name: 'RATA', isAllow: true, icon: <LuSettings size={18} /> },
              {
                link: '/categories',
                name: 'Capital Outlay',
                isAllow: true,
                icon: <LuSettings size={18} />,
              },
              {
                link: '/income-management',
                name: 'Income Management',
                isAllow: true,
                icon: <LuLayoutDashboard size={18} />,
              },
              {
                link: '/salary-table',
                name: 'Permanent & Casual Salary Table',
                isAllow: true,
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/cos-salary-table',
                name: 'COS Salary Table (SSL4)',
                isAllow: true,
                icon: <LuBanknote size={18} />,
              },
              {
                link: '/setup/organization',
                name: 'Organization Structure Setup',
                isAllow: true,
                icon: <LuSettings size={18} />,
              },
              {
                link: '/hierarchical-user-assignments',
                name: 'Hierarchical User Assignments',
                isAllow: true,
                icon: <LuSettings size={18} />,
              },
              {
                link: '/user-activity-logs',
                name: 'User Activity Logs',
                isAllow: isSuperAdmin(currentUser),
                icon: <LuHistory size={18} />,
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
