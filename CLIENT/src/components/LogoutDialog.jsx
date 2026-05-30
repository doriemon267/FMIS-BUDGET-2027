import {
  Box,
  ListItemIcon,
  MenuItem,
  Typography,
  useTheme
} from "@mui/material";
import { useState } from "react";
import { toast } from "react-toastify";
import { LuLogOut } from "react-icons/lu";
import Swal from "sweetalert2";
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
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Kunin ang email mula sa posibleng casing (Email o email)
  const email = currentUser?.email ?? currentUser?.Email;
  
  const { idPart, emailPart } = parseParticularIdAndEmail(
    currentUser?.particularID,
    email
  );

  const handleOpen = async () => {
    handleCloseMenu?.();
    const result = await Swal.fire({
      title: "Sign Out?",
      text: "Are you sure you want to sign out?",
      icon: "warning",
      iconColor: "#e63946",
      showCancelButton: true,
      confirmButtonText: "Yes, Sign Out",
      cancelButtonText: "Cancel",
      background: isDarkMode ? "#152e22" : "#ffffff", // Deep green backdrop for dark mode, clean white for light
      color: isDarkMode ? "#cbd5e1" : "#1e293b",
      confirmButtonColor: "#e63946", // Elegant modern red for destructive action
      cancelButtonColor: "#386641", // Sleek deep green for cancel
      reverseButtons: true,
      allowOutsideClick: false,
      customClass: {
        popup: 'premium-swal-popup',
        title: 'premium-swal-title',
        htmlContainer: 'premium-swal-text',
        confirmButton: 'premium-swal-confirm',
        cancelButton: 'premium-swal-cancel',
      }
    });

    if (result.isConfirmed) {
      handleLogout();
    }
  };
  
  const handleLogout = async () => {
    try {
      // Call the centralized logout function from UserContext
      // This will handle clearing local states, calling logout APIs, and redirecting to SSO
      await logout();
      if (!IS_PRODUCTION) {
        toast.success("Logged out successfully");
      }
    } catch (error) {
      toast.error("Logout failed!");
      console.error("Logout Error:", error);
    }
  };

  return (
    <>
      <style>{`
        .premium-swal-popup {
          border-radius: 24px !important;
          font-family: 'Outfit', 'Inter', 'Roboto', sans-serif !important;
          border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          padding: 2.5rem 1.5rem !important;
        }
        .premium-swal-title {
          font-weight: 900 !important;
          font-size: 1.6rem !important;
          letter-spacing: -0.5px !important;
          margin-bottom: 0.5rem !important;
        }
        .premium-swal-text {
          font-weight: 500 !important;
          font-size: 1rem !important;
          opacity: 0.85 !important;
          margin-bottom: 1.5rem !important;
        }
        .premium-swal-confirm {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-confirm:hover {
          transform: translateY(-2px) !important;
        }
        .premium-swal-cancel {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-cancel:hover {
          transform: translateY(-2px) !important;
        }
      `}</style>
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
    </>
  );
};

export default LogoutDialog;