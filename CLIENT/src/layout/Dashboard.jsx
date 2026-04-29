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
  const { open, toggleDrawer, collapsed, toggleCollapsed } = useDrawer();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
          width: { md: `calc(100% - ${collapsed ? collapsedDrawerWidth : drawerWidth}px)` },
          ml: { md: `${collapsed ? collapsedDrawerWidth : drawerWidth}px` },
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
            
            {/* Modern Search Bar */}
            <Box ref={searchRef} sx={{ position: "relative", ml: isMobile ? 0 : 2, display: { xs: "none", sm: "block" } }}>
              <Box sx={{
                display: "flex", alignItems: "center", bgcolor: "white",
                border: "1px solid", borderColor: "rgba(0,0,0,0.08)", borderRadius: 2, px: 2, py: 0.75, width: 350,
                transition: "all 0.2s ease",
                "&:focus-within": { borderColor: "#4ade80", boxShadow: "0 0 0 3px rgba(74, 222, 128, 0.1)" }
              }}>
                <FaSearch size={14} color="#64748b" />
                <InputBase
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  sx={{ ml: 1.5, flex: 1, fontSize: "0.875rem" }}
                />
              </Box>
              {isSearchOpen && filteredResults.length > 0 && (
                <Paper elevation={12} sx={{ position: "absolute", top: "115%", width: "100%", borderRadius: 2, zIndex: 1000, overflow: "hidden", border: "1px solid rgba(0,0,0,0.05)" }}>
                  <List disablePadding>
                    {filteredResults.map((r, i) => (
                      <ListItemButton key={i} onClick={() => { nav(r.path); setIsSearchOpen(false); }} sx={{ py: 1.5 }}>
                        <ListItemText primary={r.title} secondary={r.category} primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }} secondaryTypographyProps={{ fontSize: "0.75rem" }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
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
          width: collapsed && !isMobile ? collapsedDrawerWidth : drawerWidth,
          flexShrink: 0,
          zIndex: 1300, // Explicitly above AppBar (1100)
          "& .MuiDrawer-paper": {
            width: collapsed && !isMobile ? collapsedDrawerWidth : drawerWidth,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowX: "hidden",
            background: "#061a11", // Dark forest green
            borderRight: "none",
            boxShadow: "10px 0 30px rgba(0,0,0,0.1)",
          },
        }}
      >
        <CustomDrawer />
      </Drawer>

      {/* Floating Toggle Button */}
      {!isMobile && (
        <Tooltip title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"} placement="right">
          <IconButton
            onClick={toggleCollapsed}
            sx={{
              position: "fixed",
              left: (collapsed ? collapsedDrawerWidth : drawerWidth) - 14,
              top: 28, // Move up slightly
              zIndex: 1500, // Even higher z-index to stay on top
              bgcolor: "#1a3b2a",
              color: "#4ade80", // Greenish icon
              width: 28,
              height: 28,
              border: "2px solid #061a11",
              "&:hover": { bgcolor: "#4ade80", color: "#061a11" },
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {collapsed ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
          </IconButton>
        </Tooltip>
      )}

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
        
        <Box sx={{ flex: 1, p: { xs: 2, md: 4 } }}>
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