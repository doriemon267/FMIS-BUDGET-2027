import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  HelpOutline as HelpIcon,
  Tune as PreferencesIcon,
} from "@mui/icons-material";
import React, { useState } from "react";
import LogoutDialog from "../../components/LogoutDialog";
import UserPreferencesDialog from "../../components/settings/UserPreferencesDialog";
import { useUser } from "../../context/UserContext";
import InAppHelp from "../../components/common/InAppHelp";

const formatDisplayName = (user) => {
  if (!user) return "";
  const first = user.FirstName || "";
  const middleInitial = user.MiddleName ? ` ${user.MiddleName.charAt(0)}.` : "";
  const last = user.LastName || "";
  const suffix = user.Suffix ? ` ${user.Suffix}` : "";
  return `${first}${middleInitial} ${last}${suffix}`.trim().replace(/\s+/g, " ");
};

const SETTINGS_HREF = "https://accounts.nia.gov.ph/Manage";

const UserAvatarMenu = () => {
  const { currentUser } = useUser();
  const displayName = formatDisplayName(currentUser);

  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleOpenPreferences = () => {
    setPreferencesOpen(true);
    handleCloseUserMenu();
  };
  const handleOpenHelp = () => {
    setHelpOpen(true);
    handleCloseUserMenu();
  };
  const handleSettingsClick = () => {
    window.open(SETTINGS_HREF, "_blank", "noopener,noreferrer");
    handleCloseUserMenu();
  };

  return (
    <Box sx={{ flexGrow: 0 }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Typography sx={{ display: { xs: "none", md: "block" } }}>
          {displayName}
        </Typography>
        <Tooltip title={`${displayName}'s settings`}>
          <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
            <Avatar
              alt={displayName || currentUser?.FirstName}
              src={currentUser?.ProfilePicture}
            />
          </IconButton>
        </Tooltip>
      </Box>
      <Menu
        sx={{ mt: "45px", "& .MuiPaper-root": { borderRadius: 2, minWidth: 220 } }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        {/* Header: name + avatar */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            minWidth: 200,
          }}
        >
          <Typography variant="subtitle1" fontWeight={500} noWrap>
            {displayName || "User"}
          </Typography>
          <Avatar
            alt={displayName}
            src={currentUser?.ProfilePicture}
            sx={{ width: 36, height: 36 }}
          />
        </Box>
        <Divider />

        <MenuItem onClick={handleSettingsClick}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Settings</Typography>
        </MenuItem>

        <MenuItem onClick={handleOpenPreferences}>
          <ListItemIcon>
            <PreferencesIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Preferences</Typography>
        </MenuItem>

        <MenuItem onClick={handleOpenHelp}>
          <ListItemIcon>
            <HelpIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Help</Typography>
        </MenuItem>

        <Divider />

        <LogoutDialog handleCloseMenu={handleCloseUserMenu} compact />
      </Menu>

      <UserPreferencesDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
      <InAppHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
};

export default UserAvatarMenu;
