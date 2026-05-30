// src/components/AppTray.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { IconButton, Box, Tooltip, Fade, Stack, Paper, Badge, Typography, InputBase, ButtonBase } from "@mui/material";
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
  const [searchQuery, setSearchQuery] = useState("");
  const nodeRef = useRef(null);
  const trayHandleRef = useRef(null);
  const focusRefs = useRef([]);

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
      const ensureChatVisible = (list) => {
        const withChat = Array.isArray(list) ? [...list] : [];
        if (!withChat.includes('chat')) withChat.push('chat');
        return apps.filter(a => withChat.includes(a.id));
      };

      // Highest priority: allowed list (exactly what to show)
      const allowedRaw = localStorage.getItem('appTrayAllowed');
      const allowed = Array.isArray(JSON.parse(allowedRaw || '[]')) ? JSON.parse(allowedRaw || '[]') : [];
      if (allowed && allowed.length > 0) {
        return ensureChatVisible(allowed);
      }
      // Fallback: disabled list (what to hide)
      const disabledRaw = localStorage.getItem('appTrayDisabled');
      const disabled = Array.isArray(JSON.parse(disabledRaw || '[]')) ? JSON.parse(disabledRaw || '[]') : [];
      if (disabled && disabled.length > 0) {
        const enabled = apps.map(a => a.id).filter((id) => id === 'chat' ? true : !disabled.includes(id));
        return ensureChatVisible(enabled);
      }
      // Default: show core apps including chat
      const defaultApps = ['calc','todo','clock','calendar','chat'];
      return apps.filter(a => defaultApps.includes(a.id));
    } catch (e) {
      const fallbackApps = ['calc','todo','clock','calendar','chat'];
      return apps.filter(a => fallbackApps.includes(a.id));
    }
  }, [apps]);

  // Search filter
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return visibleApps;
    return visibleApps.filter(app => 
      app.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [visibleApps, searchQuery]);

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
  }, [openTray]);

  useEffect(() => {
    const handler = (e) => {
      try {
        const c = e?.detail?.count || 0;
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
    
    try {
      const s0 = JSON.parse(localStorage.getItem('chatSettings') || '{}'); 
      setChatSettings(s0 || {});
    } catch (e) { setChatSettings({}); }

    const localSettings = () => { 
      try { 
        const s = JSON.parse(localStorage.getItem('chatSettings') || '{}'); 
        setChatSettings(s || {}); 
      } catch(e) { setChatSettings({}); } 
    };

    window.addEventListener('chat-settings-changed', (e) => { 
      try { 
        const s = e?.detail || JSON.parse(localStorage.getItem('chatSettings') || '{}'); 
        setChatSettings(s || {}); 
      } catch(e) { setChatSettings({}); } 
    });
    
    notificationHandler();
    return () => { 
      window.removeEventListener('chat-unread', handler); 
      window.removeEventListener('storage', storageHandler); 
      window.removeEventListener('system-notification', notificationHandler); 
    };
  }, []);

  // When tray opens, focus on the first visual app
  useEffect(() => {
    if (!openTray) return undefined;
    const id = setTimeout(() => {
      const refs = focusRefs.current.filter(Boolean);
      refs[0]?.focus();
    }, 150);
    return () => clearTimeout(id);
  }, [openTray]);

  // Enhanced keyboard navigation for a 3-column grid
  const handleTrayKeyDown = useCallback((e) => {
    const refs = focusRefs.current.filter(Boolean);
    const len = refs.length || 0;
    if (len === 0) return;
    const activeIndex = refs.findIndex((r) => r === document.activeElement);

    const cols = 3; 

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % len;
      refs[nextIndex]?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = activeIndex === -1 ? len - 1 : (activeIndex - 1 + len) % len;
      refs[prevIndex]?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      let nextIndex = activeIndex === -1 ? 0 : activeIndex + cols;
      if (nextIndex >= len) {
        nextIndex = activeIndex % cols; 
      }
      refs[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      let prevIndex = activeIndex === -1 ? len - 1 : activeIndex - cols;
      if (prevIndex < 0) {
        const lastRowStart = Math.floor((len - 1) / cols) * cols;
        prevIndex = lastRowStart + (activeIndex % cols);
        if (prevIndex >= len) {
          prevIndex = len - 1;
        }
      }
      refs[prevIndex]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      refs[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      refs[len - 1]?.focus();
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
      {/* Main tray launcher handle */}
      <Tooltip title="App Launcher" placement="left">
        <IconButton
          className="tray-handle"
          size="large"
          ref={trayHandleRef}
          sx={{
            background: openTray 
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' 
              : 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            color: "white",
            boxShadow: openTray 
              ? "0 4px 12px rgba(15, 23, 42, 0.3)" 
              : "0 10px 25px rgba(79, 70, 229, 0.35), 0 2px 10px rgba(6, 182, 212, 0.2)",
            width: 56,
            height: 56,
            borderRadius: '16px', // Sleek modern squircle
            border: '1px solid rgba(255, 255, 255, 0.1)',
            "&:hover": { 
              transform: "scale(1.08) translateY(-2px)",
              boxShadow: openTray 
                ? "0 6px 16px rgba(15, 23, 42, 0.35)" 
                : "0 14px 30px rgba(79, 70, 229, 0.45), 0 4px 15px rgba(6, 182, 212, 0.3)",
              "& .handle-icon": {
                transform: "rotate(45deg)",
              }
            },
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          onClick={() => {
            setOpenTray((s) => !s);
            if (!openTray) setSearchQuery(""); // Clear search when opening
          }}
          aria-expanded={openTray}
          aria-label="Open app tray"
        >
          {/* Badge for running apps count */}
          <Badge 
            badgeContent={openAppIds.length} 
            color="success"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#10b981',
                color: 'white',
                fontWeight: 700,
                fontSize: '10px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)',
                border: '1.5px solid #4f46e5',
                animation: openAppIds.length > 0 ? 'pulse-badge 2s infinite ease-in-out' : 'none',
                '@keyframes pulse-badge': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.15)' }
                }
              }
            }}
          >
            <Box 
              className="handle-icon" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
              }}
            >
              <FiGrid size={24} />
            </Box>
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Glassmorphic App Launcher Grid Panel */}
      <Fade in={openTray} timeout={300}>
        <Paper
          elevation={0}
          sx={{
            position: "absolute",
            bottom: 74,
            right: 0,
            p: 2,
            width: 320, // Fits 3 columns of premium tiles perfectly
            borderRadius: '24px', 
            bgcolor: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(20px) saturate(180%)",
            webkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05)",
            transformOrigin: 'bottom right',
          }}
          onKeyDown={handleTrayKeyDown}
          role="menu"
          aria-label="App tray menu"
        >
          {/* Header Area */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
            <Box>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 800, 
                  color: '#1e293b',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2
                }}
              >
                App Launcher
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#64748b',
                  fontWeight: 500,
                  fontSize: '10px'
                }}
              >
                {openAppIds.length > 0 
                  ? `${openAppIds.length} active window${openAppIds.length > 1 ? 's' : ''}`
                  : 'Workspace tools'}
              </Typography>
            </Box>
            
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Minimize all windows" placement="top">
                <IconButton 
                  size='small' 
                  onClick={() => { onMinimizeAll?.(); setOpenTray(false); }}
                  sx={{ 
                    color: '#475569', 
                    bgcolor: 'rgba(0,0,0,0.04)',
                    width: 28,
                    height: 28,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.08)', color: '#1e293b' }
                  }}
                >
                  <MdRemove size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close all windows" placement="top">
                <IconButton 
                  size='small' 
                  onClick={() => { onCloseAll?.(); setOpenTray(false); }}
                  sx={{ 
                    color: '#ef4444', 
                    bgcolor: 'rgba(239, 68, 68, 0.06)',
                    width: 28,
                    height: 28,
                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }
                  }}
                >
                  <MdClose size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip title={chatSettings && chatSettings.hideSidebar ? 'Show Chat Panel' : 'Hide Chat Panel'} placement="top">
                <IconButton 
                  size='small' 
                  onClick={() => {
                    try {
                      const s = JSON.parse(localStorage.getItem('chatSettings') || '{}');
                      const next = { ...(s || {}), hideSidebar: !s.hideSidebar };
                      localStorage.setItem('chatSettings', JSON.stringify(next));
                      setChatSettings(next);
                      window.dispatchEvent(new CustomEvent('chat-settings-changed', { detail: next }));
                    } catch (e) { }
                    setOpenTray(false);
                  }}
                  sx={{ 
                    color: '#475569', 
                    bgcolor: 'rgba(0,0,0,0.04)',
                    width: 28,
                    height: 28,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.08)', color: '#1e293b' }
                  }}
                >
                  {(chatSettings && chatSettings.hideSidebar) ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Integrated Search Bar */}
          <Box sx={{ px: 0.5, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                borderRadius: '12px',
                px: 1.5,
                py: 0.75,
                border: '1px solid rgba(0, 0, 0, 0.03)',
                transition: 'all 0.2s',
                '&:focus-within': {
                  bgcolor: 'rgba(255, 255, 255, 0.9)',
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <FiSearch size={15} style={{ color: '#64748b', marginRight: 8 }} />
              <InputBase
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  fontSize: '12px',
                  color: '#1e293b',
                  width: '100%',
                  fontWeight: 500,
                  '& input::placeholder': {
                    color: '#94a3b8',
                    opacity: 1,
                  }
                }}
              />
              {searchQuery && (
                <IconButton 
                  size="small" 
                  onClick={() => setSearchQuery("")}
                  sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#64748b' } }}
                >
                  <MdClose size={14} />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Grid of Square/Squircle Tiles */}
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: 1.2,
              maxHeight: '300px',
              overflowY: 'auto',
              pr: 0.5,
              '&::-webkit-scrollbar': {
                width: '4px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'rgba(0,0,0,0.02)',
              },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(0,0,0,0.1)',
                borderRadius: '2px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: 'rgba(0,0,0,0.2)',
              }
            }}
          >
            {filteredApps.map(({ Icon, label, id, color, shortcut }, idx) => {
              const isOpen = openAppIds.includes(id);
              const isActive = activeAppId === id;
              
              return (
                <Tooltip key={id} title={shortcut ? `${label} (${shortcut})` : label} placement="top">
                  <Box sx={{ display: 'inline-block', position: 'relative' }}>
                    <Badge
                      color="error"
                      variant="standard"
                      badgeContent={(id === 'chat' && chatUnreadCount > 0) ? chatUnreadCount : (id === 'notifications' && notificationCount > 0) ? notificationCount : undefined}
                      sx={{
                        width: '100%',
                        '& .MuiBadge-badge': {
                          right: 12,
                          top: 10,
                          fontWeight: 700,
                          fontSize: '10px',
                          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
                          bgcolor: '#ef4444'
                        }
                      }}
                    >
                      <ButtonBase
                        role="menuitem"
                        onClick={() => {
                          console.debug('[AppTray] clicking app icon', id);
                          setOpenTray(false);
                          onAppOpen(id);
                          setTimeout(() => trayHandleRef.current?.focus(), 50);
                        }}
                        ref={(el) => (focusRefs.current[idx] = el)}
                        aria-keyshortcuts={shortcut}
                        tabIndex={0}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: 86,
                          borderRadius: '16px',
                          bgcolor: isOpen ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.45)',
                          border: '1px solid',
                          borderColor: isActive 
                            ? 'primary.main' 
                            : isOpen 
                              ? 'rgba(0, 0, 0, 0.15)' 
                              : 'rgba(0, 0, 0, 0.05)',
                          boxShadow: isActive
                            ? '0 6px 20px rgba(25, 118, 210, 0.12)'
                            : isOpen
                              ? '0 4px 12px rgba(0, 0, 0, 0.04)'
                              : '0 2px 6px rgba(0, 0, 0, 0.01)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            bgcolor: isOpen ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                            transform: 'translateY(-4px)',
                            boxShadow: `0 10px 20px rgba(0, 0, 0, 0.06), 0 4px 12px ${color}15`,
                            borderColor: color,
                            '& .app-icon': {
                              color: color,
                              transform: 'scale(1.1) rotate(4deg)',
                              filter: `drop-shadow(0 4px 8px ${color}4d)`,
                            }
                          },
                          '&:focus-visible': {
                            outline: '2px solid',
                            outlineColor: 'primary.main',
                            outlineOffset: '2px',
                          }
                        }}
                        aria-pressed={isOpen}
                      >
                        {/* Open status breathing indicator */}
                        {isOpen && (
                          <Box 
                            sx={{ 
                              position: 'absolute', 
                              bottom: 8, 
                              width: 14, 
                              height: 4, 
                              borderRadius: '2px', 
                              bgcolor: color,
                              boxShadow: `0 1px 6px ${color}`,
                              animation: 'pulse-bar 2s infinite ease-in-out',
                              '@keyframes pulse-bar': {
                                '0%, 100%': { opacity: 0.6, transform: 'scaleX(1)' },
                                '50%': { opacity: 1, transform: 'scaleX(1.3)' }
                              }
                            }} 
                          />
                        )}

                        {/* Active Window Pulsing Ring */}
                        {isActive && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -1,
                              left: -1,
                              right: -1,
                              bottom: -1,
                              borderRadius: '16px',
                              border: '2px solid',
                              borderColor: color,
                              pointerEvents: 'none',
                              animation: 'pulse-ring 2s infinite ease-in-out',
                              '@keyframes pulse-ring': {
                                '0%': { opacity: 0.3, transform: 'scale(1)' },
                                '50%': { opacity: 0.6, transform: 'scale(1.02)' },
                                '100%': { opacity: 0.3, transform: 'scale(1)' }
                              }
                            }}
                          />
                        )}

                        {/* App Icon */}
                        <Box 
                          className="app-icon"
                          sx={{ 
                            color: isOpen ? color : '#64748b', 
                            mb: 1.2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.25s ease',
                            filter: isOpen ? `drop-shadow(0 2px 4px ${color}33)` : 'none',
                          }}
                        >
                          <Icon size={22} />
                        </Box>

                        {/* App Label */}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: isOpen || isActive ? 700 : 600, 
                            color: isOpen ? '#1e293b' : '#475569',
                            fontSize: '11px',
                            textAlign: 'center',
                            px: 0.5,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%',
                            transition: 'color 0.2s',
                          }}
                        >
                          {label}
                        </Typography>
                      </ButtonBase>
                    </Badge>
                  </Box>
                </Tooltip>
              );
            })}

            {/* No items fallback */}
            {filteredApps.length === 0 && (
              <Box 
                sx={{ 
                  gridColumn: 'span 3', 
                  py: 4, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#94a3b8'
                }}
              >
                <FiSearch size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>
                  No match for "{searchQuery}"
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
};

export default AppTray;

