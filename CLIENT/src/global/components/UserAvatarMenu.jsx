import {
  Avatar,
  Box,
  IconButton,
  Menu,
  Tooltip,
  Typography,
} from "@mui/material";
import React from "react";
import LogoutDialog from "../../components/LogoutDialog";
import { useUser } from "../../context/UserContext";

const UserAvatarMenu = () => {
  const { currentUser } = useUser();

  const [anchorElUser, setAnchorElUser] = React.useState(null);

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  return (
    <Box sx={{ flexGrow: 0 }}>
      <Box display="flex" alignItems="center" gap={2}>
        <Typography
          sx={{ display: { xs: "none", md: "block" } }}
        >{`${currentUser.FirstName} ${currentUser.LastName}`}</Typography>
        <Tooltip title={`${currentUser.FirstName}'s settings`}>
          <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
            <Avatar
              alt={currentUser.FirstName}
              src={currentUser.ProfilePicture}
            />
          </IconButton>
        </Tooltip>
      </Box>
      <Menu
        sx={{ mt: "45px" }}
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
        <LogoutDialog />
      </Menu>
    </Box>
  );
};

export default UserAvatarMenu;
