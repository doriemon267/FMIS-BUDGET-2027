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
  GridView as PortalAccessIcon,
  QrCode2 as QrCodeIcon,
  ViewModule as BarcodeIcon,
  HelpOutline as HelpIcon,
  Print as PrintIcon,
  Tune as PreferencesIcon,
} from "@mui/icons-material";
import React, { useState } from "react";
import LogoutDialog from "../../components/LogoutDialog";
import UserPreferencesDialog from "../../components/settings/UserPreferencesDialog";
import { useUser } from "../../context/UserContext";

const formatDisplayName = (user) => {
  if (!user) return "";
  const first = user.FirstName || "";
  const middleInitial = user.MiddleName ? ` ${user.MiddleName.charAt(0)}.` : "";
  const last = user.LastName || "";
  const suffix = user.Suffix ? ` ${user.Suffix}` : "";
  return `${first}${middleInitial} ${last}${suffix}`.trim().replace(/\s+/g, " ");
};

const EXTERNAL_LINKS = [
  { label: "Settings", href: "https://accounts.nia.gov.ph/Manage", icon: SettingsIcon },
  { label: "Portal Access", href: "https://accounts.nia.gov.ph/portal/access", icon: PortalAccessIcon },
  { label: "Show QR Code", href: "https://accounts.nia.gov.ph/home/qrcode", icon: QrCodeIcon },
  { label: "Show Barcode", href: "https://accounts.nia.gov.ph/home/barcode", icon: BarcodeIcon },
];

const HELP_LINKS = [
  { label: "Help", href: "https://accounts.nia.gov.ph/Content/Help/Index.html", icon: HelpIcon },
  { label: "Printable Help", href: "https://accounts.nia.gov.ph/Content/Help/Index.pdf", icon: PrintIcon },
];

const UserAvatarMenu = () => {
  const { currentUser } = useUser();
  const displayName = formatDisplayName(currentUser);

  const [anchorElUser, setAnchorElUser] = React.useState(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);
  const handleOpenPreferences = () => {
    setPreferencesOpen(true);
    handleCloseUserMenu();
  };

  const handleLinkClick = (href) => {
    window.open(href, "_blank", "noopener,noreferrer");
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

        {EXTERNAL_LINKS.map(({ label, href, icon: Icon }) => (
          <MenuItem key={label} onClick={() => handleLinkClick(href)}>
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">{label}</Typography>
          </MenuItem>
        ))}

        <Divider />

        <MenuItem onClick={handleOpenPreferences}>
          <ListItemIcon>
            <PreferencesIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="body2">Preferences</Typography>
        </MenuItem>

        <Divider />

        {HELP_LINKS.map(({ label, href, icon: Icon }) => (
          <MenuItem key={label} onClick={() => handleLinkClick(href)}>
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <Typography variant="body2">{label}</Typography>
          </MenuItem>
        ))}

        <Divider />

        <LogoutDialog handleCloseMenu={handleCloseUserMenu} compact />
      </Menu>

      <UserPreferencesDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
    </Box>
  );
};

export default UserAvatarMenu;
