// src/components/AppTrayLauncher.jsx
import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from "react";
import AppTray from "./AppTray";
import FloatingAppWindow from "./FloatingAppWindow";
const CalculatorApp = lazy(() => import("./apps/CalculatorApp"));
const TodoApp = lazy(() => import("./apps/TodoApp"));
const ClockApp = lazy(() => import("./apps/ClockApp"));
const CalendarApp = lazy(() => import("./apps/CalendarApp"));
// import ChatApp from "./apps/ChatApp"; // Chat app currently unused/commented

const AppTrayLauncher = () => {
  console.debug('[AppTrayLauncher] render start');
  const appConfig = useMemo(() => ({
    calc: { title: "Calculator", component: <CalculatorApp /> },
    todo: { title: "Todo List", component: <TodoApp /> },
    clock: { title: "Clock", component: <ClockApp /> },
    calendar: { title: "Calendar", component: <CalendarApp /> },
  }), []);

  const [openApps, setOpenApps] = useState(() => {
    try {
      const raw = localStorage.getItem("fmis_open_apps_v1");
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
    console.debug("[AppTrayLauncher] openApps changed:", openApps.map((a) => a.id));
    try {
      const toSave = openApps.map(({ id, defaultPosition, minimized, key }) => ({ id, defaultPosition, minimized, key }));
      localStorage.setItem("fmis_open_apps_v1", JSON.stringify(toSave));
    } catch (e) {
      console.warn("[AppTrayLauncher] failed to persist open apps", e);
    }
  }, [openApps]);

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
          default:
            break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  console.debug('[AppTrayLauncher] about to render, openApps:', openApps.map(a => a.id));
  return (
    <>
      <AppTray onAppOpen={handleAppOpen} openAppIds={openApps.map((a) => a.id)} activeAppId={activeAppId} onCloseAll={closeAll} onMinimizeAll={minimizeAll} />

      {/* Each window is completely independent */}
      {openApps.map(({ id, title, component, key, defaultPosition, minimized }, idx) => {
        try {
          const cfg = appConfig[id] || {};
          const winTitle = title || cfg.title;
          const winComponent = component || cfg.component;
          console.debug('[AppTrayLauncher] rendering window', id, { defaultPosition, minimized });
          return minimized ? null : (
            <Suspense key={key} fallback={<div />}>
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
