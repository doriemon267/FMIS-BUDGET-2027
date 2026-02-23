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
    bgcolor: "transparent",
    borderTop: "1px solid rgba(250,250,250,0.1)",
    borderBottom: "1px solid rgba(250,250,250,0.1)",
    "&:hover": { bgcolor: "rgba(250,250,250,.2)" },
    ...(collapsed && { justifyContent: "center", minHeight: 48 }),
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
          bgcolor: active ? "rgba(250,250,250,.2)" : "transparent",
          cursor: hasSubMenu ? "pointer" : undefined,
          position: "relative",
        }}
      >
        <ListItemIcon sx={{ color: "white", minWidth: 0, justifyContent: "center" }}>
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
        title={hasSubMenu ? `${label}` : label}
        placement="right"
        arrow
        componentsProps={tooltipSx}
      >
        <span style={{ display: "block" }}>{content}</span>
      </Tooltip>
    );
  }

  /* ===============================
     SINGLE CHILD BECOMES PARENT
     =============================== */
  if (promoteChild && promotedLink) {
    return (
      <ListItem
        component={Link}
        to={promotedLink.link}
        onClick={() => isMdScreen && setTimeout(() => toggleDrawer(), 300)}
        aria-label={ariaLabel || `Go to ${promotedLink.name}`}
        sx={{
          ...itemSx,
          bgcolor:
            location.pathname === promotedLink.link
              ? "rgba(250,250,250,.2)"
              : "transparent",
        }}
      >
        <ListItemIcon sx={{ color: "white" }}>
          {promotedLink.icon || icon}
        </ListItemIcon>
        <ListItemText primary={promotedLink.name} sx={{ color: "white" }} />

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
          bgcolor: isActive ? "rgba(250,250,250,.2)" : "transparent",
        }}
      >
        <ListItemIcon sx={{ color: "white" }}>{icon}</ListItemIcon>
        <ListItemText primary={name} sx={{ color: "white" }} />

        {notificationValue > 0 && (
          <Badge
            badgeContent={notificationValue}
            color="error"
            sx={{ mr: 1 }}
          />
        )}

        {subLinks.length > 0 &&
          (effectiveOpen ? (
            <IoMdArrowDropup style={{ color: "white" }} />
          ) : (
            <IoMdArrowDropdown style={{ color: "white" }} />
          ))}
      </ListItem>

      {subLinks.length > 0 && (
        <Collapse in={effectiveOpen} timeout="auto" unmountOnExit sx={{ ml: 3 }}>
          <List component="div" disablePadding>
            {allowedSubLinks.map((subLink) => (
              <ListItem
                key={subLink.link}
                component={Link}
                to={subLink.link}
                onClick={() => {
                  setExpandedMenuKey?.(null);
                  isMdScreen && setTimeout(() => toggleDrawer(), 300);
                }}
                sx={{
                  borderTop: "1px solid rgba(250,250,250,0.1)",
                  borderLeft: "1px solid rgba(250,250,250,0.1)",
                  "&:hover": { bgcolor: "rgba(250,250,250,.2)" },
                  bgcolor:
                    location.pathname === subLink.link
                      ? "rgba(250,250,250,.2)"
                      : "transparent",
                }}
              >
                <ListItemIcon sx={{ color: "white" }}>
                  {subLink.icon}
                </ListItemIcon>
                <ListItemText primary={subLink.name} sx={{ color: "white" }} />
              </ListItem>
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default LinkTo;
