import { useEffect, useMemo, useState } from "react";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  Badge,
  Tooltip,
} from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";
import { FaChevronRight } from "react-icons/fa";
import { useDrawer } from "../../context/DrawerContext";

const LinkTo = ({
  icon,
  name = "",
  link = "",
  subLinks = [],
  isAllow = false,
  notificationValue = 0,
  collapsed = false,
  ariaLabel,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleDrawer, setCollapsed, expandedMenuKey, setExpandedMenuKey } = useDrawer();
  const [open, setOpen] = useState(false);
  const isMdScreen = window.matchMedia("(max-width: 1200px)").matches;

  const isActive = location.pathname === link;

  // Allowed children: always respect each subLink's isAllow so BRD-only items stay hidden for non-BRD
  const allowedSubLinks = useMemo(() => {
    return subLinks.filter((s) => Boolean(s.isAllow));
  }, [subLinks]);

  // Promote single child to parent
  const promoteChild =
    !isAllow && allowedSubLinks.length === 1 && subLinks.length > 0;

  const promotedLink = promoteChild ? allowedSubLinks[0] : null;

  // Decide if parent renders at all
  const shouldRender =
    isAllow || allowedSubLinks.length > 0 || (!subLinks.length && isAllow);

  useEffect(() => {
    if (!promoteChild && allowedSubLinks.length > 0) {
      const activeChild = allowedSubLinks.find(
        (l) => l.link === location.pathname,
      );
      if (activeChild) setOpen(true);
    }
    return () => setOpen(false);
  }, [allowedSubLinks, location, promoteChild]);

  useEffect(() => {
    if (expandedMenuKey === name) {
      setOpen(true);
      setExpandedMenuKey?.(null);
    }
  }, [expandedMenuKey, name]);

  if (!shouldRender) return null;

  const itemSx = {
    borderRadius: "12px",
    mb: 0.5,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    color: "rgba(255,255,255,0.6)",
    px: collapsed ? 0 : 2,
    py: 1,
    minHeight: 48,
    cursor: "pointer",
    "& .MuiListItemIcon-root": {
      color: "inherit",
      minWidth: collapsed ? 0 : 38,
      display: "flex",
      justifyContent: "center",
      transition: "all 0.3s ease",
    },
    "& .MuiTypography-root": {
      fontWeight: 500,
      fontSize: "0.875rem",
      whiteSpace: "nowrap",
    },
    "&:hover": { 
      bgcolor: "rgba(255,255,255,0.05)",
      color: "white",
      "& .MuiListItemIcon-root": { color: "white" }
    },
    ...(isActive && {
      bgcolor: "rgba(255,255,255,0.1) !important",
      color: "#4ade80",
      fontWeight: 600,
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        height: "60%",
        width: 4,
        bgcolor: "#4ade80",
        borderRadius: "0 4px 4px 0",
      },
      "& .MuiListItemIcon-root": { color: "#4ade80" }
    }),
    ...(collapsed && { 
      justifyContent: "center", 
      width: 44,
      mx: "auto",
      borderRadius: "12px",
    }),
  };

  const tooltipSx = {
    tooltip: {
      sx: {
        bgcolor: "rgba(0, 0, 0, 0.9)",
        fontSize: "0.875rem",
        fontWeight: 500,
        "& .MuiTooltip-arrow": { color: "rgba(0, 0, 0, 0.9)" },
      },
    },
  };

  /* ===============================
     COLLAPSED: ICON + TOOLTIP + SUBMENU INDICATOR (click expands drawer instead of floating menu)
     =============================== */
  if (collapsed) {
    const label = promoteChild && promotedLink ? promotedLink.name : name;
    const to = promoteChild && promotedLink ? promotedLink.link : link;
    const hasDirectLink = Boolean(to);
    const hasSubMenu = allowedSubLinks.length > 0;
    const active =
      (promoteChild && promotedLink && location.pathname === promotedLink.link) ||
      (!promoteChild && link && location.pathname === link) ||
      (!promoteChild && hasSubMenu && allowedSubLinks.some((s) => s.link === location.pathname));

    const handleCollapsedClick = (e) => {
      if (hasSubMenu) {
        e.preventDefault();
        setExpandedMenuKey?.(name);
        setCollapsed?.(false);
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
          bgcolor: active ? "#2d5a3f" : "transparent",
          color: active ? "white" : "rgba(255,255,255,0.7)",
          cursor: "pointer",
          position: "relative",
          px: 0,
          width: 44,
          mx: "auto",
          display: "flex",
          justifyContent: "center",
          minHeight: 44,
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, display: "flex", justifyContent: "center" }}>
          {promoteChild && promotedLink ? promotedLink.icon || icon : icon}
        </ListItemIcon>
        {hasSubMenu && (
          <FaChevronRight
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.7rem",
            }}
          />
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
    return (
      <Tooltip
        title={label}
        placement="right"
        arrow
        slotProps={tooltipSx}
      >
        {content}
      </Tooltip>
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
          bgcolor: active ? "#2d5a3f !important" : "transparent",
          color: active ? "white" : "rgba(255,255,255,0.7)",
        }}
      >
        <ListItemIcon>
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
          bgcolor: isActive ? "#2d5a3f !important" : "transparent",
          color: isActive ? "white" : "rgba(255,255,255,0.7)",
        }}
      >
        <ListItemIcon>{icon}</ListItemIcon>
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
                  <ListItemIcon>
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
};

export default LinkTo;
