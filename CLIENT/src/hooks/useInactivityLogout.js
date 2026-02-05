import { useEffect, useRef, useCallback } from "react";

const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_BEFORE_MS = 1 * 60 * 1000; // 1 minute warning before logout
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Auto-logout when there is no user activity for a specified period (default 5 min).
 * Shows a warning 1 minute before logout; user can click "Stay logged in" to reset.
 *
 * @param {Object} options
 * @param {Function} options.onLogout - Callback when logout timeout is reached
 * @param {Function} options.onWarning - Callback when warning phase starts; receives reset()
 * @param {React.RefObject} options.closeWarningRef - Ref; hook sets close fn so parent can close modal on activity reset
 * @param {boolean} options.enabled - Whether the hook is active (e.g. when user is logged in)
 * @param {number} [options.inactivityMs] - Total inactivity timeout (default: 5 min)
 * @param {number} [options.warningBeforeMs] - Warning shown this long before logout (default: 1 min)
 */
export default function useInactivityLogout({
  onLogout,
  onWarning,
  closeWarningRef,
  enabled,
  inactivityMs = INACTIVITY_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
}) {
  const mainTimeoutRef = useRef(null);
  const logoutTimeoutRef = useRef(null);
  const savedOnLogout = useRef(onLogout);
  const savedOnWarning = useRef(onWarning);

  useEffect(() => {
    savedOnLogout.current = onLogout;
    savedOnWarning.current = onWarning;
  }, [onLogout, onWarning]);

  const clearWarningPhase = useCallback(() => {
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    closeWarningRef?.current?.();
  }, [closeWarningRef]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearWarningPhase();

    if (mainTimeoutRef.current) {
      clearTimeout(mainTimeoutRef.current);
      mainTimeoutRef.current = null;
    }

    const timeUntilWarning = inactivityMs - warningBeforeMs;

    mainTimeoutRef.current = setTimeout(() => {
      mainTimeoutRef.current = null;

      const reset = () => {
        clearWarningPhase();
        resetTimer();
      };

      savedOnWarning.current?.(reset);

      logoutTimeoutRef.current = setTimeout(() => {
        logoutTimeoutRef.current = null;
        savedOnLogout.current?.();
      }, warningBeforeMs);
    }, timeUntilWarning);
  }, [enabled, inactivityMs, warningBeforeMs, clearWarningPhase]);

  useEffect(() => {
    if (!enabled) return;

    resetTimer();

    const handleActivity = () => resetTimer();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (mainTimeoutRef.current) clearTimeout(mainTimeoutRef.current);
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
      mainTimeoutRef.current = null;
      logoutTimeoutRef.current = null;
    };
  }, [enabled, resetTimer]);
}
