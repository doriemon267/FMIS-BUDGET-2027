import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Divider,
  Tooltip,
  Menu,
  MenuItem,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { FaCaretLeft, FaSearch, FaClock, FaTimes, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { GiHamburgerMenu } from "react-icons/gi";
import { DateRange as DateRangeIcon } from "@mui/icons-material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ErrorBoundary } from 'react-error-boundary';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Project Imports
import env from "../utils/env";
import api from "../config/api";
import CustomDrawer from "./CustomDrawer";
import UserAvatarMenu from "../global/components/UserAvatarMenu";
import WorkflowNotifications from "../components/workflow/WorkflowNotifications";
import { WorkflowNotificationProvider } from "../context/WorkflowNotificationContext";
import ActiveRegionDisplay from "../components/common/ActiveRegionDisplay";
import AppTrayLauncher from "../global/components/floating_apps/AppTrayLauncher";
import { DrawerProvider, useDrawer } from "../context/DrawerContext";
import ThemeSync from "../components/common/ThemeSync";
import OfflineBanner from "../components/common/OfflineBanner";
import logger from "../utils/logger";
import { useRoutePermissions } from "../context/RoutePermissionContext";
import { useUser } from "../context/UserContext";

const drawerWidth = 260;
const collapsedDrawerWidth = 70;

const blink = keyframes`
  0%, 50% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
`;

// Route → friendly page title map
export const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/proposal': 'Create Proposal',
  '/allproposal': 'All Proposals',
  '/brd-consolidation': 'BRD Consolidation',
  '/nep-ceiling': 'NEP Ceiling',
  '/tier': 'Tier Management',
  '/tier-comparison': 'Tier Comparison',
  '/employee': 'Employee List',
  '/employeeBenefits': 'Employee Benefits',
  '/courtAppearance': 'Court Appearance',
  '/overTime': 'Overtime Pay',
  '/subsistenceAllowanceMDS': 'Subsistence Allowance (MDS)',
  '/subsistenceAllowanceST': 'Subsistence Allowance (ST)',
  '/subsistenceAllowance': 'Subsistence Allowance',
  '/loyaltyPay': 'Loyalty Pay',
  '/mealallowance': 'Meal Allowance',
  '/medicalAllowance': 'Medical Allowance',
  '/childrenAllowance': 'Children Allowance',
  '/retirees': 'Retirees',
  '/fysettings': 'Set Cut-Off',
  '/compensation-management': 'Compensation Management',
  '/rata': 'RATA Settings',
  '/categories': 'Capital Outlay',
  '/income-management': 'Income Management',
  '/salary-table': 'Perm & Casual Salary Table',
  '/cos-salary-table': 'COS Salary Table (SSL4)',
  '/employee-salary-table': 'Employee Salary Table',
  '/salary-management': 'Salary Management',
  '/setup/organization': 'Organization Structure',
  '/hierarchical-user-assignments': 'Hierarchical User Assignments',
  '/user-activity-logs': 'User Activity Logs',
  '/bulk-upload-management': 'Bulk Upload Management',
  '/consolidated-corporate-income': 'Corporate Income Report',
  '/consolidated-reports': 'MOOE Report',
  '/consolidated-capital-outlay-reports': 'Capital Outlay Report',
  '/consolidated-personnel-services-reports': 'Personnel Services Report',
  '/comparative-report': 'Comparative Budget Report',
  '/comprehensive-reports': 'Budget Summary Report',
  '/subsidy-monitoring': 'Subsidy Monitoring',
  '/corporate-income-upload': 'Corporate Income Upload',
  '/mooe-upload': 'MOOE Upload',
  '/database-backup': 'Database Backup',
  '/grouped-income-categories': 'Grouped Income Categories',
  '/region-selection': 'Region Selection',
  '/audit-logs': 'Audit Logs',
  '/route-permissions': 'Route Permissions',
  '/settings': 'System Settings',
  '/fiscalYear': 'Fiscal Year',
  '/not-authorized': 'Not Authorized',
};

const getPageTitle = (pathname) => {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Dynamic segments (e.g. /proposal-details/:id)
  if (pathname.startsWith('/proposal-details/')) return 'Proposal Details';
  return 'FMIS-OSBPIS';
};

// Mapped search routes from based code
const searchableRoutes = [
  { title: "Dashboard", path: "/dashboard", category: "Main" },
  { title: "All Proposals", path: "/allproposal", category: "Budget" },
  { title: "Create Proposal", path: "/proposal", category: "Budget" },
  { title: "Employee List", path: "/employee", category: "Records" },
  { title: "BRD Consolidation", path: "/brd-consolidation", category: "Reports" },
];

