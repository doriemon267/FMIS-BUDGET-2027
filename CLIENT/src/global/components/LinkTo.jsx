import { useEffect, useMemo, useState } from "react";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { FaChevronRight } from "react-icons/fa";
import { useDrawer } from "../../context/DrawerContext";

const LinkTo = ({
  icon,
  name,
  link,
  isAllow = true,
  collapsed = false,
  subLinks = [],
  notificationValue = 0,
  ariaLabel,
  itemSx = {},
  tooltipSx = {},
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMdScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { toggleDrawer, expandedMenuKey, setExpandedMenuKey } = useDrawer();

  const [open, setOpen] = useState(false);
  const [flyoutAnchorEl, setFlyoutAnchorEl] = useState(null);

  const allowedSubLinks = useMemo(
    () => subLinks.filter((s) => s.isAllow !== false),
    [subLinks]
  );

  const promoteChild = useMemo(
    () => allowedSubLinks.length === 1 && !link,
    [allowedSubLinks, link]
  );

  const promotedLink = promoteChild ? allowedSubLinks[0] : null;

  const isActive = useMemo(() => {
    if (link && location.pathname === link) return true;
    return allowedSubLinks.some((s) => s.link === location.pathname);
  }, [link, location.pathname, allowedSubLinks]);

  if (!isAllow) return null;

  if (collapsed) {
    const label = promoteChild && promotedLink ? promotedLink.name : name;
    const to = promoteChild && promotedLink ? promotedLink.link : link;
    const hasDirectLink = Boolean(to);
    const hasSubMenu = allowedSubLinks.length > 0;
    const active = isActive;

    const handleCloseFlyout = () => {
      setFlyoutAnchorEl(null);
    };

    const handleCollapsedClick = (e) => {
      if (hasSubMenu) {
        e.preventDefault();
        e.stopPropagation();
        setFlyoutAnchorEl((prev) => (prev ? null : e.currentTarget));
      } else if (hasDirectLink && isMdScreen) {
        setTimeout(() => toggleDrawer(), 300);
      }
    };

    const content = (
      <ListItem
        component={hasDirectLink && !hasSubMenu ? Link : "div"}
        {...(hasDirectLink && !hasSubMenu && { to })}
        onClick={hasSubMenu ? handleCollapsedClick : undefined}
        aria-label={ariaLabel || (hasSubMenu ? `Expand ${label} menu` : `Go to ${label}`)}
        sx={{
          ...itemSx,
          bgcolor: active ? "rgba(74, 222, 128, 0.22)" : "transparent",
          color: active ? "#4ade80" : "rgba(255,255,255,0.7)",
          cursor: "pointer",
          position: "relative",
          px: 0,
          width: 44,
          mx: "auto",
          display: "flex",
          justifyContent: "center",
          minHeight: 44,
          borderRadius: "12px",
          transition: "all 0.3s ease",
          "&:hover": {
            bgcolor: active ? "rgba(74, 222, 128, 0.3)" : "rgba(255,255,255,0.08)",
            color: "white",
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, display: "flex", justifyContent: "center", color: "inherit" }}>
          {promoteChild && promotedLink ? promotedLink.icon || icon : icon}
        </ListItemIcon>
        {hasSubMenu && (
          <span
            style={{
              position: "absolute",
              right: 2,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(74, 222, 128, 0.22)",
              border: "1px solid rgba(74, 222, 128, 0.45)",
              boxShadow: "0 0 0 1px rgba(5, 31, 18, 0.35)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            <FaChevronRight style={{ color: "#86efac", fontSize: "0.48rem" }} />
          </span>
        )}
        {notificationValue > 0 && (
          <Badge
            badgeContent={notificationValue}
            color="error"
            sx={{ position: "absolute", top: 4, right: 4 }}
          />
        )}
      </ListItem>
    );

    const effectiveTooltipSx = {
      tooltip: {
        sx: {
          bgcolor: "rgba(0, 0, 0, 0.95)",
          fontSize: "0.84rem",
          fontWeight: 600,
          backdropFilter: "blur(8px)",
          borderRadius: "10px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          px: 1.5,
          py: 0.8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          "& .MuiTooltip-arrow": { color: "rgba(0, 0, 0, 0.95)" },
          ...tooltipSx.tooltip?.sx,
        },
      },
      ...tooltipSx,
    };

    return (
      <>
        <Tooltip
          title={label}
          placement="right"
          arrow
          slotProps={effectiveTooltipSx}
        >
          {content}
        </Tooltip>

        {hasSubMenu && (
          <Menu
            anchorEl={flyoutAnchorEl}
            open={Boolean(flyoutAnchorEl)}
            onClose={handleCloseFlyout}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            disableAutoFocusItem
            MenuListProps={{ autoFocusItem: false }}
            PaperProps={{
              sx: {
                mt: -0.5,
                ml: 1,
                minWidth: 240,
                borderRadius: "14px",
                border: "1px solid rgba(74, 222, 128, 0.25)",
                background: "linear-gradient(180deg, rgba(5,31,18,0.98), rgba(6,26,17,0.98))",
                backdropFilter: "blur(10px)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                py: 0.75,
              },
            }}
          >
            {allowedSubLinks.map((subLink) => {
              const subActive = location.pathname === subLink.link;
              return (
                <MenuItem
                  key={subLink.link}
                  selected={subActive}
                  onClick={() => {
                    navigate(subLink.link);
                    handleCloseFlyout();
                  }}
                  sx={{
                    mx: 0.75,
                    borderRadius: "10px",
                    minHeight: 42,
                    color: subActive ? "#fff" : "rgba(255,255,255,0.78)",
                    bgcolor: subActive ? "rgba(74, 222, 128, 0.22)" : "transparent",
                    "&:hover": {
                      bgcolor: "rgba(74, 222, 128, 0.14)",
                    },
                    "&.Mui-selected": {
                      bgcolor: "rgba(74, 222, 128, 0.22)",
                    },
                    "& .MuiListItemIcon-root": {
                      minWidth: 34,
                      color: "inherit",
                    },
                    "& .MuiListItemText-primary": {
                      fontSize: "0.84rem",
                      fontWeight: subActive ? 700 : 500,
                    },
                  }}
                >
                  <ListItemIcon>{subLink.icon}</ListItemIcon>
                  <ListItemText primary={subLink.name} />
                </MenuItem>
              );
            })}
          </Menu>
        )}
      </>
    );
  }

  /* ===============================
     SINGLE CHILD BECOMES PARENT
     =============================== */
  if (promoteChild && promotedLink) {
    const active = location.pathname === promotedLink.link;
    return (
      <ListItem
        component={Link}
        to={promotedLink.link}
        onClick={() => isMdScreen && setTimeout(() => toggleDrawer(), 300)}
        aria-label={ariaLabel || `Go to ${promotedLink.name}`}
        sx={{
          ...itemSx,
          bgcolor: active ? "rgba(74, 222, 128, 0.22) !important" : "transparent",
          color: active ? "#4ade80" : "rgba(255,255,255,0.7)",
          borderRadius: "12px",
          mb: 0.5,
          transition: "all 0.2s ease",
          "&:hover": {
            bgcolor: active ? "rgba(74, 222, 128, 0.3)" : "rgba(255,255,255,0.08)",
            color: "white",
          },
        }}
      >
        <ListItemIcon sx={{ color: "inherit" }}>
          {promotedLink.icon || icon}
        </ListItemIcon>
        <ListItemText primary={promotedLink.name} />

        {notificationValue > 0 && (
          <Badge
            badgeContent={notificationValue}
            color="error"
            sx={{ mr: 1 }}
          />
        )}
      </ListItem>
    );
  }

  /* ===============================
     NORMAL PARENT WITH DROPDOWN
     =============================== */
  const effectiveOpen = open || (expandedMenuKey === name);

  return (
    <>
      <ListItem
        component={link && !subLinks.length ? Link : "div"}
        to={link}
        aria-label={ariaLabel || (subLinks.length ? `Expand ${name} menu` : `Go to ${name}`)}
        onClick={(e) => {
          if (subLinks.length) {
            e.preventDefault();
            setOpen((prev) => !prev);
          } else if (isMdScreen) {
            setTimeout(() => toggleDrawer(), 300);
          }
        }}
        sx={{
          ...itemSx,
          bgcolor: isActive ? "rgba(74, 222, 128, 0.22) !important" : "transparent",
          color: isActive ? "#4ade80" : "rgba(255,255,255,0.7)",
          borderRadius: "12px",
          mb: 0.5,
          transition: "all 0.2s ease",
          "&:hover": {
            bgcolor: isActive ? "rgba(74, 222, 128, 0.3)" : "rgba(255,255,255,0.08)",
            color: "white",
          },
        }}
      >
        <ListItemIcon sx={{ color: "inherit" }}>{icon}</ListItemIcon>
        <ListItemText primary={name} />

        {notificationValue > 0 && (
          <Badge
            badgeContent={notificationValue}
            color="error"
            sx={{ mr: 1 }}
          />
        )}

        {subLinks.length > 0 &&
          (effectiveOpen ? (
            <IoMdArrowDropup />
          ) : (
            <IoMdArrowDropdown />
          ))}
      </ListItem>

      {subLinks.length > 0 && (
        <Collapse in={effectiveOpen} timeout="auto" unmountOnExit sx={{ ml: 2 }}>
          <List component="div" disablePadding>
            {allowedSubLinks.map((subLink) => {
              const subActive = location.pathname === subLink.link;
              return (
                <ListItem
                  key={subLink.link}
                  component={Link}
                  to={subLink.link}
                  onClick={() => {
                    setExpandedMenuKey?.(null);
                    isMdScreen && setTimeout(() => toggleDrawer(), 300);
                  }}
                  sx={{
                    borderRadius: "10px",
                    mb: 0.5,
                    transition: "all 0.2s ease",
                    color: subActive ? "white" : "rgba(255,255,255,0.6)",
                    bgcolor: subActive ? "rgba(255,255,255,0.1)" : "transparent",
                    cursor: "pointer",
                    "& .MuiListItemIcon-root": {
                      color: "inherit",
                      minWidth: 35,
                    },
                    "& .MuiTypography-root": {
                      fontSize: "0.85rem",
                      fontWeight: subActive ? 600 : 400,
                    },
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.05)",
                      color: "white",
                    },
                    pl: 2,
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit" }}>
                    {subLink.icon}
                  </ListItemIcon>
                  <ListItemText primary={subLink.name} />
                </ListItem>
              );
            })}
          </List>
        </Collapse>
      )}
    </>
  );
}

export default LinkTo;
