import { useTheme } from "@emotion/react";
import { Toaster } from "react-hot-toast";

const ToastWrapper = () => {
  // Check if theme is available before using it
  let theme;
  try {
    theme = useTheme();
  } catch (error) {
    // Fallback theme if useTheme fails
    theme = {
      palette: {
        background: { paper: '#fff' },
        text: { primary: '#333' },
        success: { main: '#4caf50', contrastText: '#fff' },
        error: { main: '#f44336', contrastText: '#fff' }
      },
      typography: { fontFamily: 'Arial, sans-serif' }
    };
  }

  return (
    <Toaster
      position="bottom-left"
      reverseOrder={false}
      toastOptions={{
        // Styling the container
        style: {
          background: theme.palette.background.paper,
          color: theme.palette.text.primary,
          fontFamily: theme.typography.fontFamily,
          borderRadius: "8px",
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
        },
        // Customizing toast duration
        duration: 5000,
        // Customize for success, error, and other types
        success: {
          style: {
            background: theme.palette.success.main,
            color: theme.palette.success.contrastText,
          },
          iconTheme: {
            primary: theme.palette.success.contrastText,
            secondary: theme.palette.success.main,
          },
        },
        error: {
          style: {
            background: theme.palette.error.main,
            color: theme.palette.error.contrastText,
          },
          iconTheme: {
            primary: theme.palette.error.contrastText,
            secondary: theme.palette.error.main,
          },
        },
      }}
    />
  );
};

export default ToastWrapper;
