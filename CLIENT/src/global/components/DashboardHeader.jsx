import {
  Badge,
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { useNotification } from "../../context/NotificationContext";
import TableSearchBar from "./TableSearchBar";
import { MdCircleNotifications } from "react-icons/md";

const DashboardHeader = ({
  title = "Dashboard",
  description = "",
  searchable = false,
  childElement,
  hasNotification = false,
  action, // Add action prop for custom actions like theme toggle
}) => {
  const { notifications, markNotificationAsRead } = useNotification();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleMarkAsRead = (id) => {
    markNotificationAsRead(id);
    handleClose();
  };
  const unreadNotifications =
    notifications?.contract?.filter((n) => !n.isRead) || [];
  const sortedNotifications = [...(notifications?.contract || [])].sort(
    (a, b) => Number(!a.isRead) - Number(!b.isRead)
  );

  const renderNotifications = () =>
    sortedNotifications.length === 0 ? (
      <MenuItem disabled>No notifications</MenuItem>
    ) : (
      sortedNotifications.map((notification) => (
        <MenuItem
          key={notification._id}
          onClick={() => handleMarkAsRead(notification._id)}
          sx={{
            backgroundColor: notification.isRead ? "#f4f6f8" : "#e3f2fd",
            transition: "background-color 0.3s",
            borderBottom: "1px solid #e0e0e0",
            "&:hover": { backgroundColor: "#bbdefb" },
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <ListItemText
            primary={
              <Typography
                variant="body2"
                sx={{
                  fontWeight: notification.isRead ? "normal" : "bold",
                  color: "#37474f",
                }}
              >
                {notification.message}
              </Typography>
            }
            secondary={
              <Typography
                component="span"
                variant="caption"
                sx={{ color: "#757575" }}
              >
                {notification.payor}
              </Typography>
            }
          />
        </MenuItem>
      ))
    );

  return (
    <Box
      sx={{
        pt: 1.8,
        pb: 2,
        px: 3,
        boxShadow: 2,
        color: "white",
        backgroundImage:
          "linear-gradient(to right, rgba(55, 94, 56, 0.9) 60%, rgba(55, 94, 56, 0.7) 100%)",
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="end">
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2">{description}</Typography>
          )}
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          {childElement}
          {searchable && <TableSearchBar />}
          {action}

          {hasNotification && (
            <Tooltip title="Notifications">
              <IconButton
                color="inherit"
                onClick={handleClick}
                aria-controls="notification-menu"
                aria-haspopup="true"
                sx={{
                  backgroundColor:
                    unreadNotifications.length > 0
                      ? "rgba(255, 0, 0, 0.1)"
                      : "transparent",
                  borderRadius: "50%",
                  transition: "background-color 0.3s",
                  "&:hover": {
                    backgroundColor:
                      unreadNotifications.length > 0
                        ? "rgba(255, 0, 0, 0.2)"
                        : "rgba(0, 0, 0, 0.1)",
                  },
                }}
              >
                <Badge
                  badgeContent={unreadNotifications.length}
                  color={unreadNotifications.length > 0 ? "error" : "default"}
                >
                  <MdCircleNotifications
                    size={30}
                    style={{
                      transition: "color 0.3s",
                    }}
                  />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          <Menu
            id="notification-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            PaperProps={{
              elevation: 3,
              sx: {
                maxHeight: 300,
                overflowY: "auto",
                minWidth: 250,
                backgroundColor: "#ffffff",
              },
            }}
          >
            {renderNotifications()}
          </Menu>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardHeader;
