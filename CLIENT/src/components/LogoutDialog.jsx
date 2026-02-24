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
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import env from "../utils/env";

/**
 * Helper function para hiwalayin ang Employee ID at Email.
 * Halimbawa: "909549mund.m.edra@gmail.com" 
 * Result: { idPart: "909549", emailPart: "mund.m.edra@gmail.com" }
 */
const parseParticularIdAndEmail = (particularID, emailFromUser) => {
  const raw = String(particularID || "");
  
  // 1. Kung may email na galing sa user object, gamitin ito bilang pang-split
  if (emailFromUser) {
    const idPart = raw.includes(emailFromUser) 
      ? raw.replace(emailFromUser, "").trim() 
      : raw;
    return { idPart: idPart || raw, emailPart: emailFromUser };
  }

  // 2. Regex fallback: Hahanapin ang pattern ng email sa loob ng string
  const emailRegex = /^(.+?)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
  const match = raw.match(emailRegex);
  
  if (match) {
    const idPart = match[1].trim();
    if (idPart.length > 1) return { idPart, emailPart: match[2] };
  }

  // 3. Fallback kung email lang talaga ang laman o walang email
  if (raw.includes("@")) return { idPart: "User", emailPart: raw };
  return { idPart: raw, emailPart: null };
};

const LogoutDialog = ({ handleCloseMenu, compact = false }) => {
  const { logout, currentUser } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Kunin ang email mula sa posibleng casing (Email o email)
  const email = currentUser?.email ?? currentUser?.Email;
  
  const { idPart, emailPart } = parseParticularIdAndEmail(
    currentUser?.particularID,
    email
  );

  const handleOpen = () => setIsOpen(true);
  
  const handleClose = () => {
    setIsOpen(false);
    // Safety check: tatawagin lang kung existing ang function
    handleCloseMenu?.(); 
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (IS_PRODUCTION) {
        // NIA Production Logoff Logic
        const clientId = env("CLIENT_ID");
        const currentUrl = window.location.origin + "/dashboard";
        const returnUrl = encodeURIComponent(
          `https://accounts.nia.gov.ph/Account/Login?ReturnUrl=${encodeURIComponent(currentUrl)}`,
        );
        
        // Gamitin ang particularID para sa NIA owner parameter
        const logoffUrl = `https://accounts.nia.gov.ph/account/logoff?clientId=${clientId}&owner=${currentUser?.particularID}&returnUrl=${returnUrl}`;

        window.location.href = logoffUrl;
      } else {
        // Local/Dev Logout
        await logout();
        toast.success("Logged out successfully", { duration: 4000 });
      }
    } catch (error) {
      toast.error("Logout failed!", { duration: 4000 });
      console.error("Logout Error:", error);
    } finally {
      setLoading(false);
      // Hindi na kailangan i-close kung nag-redirect (Production), 
      // pero para sa Dev mode, kailangan ito.
      setIsOpen(false);
    }
  };

  return (
    <>
      <MenuItem onClick={handleOpen} sx={{ py: 1.5 }}>
        <ListItemIcon sx={{ color: "error.main" }}>
          <LuLogOut size={20} />
        </ListItemIcon>
        
        {compact ? (
          <Typography variant="body2" fontWeight={500}>Logout</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Typography 
              variant="body2" 
              sx={{ fontWeight: 600, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
            >
              Logout: {idPart}
            </Typography>
            {emailPart && (
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                {emailPart}
              </Typography>
            )}
          </Box>
        )}
      </MenuItem>

      <Dialog
        open={isOpen}
        onClose={loading ? undefined : handleClose}
        aria-labelledby="logout-dialog-title"
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)", // Mas malinaw na blur para sa focus
          },
        }}
      >
        <DialogTitle id="logout-dialog-title" sx={{ fontWeight: 700 }}>
          Confirm Logout
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Are you sure you want to log out? Any unsaved changes might be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <CustomButton
            size="medium"
            plain
            disabled={loading}
            onClick={handleClose}
            color="inherit"
          >
            Cancel
          </CustomButton>
          <CustomButton
            size="medium"
            loading={loading}
            onClick={handleLogout}
            sx={{ 
              bgcolor: "#1a1a1a", 
              color: "white",
              "&:hover": { bgcolor: "#333" } 
            }}
          >
            Proceed
          </CustomButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LogoutDialog;