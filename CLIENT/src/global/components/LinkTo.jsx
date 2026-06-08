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
  useTheme,
  Box
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LuChevronDown, LuChevronUp, LuChevronRight } from "react-icons/lu";
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

  const hasActualLinks = useMemo(
    () => allowedSubLinks.some((s) => !s.isDivider),
    [allowedSubLinks]
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
  
  // If this item is meant to be a parent (has subLinks) but NONE of the subLinks are allowed (excluding dividers),
  // we completely hide the parent item.
  if (subLinks.length > 0 && !hasActualLinks) return null;

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
        component={hasDirectLink && !hasSubMenu ? (to.startsWith("http") ? "a" : Link) : "div"}
        {...(hasDirectLink && !hasSubMenu && (to.startsWith("http") ? { href: to, target: "_blank" } : { to }))}
        onClick={hasSubMenu ? handleCollapsedClick : undefined}
        aria-label={ariaLabel || (hasSubMenu ? `Expand ${label} menu` : `Go to ${label}`)}
        sx={{
          ...itemSx,
          bgcolor: active ? "rgba(255, 255, 255, 0.1) !important" : "transparent",
          color: active ? "white" : "rgba(255,255,255,0.75)",
          cursor: "pointer",
          position: "relative",
          px: 0,
          width: 40,
          mx: "auto",
          display: "flex",
          justifyContent: "center",
          minHeight: 40,
          borderRadius: "8px",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            bgcolor: active ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
            color: "white",
            "& .MuiListItemIcon-root": {
              opacity: 1,
            }
          },
        }}
      >
        <ListItemIcon sx={{ 
          minWidth: 0, 
          display: "flex", 
          justifyContent: "center", 
          color: "inherit",
          opacity: active ? 1 : 0.75,
          transition: "all 0.2s",
        }}>
          {promoteChild && promotedLink ? promotedLink.icon || icon : icon}
        </ListItemIcon>
        {hasSubMenu && (
          <span
            style={{
              position: "absolute",
              right: 2,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.4,
            }}
            aria-hidden="true"
          >
            <LuChevronRight style={{ color: "white", fontSize: "0.7rem" }} />
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
                ml: 2.5,
                minWidth: 240,
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#0f1a12",
                backdropFilter: "blur(10px)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                py: 0.75,
              },
            }}
          >
            {allowedSubLinks.map((subLink, index) => {
              if (subLink.isDivider) {
                return (
                  <Box key={`div-${index}`} sx={{ my: 1, mx: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
                );
              }
              const subActive = location.pathname === subLink.link;
              return (
                <MenuItem
                  key={subLink.link}
                  selected={subActive}
                  onClick={() => {
                    if (subLink.link.startsWith("http")) {
                      window.open(subLink.link, "_blank");
                    } else {
                      navigate(subLink.link);
                    }
                    handleCloseFlyout();
                  }}
                  sx={{
                    mx: 0.75,
                    borderRadius: "8px",
                    minHeight: 40,
                    color: subActive ? "white" : "rgba(255,255,255,0.75)",
                    bgcolor: subActive ? "rgba(255, 255, 255, 0.1) !important" : "transparent",
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.08)",
                      color: "white",
                    },
                    "&.Mui-selected": {
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                    },
                    "& .MuiListItemIcon-root": {
                      minWidth: 34,
                      color: "inherit",
                      opacity: subActive ? 1 : 0.75,
                    },
                    "& .MuiListItemText-primary": {
                      fontSize: "0.8rem",
                      fontWeight: subActive ? 600 : 500,
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
        component={promotedLink.link.startsWith("http") ? "a" : Link}
        {...(promotedLink.link.startsWith("http") ? { href: promotedLink.link, target: "_blank" } : { to: promotedLink.link })}
        onClick={() => {
          if (setExpandedMenuKey) setExpandedMenuKey(null);
          if (isMdScreen) setTimeout(() => toggleDrawer(), 300);
        }}
        aria-label={ariaLabel || `Go to ${promotedLink.name}`}
        sx={{
          ...itemSx,
          bgcolor: active ? "rgba(255, 255, 255, 0.1) !important" : "transparent",
          color: active ? "white" : "rgba(255,255,255,0.75)",
          borderRadius: "8px",
          mb: 0.5,
          py: 1.25,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
          "&:hover": {
            bgcolor: active ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
            color: "white",
            "& .MuiListItemIcon-root": {
              opacity: 1,
            }
          },
        }}
      >
        <ListItemIcon sx={{ 
          color: "inherit",
          opacity: active ? 1 : 0.75,
          transition: "all 0.2s",
        }}>
          {promotedLink.icon || icon}
        </ListItemIcon>
        <ListItemText 
          primary={promotedLink.name} 
          primaryTypographyProps={{
            fontSize: "0.85rem",
            fontWeight: active ? 600 : 500,
            letterSpacing: "0.01em",
          }}
        />

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
  const effectiveOpen = setExpandedMenuKey ? (expandedMenuKey === name) : open;

  return (
    <>
      <ListItem
        component={link && !subLinks.length ? (link.startsWith("http") ? "a" : Link) : "div"}
        {...(link && !subLinks.length ? (link.startsWith("http") ? { href: link, target: "_blank" } : { to: link }) : {})}
        aria-label={ariaLabel || (subLinks.length ? `Expand ${name} menu` : `Go to ${name}`)}
        onClick={(e) => {
          if (subLinks.length) {
            e.preventDefault();
            if (setExpandedMenuKey) {
              setExpandedMenuKey(expandedMenuKey === name ? null : name);
            } else {
              setOpen((prev) => !prev);
            }
          } else {
            if (setExpandedMenuKey) setExpandedMenuKey(null);
            if (isMdScreen) setTimeout(() => toggleDrawer(), 300);
          }
        }}
        sx={{
          ...itemSx,
          bgcolor: isActive ? "rgba(255, 255, 255, 0.1) !important" : "transparent",
          color: isActive ? "white" : "rgba(255,255,255,0.75)",
          borderRadius: "8px",
          mb: 0.5,
          py: 1.25,
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          position: "relative",
          "&:hover": {
            bgcolor: isActive ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.05)",
            color: "white",
            "& .MuiListItemIcon-root": {
              opacity: 1,
            }
          },
        }}
      >
        <ListItemIcon sx={{ 
          color: "inherit",
          opacity: isActive ? 1 : 0.75,
          transition: "all 0.2s",
        }}>
          {icon}
        </ListItemIcon>
        <ListItemText 
          primary={name} 
          primaryTypographyProps={{
            fontSize: "0.85rem",
            fontWeight: isActive ? 600 : 500,
            letterSpacing: "0.01em",
          }}
        />

        {notificationValue > 0 && (
          <Badge
            badgeContent={notificationValue}
            color="error"
            sx={{ mr: 1 }}
          />
        )}

        {subLinks.length > 0 && (
          <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
            {effectiveOpen ? (
              <LuChevronUp style={{ opacity: 0.4 }} />
            ) : (
              <LuChevronDown style={{ opacity: 0.4 }} />
            )}
          </span>
        )}
      </ListItem>

      {subLinks.length > 0 && (
        <Collapse in={effectiveOpen} timeout="auto" unmountOnExit sx={{ ml: 2 }}>
          <List component="div" disablePadding>
            {allowedSubLinks.map((subLink, index) => {
              if (subLink.isDivider) {
                return (
                  <Box key={`div-${index}`} sx={{ my: 1, mx: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
                );
              }
              const subActive = location.pathname === subLink.link;
              return (
                <ListItem
                  key={subLink.link}
                  component={subLink.link.startsWith("http") ? "a" : Link}
                  {...(subLink.link.startsWith("http") ? { href: subLink.link, target: "_blank" } : { to: subLink.link })}
                  onClick={() => {
                    setExpandedMenuKey?.(null);
                    isMdScreen && setTimeout(() => toggleDrawer(), 300);
                  }}
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: subActive ? "white" : "rgba(255,255,255,0.75)",
                    bgcolor: subActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    cursor: "pointer",
                    py: 1,
                    "& .MuiListItemIcon-root": {
                      color: "inherit",
                      opacity: subActive ? 1 : 0.75,
                      minWidth: 35,
                    },
                    "& .MuiTypography-root": {
                      fontSize: "0.8rem",
                      fontWeight: subActive ? 600 : 400,
                      letterSpacing: "0.01em",
                    },
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "white",
                      "& .MuiListItemIcon-root": {
                        opacity: 1,
                      }
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
