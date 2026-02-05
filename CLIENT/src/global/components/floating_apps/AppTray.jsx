// src/components/AppTray.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { IconButton, Box, Tooltip, Fade, Stack, Paper, Badge } from "@mui/material";
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { FiGrid, FiClock, FiBell, FiTrendingUp, FiZap, FiSearch, FiCalendar, FiShield, FiBarChart2, FiEdit } from "react-icons/fi";
import { BsChatDots } from 'react-icons/bs';
import { BiCalculator } from "react-icons/bi";
import { MdOutlineChecklist, MdCalendarMonth } from "react-icons/md";
import { MdClose, MdRemove } from "react-icons/md";

const AppTray = ({ onAppOpen, openAppIds = [], activeAppId = null, onCloseAll, onMinimizeAll, chatPinned = true }) => {
  const [openTray, setOpenTray] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [chatSettings, setChatSettings] = useState({});
  const nodeRef = useRef(null);
  const trayHandleRef = useRef(null);
  const focusRefs = useRef([]);

  // Each app now has its own color
  // Base app registry (full set). Use local/user settings to hide items.
  const apps = useMemo(() => [
    { Icon: BiCalculator, label: "Calculator", id: "calc", color: "#1976d2", shortcut: 'Alt+C' },
    {
      Icon: MdOutlineChecklist,
      label: "Todo List",
      id: "todo",
      color: "#43a047",
      shortcut: 'Alt+T'
    },
    { Icon: FiClock, label: "Clock", id: "clock", color: "#f57c00", shortcut: 'Alt+K' },
    {
      Icon: MdCalendarMonth,
      label: "Calendar",
      id: "calendar",
      color: "#6d4c41",
      shortcut: 'Alt+A'
    },
    {
      Icon: BsChatDots,
      label: "Messages",
      id: "chat",
      color: "#00b0ff",
      shortcut: 'Alt+M'
    },
    { Icon: FiBell, label: "Notifications", id: "notifications", color: "#e91e63", shortcut: 'Alt+N' },
    { Icon: FiTrendingUp, label: "Budget Overview", id: "budget", color: "#0066cc", shortcut: 'Alt+B' },
    { Icon: FiZap, label: "Quick Actions", id: "actions", color: "#43a047", shortcut: 'Alt+Q' },
    { Icon: FiSearch, label: "Search", id: "search", color: "#9c27b0", shortcut: 'Ctrl+K' },
    { Icon: FiCalendar, label: "Timeline", id: "timeline", color: "#f57c00", shortcut: 'Alt+L' },
    { Icon: FiShield, label: "Audit Trail", id: "audit", color: "#d32f2f", shortcut: 'Alt+U' },
    { Icon: FiBarChart2, label: "Performance", id: "metrics", color: "#009688", shortcut: 'Alt+P' },
    { Icon: FiEdit, label: "Notes", id: "notes", color: "#fbc02d", shortcut: 'Alt+O' },
  ], []);

  // Compute visible apps — prefer explicit allowed list, fallback to disabled list
  const visibleApps = useMemo(() => {
    try {
      // Highest priority: allowed list (exactly what to show)
      const allowedRaw = localStorage.getItem('appTrayAllowed');
      const allowed = Array.isArray(JSON.parse(allowedRaw || '[]')) ? JSON.parse(allowedRaw || '[]') : [];
      if (allowed && allowed.length > 0) {
        return apps.filter(a => allowed.includes(a.id));
      }
      // Fallback: disabled list (what to hide)
      const disabledRaw = localStorage.getItem('appTrayDisabled');
      const disabled = Array.isArray(JSON.parse(disabledRaw || '[]')) ? JSON.parse(disabledRaw || '[]') : [];
      if (disabled && disabled.length > 0) {
        return apps.filter(a => !disabled.includes(a.id));
      }
      // Default: show apps (chat hidden for now - add 'chat' for future use)
      const defaultFive = ['calc','todo','clock','calendar'];
      return apps.filter(a => defaultFive.includes(a.id));
    } catch (e) {
      const fallbackFive = ['calc','todo','clock','calendar'];
      return apps.filter(a => fallbackFive.includes(a.id));
    }
  }, [apps]);

  // Close tray when clicking outside or pressing Escape
  useEffect(() => {
    if (!openTray) return undefined;
    function handleClickOutside(e) {
      if (nodeRef.current && !nodeRef.current.contains(e.target)) {
        setOpenTray(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenTray(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openTray, apps]);

  useEffect(() => {
    const handler = (e) => {
      try {
        const c = e?.detail?.count || 0;
        // Check persisted setting
        const chatSettings = JSON.parse(localStorage.getItem('chatSettings') || '{}');
        if (chatSettings && chatSettings.badge === false) {
          setChatUnreadCount(0);
          return;
        }
        setChatUnreadCount(Number(c));
      } catch (ex) {}
    };
    const notificationHandler = (e) => {
      try {
        const stored = JSON.parse(localStorage.getItem('notificationsCenter') || '[]');
        const unread = stored.filter(n => !n.read).length;
        setNotificationCount(unread);
      } catch (ex) {}
    };
    window.addEventListener('chat-unread', handler);
    window.addEventListener('system-notification', notificationHandler);
    const storageHandler = (e) => {
      if (e.key === 'chatSettings') {
        try {
          const s = JSON.parse(e.newValue || '{}');
          if (s && s.badge === false) setChatUnreadCount(0);
        } catch (err) {}
      }
      if (e.key === 'notificationsCenter') {
        notificationHandler();
      }
    };
    window.addEventListener('storage', storageHandler);
    // init local chatSettings for this AppTray and listen for local updates
    try {
      const s0 = JSON.parse(localStorage.getItem('chatSettings') || '{}'); setChatSettings(s0 || {});
    } catch (e) { setChatSettings({}); }
    const localSettings = () => { try { const s = JSON.parse(localStorage.getItem('chatSettings') || '{}'); setChatSettings(s || {}); } catch(e) { setChatSettings({}); } };
    window.addEventListener('chat-settings-changed', (e) => { try { const s = e?.detail || JSON.parse(localStorage.getItem('chatSettings') || '{}'); setChatSettings(s || {}); } catch(e) { setChatSettings({}); } });
    // Initial notification count
    notificationHandler();
    return () => { window.removeEventListener('chat-unread', handler); window.removeEventListener('storage', storageHandler); window.removeEventListener('system-notification', notificationHandler); };
    // Load persisted chat badge setting to manage initial unread
    try {
      const s = JSON.parse(localStorage.getItem('chatSettings') || '{}');
      if (s && s.badge === false) setChatUnreadCount(0);
    } catch (e) {}
  }, []);

  // When tray opens, focus on the first visual app (top of stack).
  useEffect(() => {
    if (!openTray) return undefined;
    const firstIndex = apps.length - 1; // since column-reverse, last item is visually first
    const id = setTimeout(() => {
      focusRefs.current[firstIndex]?.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [openTray, apps]);

  const handleTrayKeyDown = useCallback((e) => {
    const refs = focusRefs.current;
    const len = refs.length || 0;
    if (len === 0) return;
    const activeLogicalIndex = refs.findIndex((r) => r === document.activeElement);
    // Convert logical index to visual index (since we use column-reverse)
    const toVisual = (logical) => (len - 1 - logical);
    const toLogical = (visual) => (len - 1 - visual);
    const activeVisualIndex = activeLogicalIndex === -1 ? -1 : toVisual(activeLogicalIndex);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextVisual = activeVisualIndex === -1 ? 0 : (activeVisualIndex + 1) % len;
      const nextLogical = toLogical(nextVisual);
      refs[nextLogical]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevVisual = activeVisualIndex <= 0 ? len - 1 : activeVisualIndex - 1;
      const prevLogical = toLogical(prevVisual);
      refs[prevLogical]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      refs[toLogical(0)]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      refs[toLogical(len - 1)]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      document.activeElement?.click();
      setOpenTray(false);
    } else if (e.key === "Escape") {
      setOpenTray(false);
      trayHandleRef.current?.focus();
    }
  }, []);

  return (
    <Box
      ref={nodeRef}
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1300,
      }}
    >
      {/* Main tray button */}
        <Tooltip title="App Tray" placement="left">
          <IconButton
            className="tray-handle"
          size="large"
            ref={trayHandleRef}
          sx={{
            bgcolor: "primary.main",
            color: "white",
            boxShadow: 6,
            width: 56,
            height: 56,
            "&:hover": { bgcolor: "primary.dark", transform: "scale(1.05)" },
            transition: "all 0.2s",
          }}
          onClick={() => setOpenTray((s) => !s)}
          aria-expanded={openTray}
          aria-label="Open app tray"
        >
          <FiGrid size={20} />
        </IconButton>
      </Tooltip>

      {/* openTray app tray */}
      <Fade in={openTray} timeout={400}>
        <Paper
          elevation={6}
          sx={{
            position: "absolute",
            bottom: 70,
            right: 0,
            p: 1.2,
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid",
            borderColor: "divider",
          }}
          onKeyDown={handleTrayKeyDown}
          role="menu"
          aria-label="App tray menu"
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mb: 0.5 }}>
            <Tooltip title="Minimize all" placement="top">
              <IconButton size='small' onClick={() => { onMinimizeAll?.(); setOpenTray(false); }}>
                <MdRemove />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close all" placement="top">
              <IconButton size='small' onClick={() => { onCloseAll?.(); setOpenTray(false); }}>
                <MdClose />
              </IconButton>
            </Tooltip>
            <Tooltip title={chatSettings && chatSettings.hideSidebar ? 'Show conversations' : 'Hide conversations'} placement="top">
              <IconButton size='small' onClick={() => {
                try {
                  const s = JSON.parse(localStorage.getItem('chatSettings') || '{}');
                  const next = { ...(s || {}), hideSidebar: !s.hideSidebar };
                  localStorage.setItem('chatSettings', JSON.stringify(next));
                  setChatSettings(next);
                  // notify same-window listeners
                  window.dispatchEvent(new CustomEvent('chat-settings-changed', { detail: next }));
                } catch (e) { }
                setOpenTray(false);
              }}>
                {(chatSettings && chatSettings.hideSidebar) ? <FiChevronRight /> : <FiChevronLeft />}
              </IconButton>
            </Tooltip>
          </Box>
          <Stack direction="column-reverse" spacing={1}>
                {visibleApps.map(({ Icon, label, id, color, shortcut }, idx) => {
              const isOpen = openAppIds.includes(id);
              const isActive = activeAppId === id;
              const refIndex = idx; // logical order
              return (
                <Tooltip key={id} title={shortcut ? `${label} — ${shortcut}` : label} placement="left">
                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Badge
                  overlap="circular"
                  color="primary"
                  variant='standard'
                  badgeContent={(id === 'chat' && chatUnreadCount > 0) ? chatUnreadCount : (id === 'notifications' && notificationCount > 0) ? notificationCount : undefined}
                  invisible={(id !== 'chat' && id !== 'notifications') ? !isOpen : false}
                >
                <IconButton
                  role="menuitem"
                  size="medium"
                  onClick={() => {
                    console.debug('[AppTray] clicking app icon', id);
                    // Close tray after selecting — AppLauncher handles open/close toggle
                    setOpenTray(false);
                    onAppOpen(id);
                    setTimeout(() => trayHandleRef.current?.focus(), 50);
                  }}
                  ref={(el) => (focusRefs.current[refIndex] = el)}
                  aria-keyshortcuts={shortcut}
                  tabIndex={-1}
                  sx={{
                    bgcolor: color,
                    color: "white",
                    width: 48,
                    height: 48,
                    boxShadow: 4,
                    "&:hover": {
                      bgcolor: color,
                      opacity: 0.9,
                      transform: "translateY(-2px)",
                      boxShadow: 6,
                    },
                    transition: "all 0.2s ease",
                    ...(isOpen
                      ? {
                          border: "2px solid",
                          borderColor: "primary.main",
                          boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
                          transform: "scale(1.03)",
                        }
                      : {}),
                    ...(isActive
                      ? {
                          outline: `2px solid rgba(25,118,210,0.2)`,
                          boxShadow: "0 8px 36px rgba(25,118,210,0.25)",
                          transform: "scale(1.06)",
                        }
                      : {}),
                  }}
                  aria-pressed={isOpen}
                >
                  <Icon size={20} />
                </IconButton>
                </Badge>
                {id === 'chat' && chatPinned && (
                  <Box sx={{ position: 'absolute', top: -6, right: -6, zIndex: 10 }}>
                    <Box sx={{ width: 10, height: 10, bgcolor: '#ffd700', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                  </Box>
                )}
                </Box>
              </Tooltip>
              );
            })}
          </Stack>
        </Paper>
      </Fade>
    </Box>
  );
};

export default AppTray;
