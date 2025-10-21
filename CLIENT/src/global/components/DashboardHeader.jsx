import {
  Badge,
  Box,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
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
  const {
    notifications = [],
    unreadCount = 0,
    markNotificationAsRead,
    markNotificationAsReadAsync,
    refreshNotifications,
    isLoading,
  } = useNotification();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    refreshNotifications();
  };

  const handleClose = () => setAnchorEl(null);

  const sortTimestamp = (value) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  };

  const sortedNotifications = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    return [...list].sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }
      return sortTimestamp(b.createdAt) - sortTimestamp(a.createdAt);
    });
  }, [notifications]);

  const unreadNotifications = useMemo(
    () => sortedNotifications.filter((notification) => !notification.isRead),
    [sortedNotifications]
  );

  const humanizeText = useCallback((value) => {
    if (!value) return "";
    return String(value)
      .replace(/^BUDGET_/i, "Budget ")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  }, []);

  const resolveActionColor = useCallback((action) => {
    const key = String(action || "").toUpperCase();
    if (key.includes("RETURN")) return "error";
    if (key.includes("APPROVE") || key.includes("FORWARD")) return "success";
    if (key.includes("SUBMIT")) return "primary";
    return "default";
  }, []);

  const navigateToLink = (link, metadata) => {
    const proposalId = metadata?.proposalId;
    if (!link && proposalId) {
      navigate(`/AllProposals?proposalId=${proposalId}`);
      return;
    }

    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      window.open(link, "_blank", "noopener");
      return;
    }

    navigate(link);
  };

  const handleNotificationSelect = async (notification) => {
    const notificationId = notification._id || notification.id;
    try {
      if (notificationId) {
        if (typeof markNotificationAsReadAsync === "function") {
          await markNotificationAsReadAsync(notificationId);
        } else if (typeof markNotificationAsRead === "function") {
          markNotificationAsRead(notificationId);
        }
      }
    } catch (error) {
      console.warn("Failed to mark notification as read", error);
    }

    handleClose();
    const targetLink = notification.relatedLink || notification.metadata?.link;
    navigateToLink(targetLink, notification.metadata);
  };

  const renderNotifications = () => {
    if (isLoading) {
      return <MenuItem disabled>Loading notifications…</MenuItem>;
    }

    if (sortedNotifications.length === 0) {
      return <MenuItem disabled>No notifications</MenuItem>;
    }

    return sortedNotifications.map((notification, index) => {
      const createdAt = notification.createdAt instanceof Date
        ? notification.createdAt
        : notification.createdAt
          ? new Date(notification.createdAt)
          : null;
      const timestampLabel = createdAt && !Number.isNaN(createdAt.valueOf())
        ? formatDistanceToNow(createdAt, { addSuffix: true })
        : "";
      const commentText = notification.metadata?.comment;
      const targetLabelRaw = notification.metadata?.targetRole || notification.metadata?.returnToLevel;
      const targetLabel = targetLabelRaw ? humanizeText(targetLabelRaw) : null;
      const actionLabelRaw = notification.metadata?.action || notification.type;
      const actionLabel = actionLabelRaw ? humanizeText(actionLabelRaw) : null;
      const performerName = notification.metadata?.performedBy?.name || notification.metadata?.performedByName;
      const fiscalYearLabel = notification.metadata?.fiscalYear ? `FY ${notification.metadata.fiscalYear}` : null;
      const budgetTypeLabel = notification.metadata?.budgetType ? humanizeText(notification.metadata.budgetType) : null;
      const chips = [
        targetLabel ? (
          <Chip
            key="target"
            label={targetLabel}
            size="small"
            variant="outlined"
            sx={{ mr: 0.5 }}
          />
        ) : null,
        actionLabel ? (
          <Chip
            key="action"
            label={actionLabel}
            size="small"
            color={resolveActionColor(notification.metadata?.action)}
            sx={{ mr: 0.5 }}
          />
        ) : null,
        fiscalYearLabel ? (
          <Chip key="fy" label={fiscalYearLabel} size="small" variant="outlined" sx={{ mr: 0.5 }} />
        ) : null,
        budgetTypeLabel ? (
          <Chip key="bt" label={budgetTypeLabel} size="small" variant="outlined" sx={{ mr: 0.5 }} />
        ) : null,
      ].filter(Boolean);

      const isUnread = !notification.isRead;

      return (
        <React.Fragment key={notification._id || notification.id}>
          <MenuItem
            onClick={() => handleNotificationSelect(notification)}
            sx={{
              alignItems: "stretch",
              py: 1.4,
              px: 1.5,
              borderRadius: 1,
              backgroundColor: isUnread ? "rgba(25,118,210,0.12)" : "transparent",
              transition: "background-color 0.3s, box-shadow 0.3s",
              "&:hover": {
                backgroundColor: isUnread ? "rgba(25,118,210,0.18)" : "rgba(0,0,0,0.04)",
                boxShadow: "inset 0 0 0 1px rgba(25,118,210,0.15)",
              },
            }}
          >
            <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
              <Box
                sx={{
                  width: 4,
                  borderRadius: 1,
                  backgroundColor: isUnread ? "primary.main" : "transparent",
                  mt: 0.25,
                  mb: 0.25,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: isUnread ? 700 : 500,
                      color: "text.primary",
                      pr: 1,
                    }}
                  >
                    {notification.title || "Notification"}
                  </Typography>
                  {timestampLabel && (
                    <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                      {timestampLabel}
                    </Typography>
                  )}
                </Box>

                {notification.message && (
                  <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
                    {notification.message}
                  </Typography>
                )}

                {commentText && (
                  <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", mt: 0.5 }}>
                    Comment: {commentText}
                  </Typography>
                )}

                {performerName && (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.75 }}>
                    From: {performerName}
                  </Typography>
                )}

                {chips.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", mt: 1 }}>
                    {chips}
                  </Box>
                )}
              </Box>
            </Box>
          </MenuItem>
          {index < sortedNotifications.length - 1 && <Divider component="li" sx={{ my: 0.25 }} />}
        </React.Fragment>
      );
    });
  };

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
                  badgeContent={unreadCount}
                  color={unreadCount > 0 ? "error" : "default"}
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

          {hasNotification && (
            <Menu
              id="notification-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                elevation: 4,
                sx: {
                  maxHeight: 360,
                  overflowY: "auto",
                  minWidth: 360,
                  maxWidth: 420,
                  backgroundColor: "#ffffff",
                  px: 0.5,
                },
              }}
            >
              {renderNotifications()}
            </Menu>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardHeader;
