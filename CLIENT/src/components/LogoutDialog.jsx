import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItemIcon,
  MenuItem,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { LuLogOut } from "react-icons/lu";
import { useUser } from "../context/UserContext";
import CustomButton from "../global/components/CustomButton";

const LogoutDialog = () => {
  const { logout, currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      toast.success("Logged out successfully", { duration: 4000 });
    } catch (error) {
      toast.error("Logout failed!", { duration: 4000 });
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
          Logout: {currentUser.Username[0]}
        </Typography>
      </MenuItem>

      <Dialog
        open={isOpen}
        onClose={loading ? handleOpen : handleClose}
        aria-labelledby="logout-dialog-title"
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
