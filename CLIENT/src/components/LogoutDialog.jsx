import {
  Box,
  ListItemIcon,
  MenuItem,
  Typography,
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

  // Kunin ang email mula sa posibleng casing (Email o email)
  const email = currentUser?.email ?? currentUser?.Email;
  
  const { idPart, emailPart } = parseParticularIdAndEmail(
    currentUser?.particularID,
    email
  );

  const handleOpen = async () => {
    handleCloseMenu?.();
    const result = await Swal.fire({
      title: "Logout?",
      text: "Are you sure you want to sign out?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#386641",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, logout",
      allowOutsideClick: false,
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
  );
};

export default LogoutDialog;