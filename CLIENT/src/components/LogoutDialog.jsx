import {
  Box,
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

// Kapag particularID ay "909549mund.m.edra@gmail.com", i-split sa id at email
const parseParticularIdAndEmail = (particularID, emailFromUser) => {
  const raw = String(particularID || "");
  if (emailFromUser) {
    const idPart = raw.includes(emailFromUser) ? raw.replace(emailFromUser, "").trim() : raw;
    return { idPart: idPart || raw, emailPart: emailFromUser };
  }
  const emailRegex = /^(.+?)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
  const match = raw.match(emailRegex);
  if (match) {
    const idPart = match[1].trim();
    if (idPart.length > 1) return { idPart, emailPart: match[2] };
  }
  if (raw.includes("@")) return { idPart: "", emailPart: raw };
  return { idPart: raw, emailPart: null };
};

const LogoutDialog = ({ handleCloseMenu, compact }) => {
  const { logout, currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const email = currentUser?.email ?? currentUser?.Email;
  const { idPart, emailPart } = parseParticularIdAndEmail(
    currentUser?.particularID,
    email
  );

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
        {compact ? (
          <Typography variant="body2">Logout</Typography>
        ) : (
          <Box sx={{ display: "block", width: "100%" }}>
            <Typography component="span" display="block">
              Logout: {idPart}
            </Typography>
            {emailPart && (
              <Typography variant="body2" sx={{ mt: 0.25 }} component="span" display="block">
                ({emailPart})
              </Typography>
            )}
          </Box>
        )}
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