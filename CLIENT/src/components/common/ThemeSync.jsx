/**
 * Syncs theme from user preferences to ThemeContext when preferences load or change.
 * Render inside layout that has ThemeProvider (e.g. Dashboard).
 */
import { useEffect } from 'react';
import { useThemeContext } from '../../context/ThemeContext';
import useUserPreferences from '../../hooks/useUserPreferences';

export default function ThemeSync() {
  const { setMode } = useThemeContext();
  const { preferences } = useUserPreferences();

  useEffect(() => {
    const theme = preferences?.theme;
    if (theme === 'light' || theme === 'dark') {
      setMode(theme);
    }
    // 'auto' leaves current theme unchanged
  }, [preferences?.theme, setMode]);

  return null;
}
