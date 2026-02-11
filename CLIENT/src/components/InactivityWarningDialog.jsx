import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useEffect } from "react";
import CustomButton from "../global/components/CustomButton";
import { MdWarningAmber } from "react-icons/md";

const InactivityWarningDialog = ({ open, onStayLoggedIn }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onStayLoggedIn}
      aria-labelledby="inactivity-warning-title"
      maxWidth="xs"
      fullWidth
      BackdropProps={{
        sx: {
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
        },
      }}
      PaperProps={{
        sx: {
          border: "2px solid",
          borderColor: "warning.main",
        },
      }}
    >
      <DialogTitle
        id="inactivity-warning-title"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          color: "warning.dark",
        }}
      >
        <MdWarningAmber size={28} />
        You’re about to be logged out.
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          No activity detected for several minutes. You will be logged out in 1 minute if no action is taken.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
          Click the &quot;Stay logged in&quot; to continue.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <CustomButton
          size="large"
          onClick={onStayLoggedIn}
          sx={{ bgcolor: "primary.main", ":hover": { bgcolor: "primary.dark" } }}
        >
          Stay logged in
        </CustomButton>
      </DialogActions>
    </Dialog>
  );
};

export default InactivityWarningDialog;
