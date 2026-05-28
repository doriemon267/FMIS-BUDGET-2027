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
import { Outlet, useNavigate } from "react-router-dom";
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

const drawerWidth = 260;
const collapsedDrawerWidth = 70;

const blink = keyframes`
  0%, 50% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

// Mapped search routes from based code
const searchableRoutes = [
  { title: "Dashboard", path: "/dashboard", category: "Main" },
  { title: "All Proposals", path: "/allproposal", category: "Budget" },
  { title: "Create Proposal", path: "/proposal", category: "Budget" },
  { title: "Employee List", path: "/employee", category: "Records" },
  { title: "BRD Consolidation", path: "/brd-consolidation", category: "Reports" },
];

const DashboardContent = () => {
  const nav = useNavigate();
  const theme = useTheme();
  const { open, setOpen, toggleDrawer, collapsed, toggleCollapsed, setCollapsed } = useDrawer();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isTablet = useMediaQuery(theme.breakpoints.down("sm"));
  const wasMobileRef = useRef(isMobile);

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
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "#f1f5f9" }}>
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
            
            {/* Application Title */}
            <Box sx={{ ml: isMobile ? 0 : 2, display: { xs: "none", sm: "block" } }}>
              <Typography variant="h6" fontWeight="800" sx={{ color: theme.palette.text.primary, letterSpacing: -0.5 }}>
                {env("APP_FULL_TITLE") || "Online Submission of Budget Proposal Information System"}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <ActiveRegionDisplay variant="compact" showButton={false} />
            
            <Tooltip title="Fiscal info">
              <IconButton 
                onClick={(e) => setAnchorFiscalEl(e.currentTarget)}
                sx={{ color: blinkActive ? "error.main" : "text.secondary", animation: blinkActive ? `${blink} 1s infinite` : "none" }}
              >
                <DateRangeIcon />
              </IconButton>
            </Tooltip>

            <WorkflowNotificationProvider>
              <WorkflowNotifications />
            </WorkflowNotificationProvider>

            <Box sx={{ ml: 1, borderLeft: "1px solid", borderColor: "divider", pl: 2 }}>
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
          bgcolor: "#f8fafc",
          overflowY: "auto",
          pt: "64px", // Matches Toolbar minHeight
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <ToastContainer position="top-right" />
        
        <Box sx={{ flex: 1, p: { xs: 2, md: 2 }, pt: { xs: 2, md: 2 } }}>
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