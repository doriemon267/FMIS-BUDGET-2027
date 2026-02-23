import { useState, useEffect } from "react";
import { Snackbar, Alert, Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

/**
 * Shows a banner when the browser is offline.
 * Helps users understand why actions might fail and offers refresh.
 */
const OfflineBanner = () => {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      setOpen(false);
    };

    const handleOffline = () => {
      setOffline(true);
      setOpen(true);
    };

    if (!navigator.onLine) setOpen(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const message = offline
    ? "You appear to be offline. Some features may not work until your connection is restored."
    : "";

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!offline) return null;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{ mt: 7 }}
    >
      <Alert
        severity="warning"
        variant="filled"
        onClose={() => setOpen(false)}
        action={
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={handleRefresh}>
            Refresh
          </Button>
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default OfflineBanner;
