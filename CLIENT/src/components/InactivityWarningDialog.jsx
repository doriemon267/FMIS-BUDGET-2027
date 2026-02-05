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
        Malapit nang mag-logout
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Walang aktibidad sa loob ng ilang minuto. Malulog-out ka sa loob ng 1 minuto kung walang gagawin.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
          I-click ang &quot;Manatiling naka-log in&quot; para magpatuloy.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <CustomButton
          size="large"
          onClick={onStayLoggedIn}
          sx={{ bgcolor: "primary.main", ":hover": { bgcolor: "primary.dark" } }}
        >
          Manatiling naka-log in
        </CustomButton>
      </DialogActions>
    </Dialog>
  );
};

export default InactivityWarningDialog;