const DashboardContent = () => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const nav = useNavigate();
  const theme = useTheme();
  const { open, setOpen, toggleDrawer, collapsed, toggleCollapsed, setCollapsed } = useDrawer();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("sm"));
  const wasMobileRef = useRef(isMobile);

  // Maintenance mode awareness for Super Admin banner
  const { isMaintenanceMode } = useRoutePermissions();
  const { currentUser } = useUser();
  const normalizedRoles = (currentUser?.Roles || []).map((r) => String(r || '').replace(/\s+/g, '_').toUpperCase());
  const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN') || normalizedRoles.includes('SUPERADMIN');
  const showMaintenanceBanner = isMaintenanceMode && isSuperAdmin;

  useEffect(() => {
    // When returning to full desktop, normalize drawer into expanded state.
    if (wasMobileRef.current && !isMobile) {
      setCollapsed(false);
      setOpen(true);
    }
    wasMobileRef.current = isMobile;
  }, [isMobile, setCollapsed, setOpen]);
  
  // Calculate responsive drawer width
  const getDrawerWidth = () => {
    if (collapsed && !isMobile) {
      return isTablet ? 60 : 70;
    }
    return isTablet ? 240 : drawerWidth;
  };
  
  const currentDrawerWidth = getDrawerWidth();

  // --- Logic States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [anchorFiscalEl, setAnchorFiscalEl] = useState(null);

  // --- Original Logic: Fiscal Settings ---
  const { data: activeSettings, isLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
  });

  const activeFiscalYear = activeSettings?.fiscalYear ?? null;
  const dueDateRaw = activeSettings?.dueDate ?? null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw).toLocaleDateString() : null;

  const [blinkActive, setBlinkActive] = useState(false);
  useEffect(() => {
    if (!dueDateRaw) return;
    const check = () => {
      const now = new Date();
      const due = new Date(dueDateRaw);
      const oneDayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
      setBlinkActive(now >= oneDayBefore && now <= due);
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [dueDateRaw]);

  // --- Based Code: Search Logic ---
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchableRoutes.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setIsSearchOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "#ffffff" }}>
      <ThemeSync />
      <OfflineBanner />
      <CssBaseline />
      
      <AppBar
        position="fixed"
        sx={{
          zIndex: 1100, // Explicitly below Drawer (1200)
          bgcolor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          color: "text.primary",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          borderBottom: "1px solid",
          borderColor: "rgba(0,0,0,0.05)",
          width: isMobile ? "100%" : `calc(100% - ${currentDrawerWidth}px)`,
          ml: isMobile ? 0 : `${currentDrawerWidth}px`,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <Toolbar sx={{ gap: 1.5, justifyContent: "space-between", minHeight: 64 }}>
          <Box display="flex" alignItems="center" gap={1}>
            {isMobile && (
              <IconButton
                color="inherit"
                onClick={toggleDrawer}
                sx={{ color: "text.secondary", ml: -1 }}
              >
                {open ? <FaTimes /> : <GiHamburgerMenu />}
              </IconButton>
            )}
            
            {/* Dynamic Page Title Breadcrumb */}
            <Box
              key={location.pathname}
              sx={{
                ml: isMobile ? 0 : 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
                animation: `${fadeSlideIn} 0.25s ease`,
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  width: 5,
                  height: 20,
                  borderRadius: 1,
                  background: "linear-gradient(180deg, #386641, #69d892)",
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="h6"
                fontWeight="800"
                noWrap
                sx={{
                  color: theme.palette.text.primary,
                  letterSpacing: -0.3,
                  fontSize: { xs: "0.85rem", sm: "1rem", md: "1.1rem" },
                }}
              >
                {pageTitle}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={{ xs: 0.5, sm: 1 }}>
            {/* Hide region display on mobile to save space */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <ActiveRegionDisplay variant="compact" showButton={false} />
            </Box>
            
            {/* Fiscal year icon — hidden on small phones */}
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Tooltip title="Fiscal info">
                <IconButton 
                  onClick={(e) => setAnchorFiscalEl(e.currentTarget)}
                  sx={{ color: blinkActive ? "error.main" : "text.secondary", animation: blinkActive ? `${blink} 1s infinite` : "none" }}
                >
                  <DateRangeIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <WorkflowNotificationProvider>
              <WorkflowNotifications />
            </WorkflowNotificationProvider>

            <Box sx={{ ml: { xs: 0, sm: 1 }, borderLeft: { xs: "none", sm: "1px solid" }, borderColor: "divider", pl: { xs: 0, sm: 2 } }}>
              <UserAvatarMenu />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={open}
        onClose={toggleDrawer}
        sx={{
          width: currentDrawerWidth,
          flexShrink: 0,
          zIndex: 1300,
          "& .MuiDrawer-paper": {
            width: currentDrawerWidth,
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowX: "hidden",
            background: "#061a11",
            borderRight: "none",
            boxShadow: "10px 0 30px rgba(0,0,0,0.1)",
          },
        }}
      >
        <CustomDrawer />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          minWidth: 0, // Prevent flex overflow
          bgcolor: "#ffffff",
          overflowY: "auto",
          pt: "64px", // Matches Toolbar minHeight
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <ToastContainer position="top-right" />
        
        {/* Maintenance mode warning banner (visible to Super Admin only when maintenance is ON) */}
        {showMaintenanceBanner && (
          <Box
            sx={{
              mx: { xs: 1.5, sm: 2, md: 3 },
              mt: { xs: 1, md: 1.5 },
              p: 1.5,
              borderRadius: 2,
              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
              border: "1px solid #fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2" sx={{ color: "#92400e", fontWeight: 600 }}>
              ⚠️ <strong>MAINTENANCE MODE IS ACTIVE</strong> — All non-Super Admin users are currently locked out.
            </Typography>
            <Box
              component="button"
              onClick={() => nav("/route-permissions")}
              sx={{
                background: "#d97706",
                color: "#fff",
                border: "none",
                borderRadius: 1.5,
                px: 2,
                py: 0.75,
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                "&:hover": { background: "#b45309" },
              }}
            >
              Manage Maintenance
            </Box>
          </Box>
        )}
        <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 }, pt: { xs: 2, md: 3 } }}>
          <ErrorBoundary FallbackComponent={({ error }) => <Typography color="error">Error: {error.message}</Typography>}>
            <AppTrayLauncher />
          </ErrorBoundary>
          <Outlet />
        </Box>

        <Box sx={{ py: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" align="center" color="text.secondary">
            &copy; {new Date().getFullYear()} NIA – {env("APP_TITLE")}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default () => (
  <DrawerProvider>
    <DashboardContent />
  </DrawerProvider>
);