import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItemIcon,
  MenuItem,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { LuLogOut } from "react-icons/lu";
import { useUser } from "../context/UserContext";
import CustomButton from "../global/components/CustomButton";
import IS_PRODUCTION from "../utils/IS_PRODUCTION"; // make sure this exists
import env from "../utils/env";

const LogoutDialog = ({ handleCloseMenu }) => {
  const { logout, currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    handleCloseMenu();
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (IS_PRODUCTION) {
        // Redirect to NIA production logoff URL
        const clientId = env("CLIENT_ID"); // 2b4ffb22-5827-49fb-97c1-df7564c6a4cc
        const currentUrl = window.location.origin + "/dashboard"; // or window.location.href if you want the exact page
        const returnUrl = encodeURIComponent(
          `https://accounts.nia.gov.ph/Account/Login?ReturnUrl=${encodeURIComponent(currentUrl)}`,
        );
        const logoffUrl = `https://accounts.nia.gov.ph/account/logoff?clientId=${clientId}&owner=${currentUser.particularID}&returnUrl=${returnUrl}`;

        window.location.href = logoffUrl; // redirect user
      } else {
        // Dev/local logout
        await logout();
        toast.success("Logged out successfully", { duration: 4000 });
      }
    } catch (error) {
      toast.error("Logout failed!", { duration: 4000 });
      console.error(error);
    } finally {
      setLoading(false);
      handleClose(); // Close the modal after logout
    }
  };

  return (
    <div>
      <MenuItem onClick={handleOpen}>
        <ListItemIcon>
          <LuLogOut />
        </ListItemIcon>
        <Typography sx={{ textAlign: "center" }}>
          Logout: {currentUser.particularID}
        </Typography>
      </MenuItem>

      <Dialog
        open={isOpen}
        onClose={loading ? handleOpen : handleClose}
        aria-labelledby="logout-dialog-title"
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(1.5px)",
          },
        }}
      >
        <DialogTitle id="logout-dialog-title">Logout</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1">
            Are you sure you want to log out from your account?
          </Typography>
        </DialogContent>
        <DialogActions>
          <CustomButton
            size="large"
            plain
            loading={loading}
            onClick={handleClose}
            color="error"
          >
            Cancel
          </CustomButton>
          <CustomButton
            size="large"
            loading={loading}
            onClick={handleLogout}
            sx={{ bgcolor: "#4a4a4a", ":hover": { bgcolor: "#333" } }}
          >
            Proceed
          </CustomButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default LogoutDialog;