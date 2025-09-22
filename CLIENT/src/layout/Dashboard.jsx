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
} from "@mui/material";
import { keyframes } from "@mui/system";
import React, { useContext, useEffect, useState } from "react";
import { FaCaretLeft } from "react-icons/fa6";
import { GiHamburgerMenu } from "react-icons/gi";
import { Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import UserAvatarMenu from "../global/components/UserAvatarMenu";
import env from "../utils/env";
import CustomDrawer from "./CustomDrawer";
import api from "../config/api";
import { DateRange as DateRangeIcon } from "@mui/icons-material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  NotificationsProvider,
  NotificationsContext,
  useNotifications,
} from "../global/components/NotificationsContext";
import ActiveRegionDisplay from "../components/common/ActiveRegionDisplay";
import { useRegion } from "../context/RegionContext";

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
  const { addAlert } = useContext(NotificationsContext);
  useEffect(() => {
    if (!dueDateRaw) return;
    const check = () => {
      const now = new Date();
      const due = new Date(dueDateRaw);
      const oneDayBefore = new Date(due.getTime() - 24 * 60 * 60 * 1000);
      setBlinkActive(now >= oneDayBefore && now <= due);
      
      // We'll let the NotificationsContext handle the alert display
    };
    check();
    const iv = setInterval(check, 60 * 1000);
    return () => clearInterval(iv);
  }, [dueDateRaw]);

  // Add a function to handle calendar icon click
  const handleFiscalInfoClick = () => {
    if (dueDateRaw) {
      const due = new Date(dueDateRaw);
      const now = new Date();
      const timeLeft = due - now;
      
      if (timeLeft > 0) {
        // Calculate days, hours left
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        addAlert({
          message: `Submission deadline: ${dueDate} (${days} days, ${hours} hours remaining)`,
          severity: days < 1 ? 'error' : 'warning',
          autoHideDuration: 10000
        });
      }
    }
  };

  // notifications from server
  const { serverNotifications, markNotificationsAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState(null);
  const openNotifications = Boolean(anchorEl);
  const handleNotificationsClick = (e) => setAnchorEl(e.currentTarget);
  const handleNotificationsClose = () => setAnchorEl(null);
  const unreadCount = serverNotifications.length;
  
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

          {/* Notifications */}
          <IconButton
            color="inherit"
            onClick={handleNotificationsClick}
            aria-label="Notifications"
          >
            <Badge badgeContent={unreadCount} color={unreadCount > 0 ? 'error' : 'default'}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={openNotifications}
            onClose={handleNotificationsClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {unreadCount === 0 ? (
              <MenuItem onClick={handleNotificationsClose}>
                <ListItemText primary="No notifications" />
              </MenuItem>
            ) : (
              serverNotifications.map((n) => (
                <MenuItem
                  key={n._id}
                  onClick={async () => {
                    await markNotificationsAsRead(n._id);
                    handleNotificationsClose();
                  }}
                >
                  <ListItemText
                    primary={n.title || n.message || 'New submission'}
                    secondary={
                      [n?.org?.region, n?.org?.department, n?.org?.division]
                        .filter(Boolean)
                        .join(' • ')
                    }
                  />
                </MenuItem>
              ))
            )}
          </Menu>

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
  <NotificationsProvider>
    <DashboardContent />
  </NotificationsProvider>
);
