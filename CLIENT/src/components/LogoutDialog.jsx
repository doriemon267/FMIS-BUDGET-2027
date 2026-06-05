import {
  Box,
  Dialog,
  DialogContent,
  ListItemIcon,
  MenuItem,
  Typography,
  useTheme
} from "@mui/material";
import { useState } from "react";
import { toast } from "react-toastify"; // Ginamit ang react-toastify mo
import { LuLogOut } from "react-icons/lu";
import { FiAlertCircle } from "react-icons/fi";
import { useUser } from "../context/UserContext";
import CustomButton from "../global/components/CustomButton";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";

/**
 * Helper function para hiwalayin ang Employee ID at Email.
 */
const parseParticularIdAndEmail = (particularID, emailFromUser) => {
  const raw = String(particularID || "");
  
  if (emailFromUser) {
    const idPart = raw.includes(emailFromUser) 
      ? raw.replace(emailFromUser, "").trim() 
      : raw;
    return { idPart: idPart || raw, emailPart: emailFromUser };
  }

  const emailRegex = /^(.+?)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;
  const match = raw.match(emailRegex);
  
  if (match) {
    const idPart = match[1].trim();
    if (idPart.length > 1) return { idPart, emailPart: match[2] };
  }

  if (raw.includes("@")) return { idPart: "User", emailPart: raw };
  return { idPart: raw, emailPart: null };
};

const LogoutDialog = ({ handleCloseMenu, compact = false }) => {
  const { logout, currentUser } = useUser();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // State para sa MUI Dialog at Loading
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const email = currentUser?.email ?? currentUser?.Email;
  const { idPart, emailPart } = parseParticularIdAndEmail(
    currentUser?.particularID,
    email
  );

  const handleOpen = () => {
    setIsOpen(true);
    // Note: Hindi muna natin tatawagin ang handleCloseMenu() dito para 
    // hindi ma-unmount ang menu at ang dialog habang bukas pa ang pop-up.
  };

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
      handleCloseMenu?.(); // Dito na isasara ang dropdown menu kapag kinancel
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Pinanatili ang malinis mong logic: nasa context na ang lahat ng SSO redirection at API calls
      await logout();
      if (!IS_PRODUCTION) {
        toast.success("Logged out successfully");
      }
      handleCloseMenu?.();
    } catch (error) {
      toast.error("Logout failed!");
      console.error("Logout Error:", error);
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* TRIGGER: Ang MenuItem UI mo */}
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

      {/* POP-UP: Ang MUI Dialog Layout ni Keru */}
      <Dialog
        open={isOpen}
        onClose={handleClose}
        aria-labelledby="logout-dialog-title"
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: "24px",
            width: "100%",
            maxWidth: "400px",
            m: 2,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            bgcolor: isDarkMode ? "#1e293b" : "background.paper", // Idinagdag ang dark mode support mo
          },
        }}
      >
        <DialogContent
          sx={{
            p: { xs: 3, sm: 4 },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Centered Alert Icon */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: isDarkMode ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 3,
            }}
          >
            <FiAlertCircle size={32} color="#ef4444" />
          </Box>

          {/* Title */}
          <Typography
            id="logout-dialog-title"
            variant="h5"
            sx={{
              fontWeight: 700,
              color: "text.primary",
              mb: 1.5,
              textAlign: "center",
            }}
          >
            Sign Out?
          </Typography>

          {/* Descriptive Text */}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              textAlign: "center",
              lineHeight: 1.6,
              mb: 4,
            }}
          >
            Are you sure you want to log out {idPart}? You will need to sign in again to access your dashboard.
          </Typography>

          {/* Stacked Action Buttons */}
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <CustomButton
              loading={loading}
              onClick={handleLogout}
              fullWidth
              sx={{
                py: 1.8,
                borderRadius: "16px",
                bgcolor: isDarkMode ? "#e63946" : "#264524", // Ginamit ang elegant red mo for Dark Mode, at NIA green ni Keru for Light Mode
                color: "white",
                fontWeight: 700,
                fontSize: "1rem",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: isDarkMode ? "#cc333f" : "#1a301a",
                },
                "&:active": {
                  transform: "scale(0.96)",
                },
              }}
            >
              Yes, Sign Out
            </CustomButton>

            <CustomButton
              disabled={loading}
              onClick={handleClose}
              fullWidth
              plain="true"
              sx={{
                py: 1.8,
                borderRadius: "16px",
                bgcolor: isDarkMode ? "rgba(255,255,255,0.05)" : "#f9fafb",
                color: isDarkMode ? "#cbd5e1" : "#4b5563",
                fontWeight: 700,
                fontSize: "1rem",
                transition: "all 0.2s",
                "&:hover": {
                  bgcolor: isDarkMode ? "rgba(255,255,255,0.1)" : "#f3f4f6",
                },
                "&:active": {
                  transform: "scale(0.96)",
                },
              }}
            >
              Cancel
            </CustomButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LogoutDialog;