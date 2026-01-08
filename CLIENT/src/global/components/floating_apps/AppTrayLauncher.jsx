// src/components/AppTrayLauncher.jsx
import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from "react";
import AppTray from "./AppTray";
import FloatingAppWindow from "./FloatingAppWindow";
const importWithDebug = (importer, name) => lazy(async () => {
  try {
    return await importer();
  } catch (err) {
    console.error(`[AppTrayLauncher] Failed to import ${name}:`, err);
    throw err;
  }
});
const CalculatorApp = importWithDebug(() => import("./apps/CalculatorApp"), 'CalculatorApp');
const TodoApp = importWithDebug(() => import("./apps/TodoApp"), 'TodoApp');
const ClockApp = importWithDebug(() => import("./apps/ClockApp"), 'ClockApp');
const CalendarApp = importWithDebug(() => import("./apps/CalendarApp"), 'CalendarApp');
const ChatApp = importWithDebug(() => import("./apps/ChatApp"), 'ChatApp');
import FixedChatWindow from './FixedChatWindow';

const AppTrayLauncher = () => {
  // console.debug('[AppTrayLauncher] render start');
  const appConfig = useMemo(() => ({
    calc: { title: "Calculator", component: <CalculatorApp /> },
    todo: { title: "Todo List", component: <TodoApp /> },
    clock: { title: "Clock", component: <ClockApp /> },
    calendar: { title: "Calendar", component: <CalendarApp /> },
    chat: { title: 'Messages', component: <ChatApp /> },
  }), []);

  const [openApps, setOpenApps] = useState(() => {
    try {
      // Prefer sessionStorage for ephemeral UI state (per-tab/window)
      let raw = sessionStorage.getItem("fmis_open_apps_v1");
      // Migrate from localStorage if sessionStorage is empty
      if (!raw) {
        const legacy = localStorage.getItem("fmis_open_apps_v1");
        if (legacy) {
          raw = legacy;
          try { sessionStorage.setItem("fmis_open_apps_v1", legacy); } catch (e) {}
          try { localStorage.removeItem("fmis_open_apps_v1"); } catch (e) {}
        }
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((p) => ({ id: p.id, defaultPosition: p.defaultPosition, minimized: !!p.minimized, key: p.key, title: appConfig[p.id]?.title, component: appConfig[p.id]?.component }))
        : [];
    } catch (e) {
      console.warn("[AppTrayLauncher] failed to read persisted open apps", e);
      return [];
    }
  });
  const [chatPinned, setChatPinned] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('chatSettings') || '{}'); return s && s.pinned !== false; } catch (e) { return true; }
  });
  const [trayChatSettings, setTrayChatSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chatSettings') || '{}') || {}; } catch (e) { return {}; }
  });

  // Declare open/close handler before effects that depend on it to avoid TDZ/ReferenceError.
  const handleAppOpen = useCallback((id) => {
    console.debug('[AppTrayLauncher] handleAppOpen called for id:', id);
    const isOpen = openApps.some((a) => a.id === id);
    const isActive = openApps.length && openApps[openApps.length - 1].id === id;
    if (!isOpen) {
      // proceed to open
    } else if (isOpen && isActive) {
      // toggle close
      setOpenApps((prev) => prev.filter((a) => a.id !== id));
      return;
    } else if (isOpen && !isActive) {
      // if minimized restore; else bring to top
      const target = openApps.find((a) => a.id === id);
      if (target?.minimized) {
        setOpenApps((prev) => prev.map((a) => a.id === id ? { ...a, minimized: false } : a));
        bringToTop(id);
        return;
      }
      bringToTop(id);
      return;
    }

    const config = appConfig;
    const app = config[id];
    if (!app) return;

    // Cascade position: each new window opens +40px right/down
    const offset = openApps.length * 40;
    const defaultPosition = {
      x: 100 + offset,
      y: 80 + offset,
    };

    setOpenApps((prev) => {
      console.debug('[AppTrayLauncher] adding app to openApps:', id);
      return [
        ...prev,
        {
          id,
          ...app,
          key: `${id}-${Date.now()}`,
          defaultPosition,
          minimized: false,
        },
      ];
    });
  }, [openApps, appConfig]);

  useEffect(() => {
    // console.debug("[AppTrayLauncher] openApps changed:", openApps.map((a) => a.id));
    try {
      const toSave = openApps.map(({ id, defaultPosition, minimized, key }) => ({ id, defaultPosition, minimized, key }));
      // Persist in sessionStorage so state is per-tab and cleared on full browser close
      try { sessionStorage.setItem("fmis_open_apps_v1", JSON.stringify(toSave)); } catch (e) { console.warn('[AppTrayLauncher] failed to persist open apps', e); }
    } catch (e) {
      console.warn("[AppTrayLauncher] failed to persist open apps", e);
    }
  }, [openApps]);

  // Sync chat pinned state whenever chatSettings change (from ChatApp)
  useEffect(() => {
    const handler = (e) => {
      try { const s = e?.detail || JSON.parse(localStorage.getItem('chatSettings') || '{}'); setChatPinned(s && s.pinned !== false); setTrayChatSettings(s || {}); } catch (err) {}
    };
    window.addEventListener('chat-settings-changed', handler);
    return () => window.removeEventListener('chat-settings-changed', handler);
  }, []);

  // NOTE: Removed automatic opening of chat when pinned to avoid surprise UI behavior.

  // Keyboard shortcuts (Alt+T/C/K/A) to open apps quickly; ignore when typing in inputs
  useEffect(() => {
    function onKey(e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const isContentEditable = document.activeElement?.isContentEditable;
        const inFloatingApp = !!document.activeElement?.closest?.('.floating-app-window');
        // Allow Alt shortcuts if focus is inside a floating app window to support toggling apps like Calculator
        if (!inFloatingApp && (activeTag === 'input' || activeTag === 'textarea' || isContentEditable)) return;
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault(); handleAppOpen('todo'); break;
          case 'c':
            e.preventDefault(); handleAppOpen('calc'); break;
          case 'k':
            e.preventDefault(); handleAppOpen('clock'); break;
          case 'a':
            e.preventDefault(); handleAppOpen('calendar'); break;
          case 'm':
            e.preventDefault(); handleAppOpen('chat'); break;
          default:
            break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAppOpen]);

  // Listen for open-app event (e.g., from ChatApp when new message arrives)
  useEffect(() => {
    const handler = (e) => {
      const appId = e?.detail?.appId;
      if (appId) {
        console.debug('[AppTrayLauncher] open-app event received for:', appId);
        handleAppOpen(appId);
      }
    };
    window.addEventListener('open-app', handler);
    return () => window.removeEventListener('open-app', handler);
  }, [handleAppOpen]);

  const handleMinimize = (id, minimize = true) => {
    setOpenApps((prev) => prev.map((a) => a.id === id ? { ...a, minimized: minimize } : a));
  };

  const handlePositionChange = (id, pos) => {
    setOpenApps((prev) => prev.map((a) => a.id === id ? { ...a, defaultPosition: pos } : a));
  };

  const minimizeAll = () => {
    setOpenApps((prev) => prev.map((a) => ({ ...a, minimized: true })));
  };

  const closeAll = () => {
    setOpenApps([]);
  };

  const bringToTop = (id) => {
    setOpenApps((prev) => {
      const existing = prev.find((a) => a.id === id);
      if (!existing) return prev;
      const others = prev.filter((a) => a.id !== id);
      return [...others, existing];
    });
  };

  const closeApp = (id) => {
    setOpenApps((prev) => prev.filter((a) => a.id !== id));
  };

  const activeAppId = openApps.length ? openApps[openApps.length - 1].id : null;

  // console.debug('[AppTrayLauncher] about to render, openApps:', openApps.map(a => a.id));
  return (
    <>
      <AppTray onAppOpen={handleAppOpen} openAppIds={openApps.map((a) => a.id)} activeAppId={activeAppId} onCloseAll={closeAll} onMinimizeAll={minimizeAll} chatPinned={chatPinned} />

      {/* Each window is completely independent */}
      {openApps.map(({ id, title, component, key, defaultPosition, minimized }, idx) => {
        try {
          const cfg = appConfig[id] || {};
          const winTitle = title || cfg.title;
          const winComponent = component || cfg.component;
          console.debug('[AppTrayLauncher] rendering window', id, { defaultPosition, minimized });
          // Use specialized fixed, responsive container for Chat so it's always anchored bottom-right and mobile responsive
          if (id === 'chat') {
            console.debug('[AppTrayLauncher] rendering chat window: chatPinned=', chatPinned, 'trayChatSettings.dimOnOpen=', trayChatSettings?.dimOnOpen);
            if (chatPinned) {
              return (
                <Suspense key={key} fallback={<div style={{ padding: 8, color: '#999' }}>Loading chat...</div>}>
                  <FixedChatWindow
                    onClose={() => closeApp(id)}
                    onMinimize={(min) => handleMinimize(id, min)}
                    minimized={minimized}
                    isPinned={chatPinned}
                    dimOnOpen={trayChatSettings?.dimOnOpen === true}
                    zIndex={1400 + idx}
                  >
                    {component}
                  </FixedChatWindow>
                </Suspense>
              );
            }
            // Not pinned -> render as a draggable floating window
            return minimized ? null : (
              <Suspense key={key} fallback={<div style={{ padding: 8, color: '#999' }}>Loading chat...</div>}>
                <FloatingAppWindow
                  title={winTitle}
                  onClose={() => closeApp(id)}
                  zIndex={1400 + idx}
                  onActivate={() => bringToTop(id)}
                  onMinimize={(min) => handleMinimize(id, min)}
                  onPositionChange={(pos) => handlePositionChange(id, pos)}
                  defaultPosition={defaultPosition}
                  active={activeAppId === id}
                >
                  {component}
                </FloatingAppWindow>
              </Suspense>
            );
          }

          return minimized ? null : (
            <Suspense key={key} fallback={<div style={{ padding: 8, color: '#999' }}>Loading application...</div>}>
              <FloatingAppWindow
                // key applied on Suspense
                title={winTitle}
                onClose={() => closeApp(id)}
                zIndex={1400 + idx}
                onActivate={() => bringToTop(id)}
                onMinimize={(min) => handleMinimize(id, min)}
                onPositionChange={(pos) => handlePositionChange(id, pos)}
                defaultPosition={defaultPosition}
                active={activeAppId === id}
              >
                {winComponent}
              </FloatingAppWindow>
            </Suspense>
          );
        } catch (err) {
          console.error('[AppTrayLauncher] failed to render window', id, err);
          return null;
        }
      })}
    </>
  );
};

export default AppTrayLauncher;
