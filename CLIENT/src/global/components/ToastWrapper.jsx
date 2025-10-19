import { useTheme } from "@emotion/react";
import { Toaster } from "react-hot-toast";

const FALLBACK_THEME = {
  palette: {
    background: { paper: "#fff" },
    text: { primary: "#333" },
    success: { main: "#4caf50", contrastText: "#fff" },
    error: { main: "#f44336", contrastText: "#fff" },
  },
  typography: { fontFamily: "Arial, sans-serif" },
};

const ToastWrapper = () => {
  const theme = useTheme();
  const palette = theme?.palette ?? FALLBACK_THEME.palette;
  const typography = theme?.typography ?? FALLBACK_THEME.typography;

  return (
    <Toaster
      position="bottom-left"
      reverseOrder={false}
      toastOptions={{
        // Styling the container
        style: {
          background: palette.background?.paper ?? FALLBACK_THEME.palette.background.paper,
          color: palette.text?.primary ?? FALLBACK_THEME.palette.text.primary,
          fontFamily: typography.fontFamily ?? FALLBACK_THEME.typography.fontFamily,
          borderRadius: "8px",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        },
        // Customizing toast duration
        duration: 5000,
        // Customize for success, error, and other types
        success: {
          style: {
            background: palette.success?.main ?? FALLBACK_THEME.palette.success.main,
            color: palette.success?.contrastText ?? FALLBACK_THEME.palette.success.contrastText,
          },
          iconTheme: {
            primary: palette.success?.contrastText ?? FALLBACK_THEME.palette.success.contrastText,
            secondary: palette.success?.main ?? FALLBACK_THEME.palette.success.main,
          },
        },
        error: {
          style: {
            background: palette.error?.main ?? FALLBACK_THEME.palette.error.main,
            color: palette.error?.contrastText ?? FALLBACK_THEME.palette.error.contrastText,
          },
          iconTheme: {
            primary: palette.error?.contrastText ?? FALLBACK_THEME.palette.error.contrastText,
            secondary: palette.error?.main ?? FALLBACK_THEME.palette.error.main,
          },
        },
      }}
    />
  );
};

export default ToastWrapper;
