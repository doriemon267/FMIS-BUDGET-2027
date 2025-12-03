import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  Badge,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { keyframes } from "@mui/system";
import React, { useContext, useEffect, useState } from "react";
import { FaCaretLeft } from "react-icons/fa6";
import { GiHamburgerMenu } from "react-icons/gi";
import { GrNotification } from "react-icons/gr";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import UserAvatarMenu from "../global/components/UserAvatarMenu";
import env from "../utils/env";
import CustomDrawer from "./CustomDrawer";
import api from "../config/api";
import { DateRange as DateRangeIcon, Notifications as NotificationsIcon } from "@mui/icons-material";
import { WorkflowNotificationProvider } from "../context/WorkflowNotificationContext";
import WorkflowNotifications from "../components/workflow/WorkflowNotifications";
import ActiveRegionDisplay from "../components/common/ActiveRegionDisplay";
import { useRegion } from "../context/RegionContext";
import AppTrayLauncher from "../global/components/floating_apps/AppTrayLauncher";
import { ErrorBoundary } from 'react-error-boundary';

const drawerWidth = 280;
const collapsedDrawerWidth = 80;

// blink keyframes
const blink = keyframes`
  0%, 50% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const DashboardContent = () => {
  const nav = useNavigate();
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const isMdScreen = useMediaQuery((theme) => theme.breakpoints.down("lg"));
  const toggleDrawer = () => setOpen(!open);
  const toggleCollapsed = () => setCollapsed(!collapsed);

  // fetch active settings
  const { data: activeSettings, isLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
  });

  // extract fiscalYear & dueDate
  const activeFiscalYear = activeSettings?.fiscalYear ?? null;
  const dueDateRaw = activeSettings?.dueDate ?? null;
  const dueDate = dueDateRaw
    ? new Date(dueDateRaw).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // determine if we should blink: 1 day before up to due date
  const [blinkActive, setBlinkActive] = useState(false);
  // Remove NotificationsContext usage, keep blink logic for calendar icon
  useEffect(() => {
    if (!dueDateRaw) return;
    const check = () => {
      const now = new Date();
      const due = new Date(dueDateRaw);
      const oneDayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
      setBlinkActive(now >= oneDayBefore && now <= due);
    };
    check();
    const iv = setInterval(check, 60 * 1000);
    return () => clearInterval(iv);
  }, [dueDateRaw]);

  // Calendar icon click (no alert)
  const handleFiscalInfoClick = () => {
    // Optionally show a dialog or toast here if needed
  };

  // Remove old notification logic, will use WorkflowNotifications instead
  
  // Get active region
  const { activeRegion } = useRegion();

  // fiscal-year menu
  const [anchorFiscalEl, setAnchorFiscalEl] = useState(null);
  const openFiscal = Boolean(anchorFiscalEl);
  const handleFiscalClick = (e) => setAnchorFiscalEl(e.currentTarget);
  const handleFiscalClose = () => setAnchorFiscalEl(null);

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: "primary.main",
          boxShadow: 0,
          borderBottom: 1,
          borderColor: "secondary.main",
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
            onClick={isMdScreen ? toggleDrawer : toggleCollapsed}
            edge="start"
            sx={{ mr: { xs: 0, md: 2 } }}
          >
            {isMdScreen ? (
              open ? <FaCaretLeft /> : <GiHamburgerMenu />
            ) : (
              collapsed ? <GiHamburgerMenu /> : <FaCaretLeft />
            )}
          </IconButton>
          <img
            src="/2020-nia-logo.svg"
            alt="Logo"
            style={{ height: 40, marginRight: 10, cursor: "pointer" }}
            onClick={() => nav("/")}
          />
          <Typography variant="h6" noWrap flexGrow={1}>
            {env("APP_TITLE")}
          </Typography>

          {/* Active Region Display */}
          <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
            <ActiveRegionDisplay variant="compact" showButton={false} />
          </Box>
          
          {/* Calendar icon: white by default, blinking red when within 1 day of due date */}
          <IconButton
            onClick={handleFiscalInfoClick}
            aria-label="Active Fiscal Year"
            sx={{
              mr: 2,
              color: blinkActive ? "error.main" : "inherit",
              ...(blinkActive && {
                animation: `${blink} 1s infinite`,
              }),
            }}
          >
            <DateRangeIcon />
          </IconButton>
          <Menu
            anchorEl={anchorFiscalEl}
            open={openFiscal}
            onClose={handleFiscalClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={handleFiscalClose}>
              <ListItemText
                primary={
                  isLoading
                    ? "Loading Fiscal Year..."
                    : activeFiscalYear
                    ? `Active Fiscal Year: ${activeFiscalYear}`
                    : "No Active Fiscal Year"
                }
              />
            </MenuItem>
            <MenuItem onClick={handleFiscalClose}>
              <ListItemText
                primary={
                  isLoading
                    ? ""
                    : dueDate
                    ? `Due Date: ${dueDate}`
                    : "No Due Date"
                }
              />
            </MenuItem>
          </Menu>


          {/* Notifications Bell - ProposalNotifications Style */}
          {/* New Notification Bell - WorkflowNotifications */}
          <WorkflowNotificationProvider>
            <WorkflowNotifications />
          </WorkflowNotificationProvider>

          <UserAvatarMenu />
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: collapsed && !isMdScreen ? collapsedDrawerWidth : drawerWidth,
            boxSizing: "border-box",
            background:
              "linear-gradient(169deg, rgba(55,94,56,1) 10%, rgba(0,0,0,0.9) 100%)",
            transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflowX: "hidden",
            boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
          },
        }}
        variant={isMdScreen ? "temporary" : "persistent"}
        anchor="left"
        open={open}
        onClose={toggleDrawer}
      >
        <CustomDrawer collapsed={collapsed && !isMdScreen} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          transition: "margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          marginLeft: open && !isMdScreen
            ? collapsed
              ? `${collapsedDrawerWidth}px`
              : `${drawerWidth}px`
            : 0,
          minHeight: "calc(100vh - 64px)",
          overflowX: "hidden",
        }}
      >
        <Toolbar />
        <Box sx={{ maxWidth: "100%", overflowX: "auto" }}>
          <Outlet />
             <ErrorBoundary
               FallbackComponent={({ error }) => (
                 <div style={{ padding: 12, color: 'red' }}>
                   <strong>AppTrayLauncher failed to render:</strong>
                   <pre style={{ whiteSpace: 'pre-wrap' }}>{error?.message}</pre>
                 </div>
               )}
               onError={(error, info) => {
                 // Log stack/message so we can capture details in the terminal as well
                 console.error('[ErrorBoundary] AppTrayLauncher render error', error, info);
               }}
             >
               <AppTrayLauncher />
             </ErrorBoundary>
        </Box>
        <Typography
          variant="body2"
          align="center"
          sx={{ px: 1.5, py: 2, color: "text.secondary" }}
        >
          &copy; {new Date().getFullYear()} NIA – {env("APP_TITLE")}
        </Typography>
      </Box>
    </Box>
  );
};

export default () => (
  <DashboardContent />
);
