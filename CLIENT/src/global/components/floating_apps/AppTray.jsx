// src/components/AppTray.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { IconButton, Box, Tooltip, Fade, Stack, Paper, Badge } from "@mui/material";
import { FiGrid, FiClock } from "react-icons/fi";
import { BiCalculator } from "react-icons/bi";
import { MdOutlineChecklist, MdCalendarMonth } from "react-icons/md";
import { MdClose, MdRemove } from "react-icons/md";

const AppTray = ({ onAppOpen, openAppIds = [], activeAppId = null, onCloseAll, onMinimizeAll }) => {
  const [openTray, setOpenTray] = useState(false);
  const nodeRef = useRef(null);
  const trayHandleRef = useRef(null);
  const focusRefs = useRef([]);

  // Each app now has its own color
  const apps = useMemo(() => [
    { Icon: BiCalculator, label: "Calculator", id: "calc", color: "#1976d2", shortcut: 'Alt+C' }, // blue
    {
      Icon: MdOutlineChecklist,
      label: "Todo List",
      id: "todo",
      color: "#43a047",
      shortcut: 'Alt+T'
    }, // green
    { Icon: FiClock, label: "Clock", id: "clock", color: "#f57c00", shortcut: 'Alt+K' }, // orange
    {
      Icon: MdCalendarMonth,
      label: "Calendar",
      id: "calendar",
      color: "#6d4c41",
      shortcut: 'Alt+A'
    }, // brown
    // {
    //   Icon: BsChatDots,
    //   label: "Messages",
    //   id: "chat",
    //   color: "#00b0ff", // Telegram-like blue
    // },
  ], []);

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
          </Box>
          <Stack direction="column-reverse" spacing={1}>
                {apps.map(({ Icon, label, id, color, shortcut }, idx) => {
              const isOpen = openAppIds.includes(id);
              const isActive = activeAppId === id;
              const refIndex = idx; // logical order
              return (
                <Tooltip key={id} title={shortcut ? `${label} — ${shortcut}` : label} placement="left">
                <Badge
                  overlap="circular"
                  color="primary"
                  variant="dot"
                  invisible={!isOpen}
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
