// LinkTo.js
import React, { useEffect, useState } from "react";
import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  List,
  Tooltip,
  Paper,
  Box,
  ClickAwayListener,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { IoMdArrowDropdown, IoMdArrowDropup } from "react-icons/io";

const LinkTo = ({ 
  icon, 
  name = "", 
  link = "", 
  subLinks, 
  isAllow, 
  collapsed = false,
}) => {
  const location = useLocation();
  const isActive = location.pathname === link; // Check if the current path matches the link
  const [open, setOpen] = useState(false); // State to manage sub-link visibility
  const [hoverMenuOpen, setHoverMenuOpen] = useState(false); // State for hover menu in collapsed mode
  const [menuPosition, setMenuPosition] = useState({ top: 0 });

  const handleToggle = () => setOpen(!open);

  const handleMouseEnter = (event) => {
    if (collapsed && subLinks) {
      const rect = event.currentTarget.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const menuHeight = subLinks.length * 48 + 60; // Approximate height

      // Adjust position if menu would go off-screen
      let topPosition = rect.top;
      if (topPosition + menuHeight > windowHeight) {
        topPosition = Math.max(10, windowHeight - menuHeight);
      }

      setMenuPosition({ top: topPosition });
      setHoverMenuOpen(true);
    }
  };
  
  const handleMouseLeave = () => {
    if (collapsed) {
      setHoverMenuOpen(false);
    }
  };

  useEffect(() => {
    if (subLinks) {
      const subActive = subLinks.find((l) => l.link === location.pathname);
      if (subActive) setOpen(true);
    }
    return () => setOpen(false);
  }, [subLinks, location]);

  const renderListItem = () => (
    <ListItem
      component={link ? Link : "div"} // Use Link for navigation if link is provided
      to={link}
      onClick={subLinks && !collapsed ? handleToggle : undefined} // Toggle sub-links on click if they exist (disabled when collapsed)
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        bgcolor: isActive ? "rgba(250,250,250,.2)" : "transparent",
        "&:hover": {
          bgcolor: "rgba(250,250,250,.2)",
        },
        justifyContent: collapsed ? "center" : "flex-start",
        px: collapsed ? 1 : 2,
        py: collapsed ? 2 : 1.5,
        borderRadius: collapsed ? "12px" : "8px",
        mx: collapsed ? 1 : 0,
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <ListItemIcon
        sx={{
          color: "white",
          minWidth: collapsed ? "auto" : 56,
          justifyContent: "center",
          fontSize: collapsed ? "1.8rem" : "1.3rem",
          transition: "all 0.2s ease",
          position: "relative",
          "&:hover": {
            transform: collapsed ? "scale(1.1)" : "scale(1.05)",
            color: "#e8f5e8",
          }
        }}
      >
        {React.cloneElement(icon, { size: collapsed ? 28 : 22 })}
        {/* Small indicator for items with submenus when collapsed */}
        {collapsed && subLinks && (
          <Box
            sx={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              bgcolor: "#4caf50",
              borderRadius: "50%",
              border: "1px solid white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        )}
      </ListItemIcon>
      {!collapsed && (
        <>
          <ListItemText
            primary={name}
            sx={{
              color: "white",
              "& .MuiListItemText-primary": {
                fontSize: "0.95rem",
                fontWeight: 500,
              }
            }}
          />
          {subLinks && (
            !open ? (
              <IoMdArrowDropdown style={{ color: "white", fontSize: "1.2rem" }} />
            ) : (
              <IoMdArrowDropup style={{ color: "white", fontSize: "1.2rem" }} />
            )
          )}
        </>
      )}
    </ListItem>
  );

  // Render hover submenu for collapsed state
  const renderHoverSubmenu = () => (
    <Paper
      sx={{
        position: "fixed",
        left: 85,
        top: menuPosition.top,
        zIndex: 1300,
        minWidth: 220,
        maxWidth: 300,
        bgcolor: "rgba(55,94,56,0.95)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 2,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        py: 1,
        animation: "slideIn 0.2s ease-out",
        "@keyframes slideIn": {
          from: {
            opacity: 0,
            transform: "translateX(-10px)",
          },
          to: {
            opacity: 1,
            transform: "translateX(0)",
          },
        },
      }}
      onMouseEnter={() => setHoverMenuOpen(true)}
      onMouseLeave={() => setHoverMenuOpen(false)}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {React.cloneElement(icon, { size: 18, color: "white" })}
          <Box sx={{ color: "white", fontWeight: 600, fontSize: "0.9rem" }}>
            {name}
          </Box>
        </Box>
      </Box>
      <List sx={{ py: 0 }}>
        {subLinks?.filter(subLink => subLink.isAllow !== false).map((subLink) => (
          <ListItem
            key={subLink.link}
            component={Link}
            to={subLink.link}
            onClick={() => setHoverMenuOpen(false)}
            sx={{
              "&:hover": {
                bgcolor: "rgba(250,250,250,.2)",
              },
              bgcolor:
                location.pathname === subLink.link
                  ? "rgba(250,250,250,.2)"
                  : "transparent",
              py: 1,
              px: 2,
            }}
          >
            <ListItemIcon
              sx={{
                color: "white",
                minWidth: 40,
                fontSize: "1rem",
              }}
            >
              {React.cloneElement(subLink.icon, { size: 16 })}
            </ListItemIcon>
            <ListItemText
              primary={subLink.name}
              sx={{
                color: "white",
                "& .MuiListItemText-primary": {
                  fontSize: "0.85rem",
                  fontWeight: 400,
                }
              }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );

  return (
    <>
      {isAllow ? (
        <Box sx={{ position: "relative" }}>
          {collapsed && subLinks ? (
            <ClickAwayListener onClickAway={() => setHoverMenuOpen(false)}>
              <Box>
                <Tooltip
                  title={`${name} (hover for submenu)`}
                  placement="right"
                  arrow
                  componentsProps={{
                    tooltip: {
                      sx: {
                        bgcolor: 'rgba(0, 0, 0, 0.9)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        '& .MuiTooltip-arrow': {
                          color: 'rgba(0, 0, 0, 0.9)',
                        },
                      },
                    },
                  }}
                >
                  {renderListItem()}
                </Tooltip>
                {hoverMenuOpen && renderHoverSubmenu()}
              </Box>
            </ClickAwayListener>
          ) : collapsed ? (
            <Tooltip
              title={name}
              placement="right"
              arrow
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: 'rgba(0, 0, 0, 0.9)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    '& .MuiTooltip-arrow': {
                      color: 'rgba(0, 0, 0, 0.9)',
                    },
                  },
                },
              }}
            >
              {renderListItem()}
            </Tooltip>
          ) : (
            renderListItem()
          )}
        </Box>
      ) : undefined}

      {subLinks && !collapsed && (
        <Collapse 
          in={open} 
          timeout="auto" 
          unmountOnExit 
          sx={{ 
            ml: 3
          }}
        >
          <List component="div" disablePadding>
            {subLinks.filter(subLink => subLink.isAllow !== false).map((subLink) =>
              isAllow || subLink.isAllow ? (
                <ListItem
                  key={subLink.link}
                  component={Link}
                  to={subLink.link}
                  onClick={() => {}}
                  sx={{
                    "&:hover": {
                      bgcolor: "rgba(250,250,250,.2)",
                    },
                    borderLeft: "1px solid rgba(250,250,250,0.3)",
                    bgcolor:
                      location.pathname === subLink.link
                        ? "rgba(250,250,250,.2)"
                        : "transparent",
                    py: 1,
                    transition: 'all 200ms ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: "white",
                      minWidth: 48,
                      fontSize: "1.1rem",
                    }}
                  >
                    {React.cloneElement(subLink.icon, { size: 18 })}
                  </ListItemIcon>
                  <ListItemText
                    primary={subLink.name}
                    sx={{
                      color: "white",
                      "& .MuiListItemText-primary": {
                        fontSize: "0.875rem",
                        fontWeight: 400,
                      }
                    }}
                  />
                </ListItem>
              ) : undefined
            )}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default LinkTo;
