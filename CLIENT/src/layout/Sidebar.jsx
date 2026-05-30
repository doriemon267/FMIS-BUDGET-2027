import { useEffect, useState } from "react";
import { Box, Collapse, IconButton, Typography, Tooltip, useTheme } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import {
  LuChevronLeft,
  LuLogOut,
  LuChevronDown,
  LuShieldCheck,
  LuBarChart3,
  LuFileText,
  LuReceipt,
  LuPenTool,
  LuArrowLeftRight,
  LuBanknote,
  LuPiggyBank,
  LuCalendarDays,
  LuSignature,
  LuSettings,
  LuWallet,
  LuHandCoins,
  LuBookmark,
  LuLayoutDashboard,
  LuLink,
  LuUsers,
  LuCoins,
  LuContact,
} from "react-icons/lu";

import { useDrawer } from "../context/DrawerContext";
import { useUser } from "../context/UserContext";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import {
  isAccountingRoles,
  isAllowAdminsOnly,
  isBudgetRoles,
  isCashRoles,
  isPersonnel,
  isSuperAdmin,
} from "../utils/checkRole";
import env from "../utils/env";

export default function Sidebar() {
  const location = useLocation();
  const { currentUser, logout } = useUser();
  const { open, toggleDrawer, setOpen } = useDrawer();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [expandedMenus, setExpandedMenus] = useState({});
  const [tooltip, setTooltip] = useState({ visible: false, title: "", top: 0 });

  const [isRolesExpanded, setIsRolesExpanded] = useState(false);

  const rolesList = currentUser?.Roles || [];
  const hasMultipleRoles = rolesList.length > 1;
  const primaryRoleRaw = rolesList[0] || (isSuperAdmin(currentUser) ? "Admin" : "User");

  const formatRole = (role) => {
    if (!role || typeof role !== "string") return "User";
    const label = role.toLowerCase().includes("super") ? "Admin" : role;
    return label.length > 15 ? label.slice(0, 15) + "..." : label;
  };

  // Mapped from your old LinkTo configuration
  const navItems = [
    {
      title: "Dashboard",
      path: "/dashboard",
      icon: LuLayoutDashboard,
      isAllow: true, // Replicating old logic where Dashboard was unconditionally allowed via "isAllow" prop
    },
    {
      title: "Roles Management",
      icon: LuSettings,
      isAllow: isSuperAdmin(currentUser),
      subItems: [
        { title: "Roles", path: "/roles", isAllow: isSuperAdmin(currentUser) },
        {
          title: "Assigned Roles",
          path: "/roles/assigned-roles",
          isAllow: isAllowAdminsOnly(currentUser),
        },
      ],
    },
    {
      title: "Signatories Management",
      icon: LuPenTool,
      isAllow: true,
      subItems: [
        { title: "Signatories", path: "/signatories", isAllow: true },
        {
          title: "Create Signatory",
          path: "/signatories/create",
          isAllow: true,
        },
      ],
    },
    {
      title: "Payors",
      path: "/payors",
      icon: LuUsers,
      isAllow: isCashRoles(currentUser) || isAccountingRoles(currentUser),
    },
    {
      title: "Payees",
      path: "/payees",
      icon: LuHandCoins,
      isAllow: isAccountingRoles(currentUser) || isSuperAdmin(currentUser),
    },
    {
      title: "Contracts",
      path: "/contracts",
      icon: LuFileText,
      isAllow: isCashRoles(currentUser) || isAccountingRoles(currentUser),
    },
    {
      title: "Nature Of Collections",
      path: "/nature-of-collections",
      icon: LuBookmark,
      isAllow: isPersonnel, // Assuming this is evaluated as a boolean/constant in your checkRole
    },
    {
      title: "Fund Clusters",
      path: "/fund-clusters",
      icon: LuCoins,
      isAllow: isCashRoles(currentUser) || isAccountingRoles(currentUser),
    },
    {
      title: "Chart Of Accounts",
      icon: LuBarChart3,
      isAllow: isAccountingRoles(currentUser),
      subItems: [
        {
          title: "Table",
          path: "/chart-of-accounts",
          isAllow: isAccountingRoles(currentUser),
        },
        {
          title: "History Logs",
          path: "/chart-of-accounts/logs",
          isAllow: isAccountingRoles(currentUser),
        },
      ],
    },
    {
      title: "Calendar",
      path: "/date-calendar",
      icon: LuCalendarDays,
      isAllow: isAccountingRoles(currentUser),
    },
    {
      title: "E Signature",
      path: "/e-signature",
      icon: LuSignature,
      isAllow:
        isAccountingRoles(currentUser) ||
        isBudgetRoles(currentUser) ||
        isCashRoles(currentUser),
    },
    { isDivider: true },
    {
      title: "FMIS Subsystems",
      icon: LuLink,
      isAllow: true,
      subItems: [
        {
          title: "OSBPIS",
          path: IS_PRODUCTION
            ? env("BUDGET_URL_PROD") + "/dashboard"
            : env("BUDGET_URL_DEV") + "/dashboard",
          icon: LuPiggyBank,
          isAllow: isBudgetRoles(currentUser),
        },
        {
          title: "DV System",
          path: IS_PRODUCTION
            ? env("DV_URL_PROD") + "/dashboard"
            : env("DV_URL_DEV") + "/dashboard",
          icon: LuReceipt,
          isAllow: true, // No specific role required in old code
        },
        {
          title: "Cash System",
          path: IS_PRODUCTION
            ? env("CMIS_URL_PROD") + "/dashboard"
            : env("CMIS_URL_DEV") + "/dashboard",
          icon: LuBanknote,
          isAllow: isCashRoles(currentUser),
        },
        {
          title: "BCD System",
          path: IS_PRODUCTION
            ? env("BCD_URL_PROD") + "/dashboard"
            : env("BCD_URL_DEV") + "/dashboard",
          icon: LuArrowLeftRight,
          isAllow: isCashRoles(currentUser) || isAccountingRoles(currentUser),
        },
        {
          title: "Itinerary System",
          path: IS_PRODUCTION
            ? env("ITINERARY_URL_PROD") + "/itinerary_info"
            : env("ITINERARY_URL_DEV") + "/itinerary_info",
          icon: LuWallet,
          isAllow: true, // No specific role required in old code
        },
      ],
    },
    {
      title: "Contact Support",
      path: "/contacts",
      icon: LuContact,
      isAllow: true,
    },
  ];

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Sign Out?",
      text: "Are you sure you want to sign out?",
      icon: "warning",
      iconColor: "#e63946",
      showCancelButton: true,
      confirmButtonText: "Yes, Sign Out",
      cancelButtonText: "Cancel",
      background: isDarkMode ? "#152e22" : "#ffffff", // Sleek backdrop matching theme mode
      color: isDarkMode ? "#cbd5e1" : "#1e293b", // Sleek text matching theme mode
      confirmButtonColor: "#e63946", // Modern soft red
      cancelButtonColor: "#386641", // Sleek deep green
      reverseButtons: true,
      allowOutsideClick: false,
      customClass: {
        popup: 'premium-swal-popup',
        title: 'premium-swal-title',
        htmlContainer: 'premium-swal-text',
        confirmButton: 'premium-swal-confirm',
        cancelButton: 'premium-swal-cancel',
      }
    });

    if (result.isConfirmed) {
      try {
        await logout();
        if (!IS_PRODUCTION) {
          toast.success("Logged out successfully");
        }
      } catch (error) {
        toast.error("Logout failed!");
        console.error("Logout Error:", error);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      setExpandedMenus({});
      setTooltip((prev) => ({ ...prev, visible: false }));
      setIsRolesExpanded(false);
    } else {
      const activeParent = navItems.find((item) =>
        item.subItems?.some((sub) => location.pathname === sub.path),
      );

      if (activeParent) {
        setExpandedMenus((prev) => ({ ...prev, [activeParent.title]: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  const handleMouseEnter = (e, title) => {
    if (!open) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltip({
        visible: true,
        title: title,
        top: rect.top + rect.height / 2,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, title: "", top: 0 });
  };

  const toggleSubmenu = (title) => {
    if (!open) toggleDrawer();
    setExpandedMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const closeMobile = () => {
    if (window.innerWidth < 1200 && open) {
      setOpen(false);
    }
  };

  return (
    <>
      <style>{`
        .premium-swal-popup {
          border-radius: 24px !important;
          font-family: 'Outfit', 'Inter', 'Roboto', sans-serif !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
          padding: 2.5rem 1.5rem !important;
        }
        .premium-swal-title {
          font-weight: 900 !important;
          font-size: 1.6rem !important;
          letter-spacing: -0.5px !important;
          margin-bottom: 0.5rem !important;
        }
        .premium-swal-text {
          font-weight: 500 !important;
          font-size: 1rem !important;
          opacity: 0.85 !important;
          margin-bottom: 1.5rem !important;
        }
        .premium-swal-confirm {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-confirm:hover {
          transform: translateY(-2px) !important;
        }
        .premium-swal-cancel {
          border-radius: 12px !important;
          font-weight: 700 !important;
          font-size: 0.95rem !important;
          padding: 12px 24px !important;
          transition: all 0.3s ease !important;
        }
        .premium-swal-cancel:hover {
          transform: translateY(-2px) !important;
        }
      `}</style>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          position: "relative",
          bgcolor: "#08140c",
        }}
      >
        {/* COLLAPSE TOGGLE ARROW */}
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            toggleDrawer();
            setTooltip({ visible: false, title: "", top: 0 });
          }}
          sx={{
            display: { xs: "none", lg: "flex" },
            position: "absolute",
            right: -10,
            top: 24,
            width: 20,
            height: 20,
            bgcolor: "#1e3b28",
            color: "white",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
            zIndex: 100,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": { 
              bgcolor: "#2d6643",
              transform: "scale(1.1)",
            },
            "&:hover .toggle-tooltip": {
              opacity: 1,
              visibility: "visible",
              transform: "translateY(-50%) translateX(0)",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              transition: "transform 0.3s ease",
              transform: open ? "rotate(0deg)" : "rotate(180deg)",
            }}
          >
            <LuChevronLeft size={14} />
          </Box>

          <Box
            className="toggle-tooltip"
            sx={{
              position: "absolute",
              left: "40px",
              top: "50%",
              transform: "translateY(-50%) translateX(-8px)",
              opacity: 0,
              visibility: "hidden",
              px: 1.5,
              py: 0.75,
              bgcolor: "#0f1a12",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "white",
              borderRadius: 1,
              fontSize: "0.75rem",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
              transition: "all 0.2s ease-in-out",
              whiteSpace: "nowrap",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: -5,
                width: 10,
                height: 10,
                bgcolor: "#0f1a12",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                transform: "translateY(-50%) rotate(45deg)",
              }}
            />
            <Box sx={{ position: "relative", zIndex: 10 }}>
              {open ? "Collapse Sidebar" : "Expand Sidebar"}
            </Box>
          </Box>
        </IconButton>

        {/* HEADER LOGO AREA */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            height: 72,
            px: open ? 3 : 2.5,
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src="/2020-nia-logo.svg"
            alt="NIA Logo"
            sx={{ 
              height: 32, 
              width: 32,
              filter: "drop-shadow(0 0 8px rgba(105, 216, 146, 0.2))",
            }}
          />
          {open && (
            <Typography
              sx={{
                color: "white",
                fontWeight: 600,
                fontSize: "0.95rem",
                whiteSpace: "nowrap",
                animation: "fadeIn 0.2s",
              }}
            >
              {env("APP_TITLE") || "NIA Dashboard"}
            </Typography>
          )}
        </Box>

        {/* SCROLLABLE LINKS AREA */}
        <Box
          sx={{
            flexGrow: 1,
            overflowY: "auto",
            overflowX: "hidden",
            py: 2,
            px: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            "&::-webkit-scrollbar": { width: "5px" },
            "&::-webkit-scrollbar-track": {
              background: "rgba(255,255,255,0.02)",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.1)",
              borderRadius: "4px",
            },
            "&:hover::-webkit-scrollbar-thumb": {
              background: "rgba(255,255,255,0.2)",
            },
          }}
        >
          {/* ROLES DISPLAY */}
          <Box
            sx={{
              mb: 2,
              mx: open ? 1 : 0.5,
              px: open ? 1.5 : 0,
              py: open ? 1.5 : 1,
              borderRadius: 2,
              bgcolor: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              flexDirection: "column",
              alignItems: open ? "stretch" : "center",
              transition: "all 0.2s",
            }}
          >
            {open ? (
              <>
                <Box
                  component={hasMultipleRoles ? "button" : "div"}
                  onClick={() =>
                    hasMultipleRoles && setIsRolesExpanded(!isRolesExpanded)
                  }
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color: "white",
                    p: 0,
                    cursor: hasMultipleRoles ? "pointer" : "default",
                    textAlign: "left",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        bgcolor: "rgba(105, 216, 146, 0.1)",
                        color: "#69d892",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <LuShieldCheck size={16} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          color: "rgba(255,255,255,0.4)",
                          textTransform: "uppercase",
                        }}
                      >
                        Current Role
                      </Typography>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Tooltip
                          title={
                            primaryRoleRaw.toLowerCase().includes("super")
                              ? "Admin"
                              : primaryRoleRaw
                          }
                        >
                          <Typography
                            sx={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: "white",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {formatRole(primaryRoleRaw)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                  {hasMultipleRoles && (
                    <LuChevronDown
                      size={12}
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        transform: isRolesExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.2s",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>

                {hasMultipleRoles && (
                  <Collapse in={isRolesExpanded} timeout="auto" unmountOnExit>
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.5,
                        borderTop: "1px dashed rgba(255,255,255,0.1)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                      }}
                    >
                      {rolesList.map((role, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            pl: 1,
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              bgcolor:
                                idx === 0 ? "#69d892" : "rgba(255,255,255,0.2)",
                              boxShadow:
                                idx === 0
                                  ? "0 0 6px rgba(105, 216, 146, 0.6)"
                                  : "none",
                            }}
                          />
                          <Tooltip
                            title={
                              role.toLowerCase().includes("super")
                                ? "Admin"
                                : role
                            }
                          >
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                color: idx === 0 ? "white" : "#cbd5e1",
                                fontWeight: idx === 0 ? 600 : 400,
                              }}
                            >
                              {formatRole(role)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                )}
              </>
            ) : (
              <Tooltip title={formatRole(primaryRoleRaw)} placement="right">
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    bgcolor: "rgba(105, 216, 146, 0.1)",
                    color: "#69d892",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: "rgba(105, 216, 146, 0.2)" },
                  }}
                >
                  <LuShieldCheck size={16} />
                </Box>
              </Tooltip>
            )}
          </Box>

          {navItems.map((item, index) => {
            if (item.isDivider) {
              return (
                <Box
                  key={index}
                  sx={{ my: 1, borderBottom: "1px solid #1e3b28" }}
                />
              );
            }

            // Fallback for sub-item isAllow checking (if sub-items are defined but parent isn't)
            if (item.isAllow !== undefined && !item.isAllow) return null;

            const hasSubmenu = !!item.subItems;
            const isExpanded = expandedMenus[item.title];
            const isDirectActive = location.pathname === item.path;
            const isChildActive =
              hasSubmenu &&
              item.subItems.some((sub) => location.pathname === sub.path);
            const isActive = isDirectActive || isChildActive;

            return (
              <Box
                key={item.title}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {hasSubmenu ? (
                  <Box
                    component="button"
                    onClick={() => toggleSubmenu(item.title)}
                    onMouseEnter={(e) => handleMouseEnter(e, item.title)}
                    onMouseLeave={handleMouseLeave}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: open ? "space-between" : "center",
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      width: "100%",
                      border: "none",
                      bgcolor: isExpanded ? "rgba(255, 255, 255, 0.05)" : "transparent",
                      color: isExpanded ? "white" : "rgba(255, 255, 255, 0.6)",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                      "&:hover": {
                        color: "white",
                        bgcolor: "rgba(255, 255, 255, 0.08)",
                      },
                    }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      {item.icon && (
                        <item.icon
                          size={17}
                          style={{
                            color: isExpanded ? "#69d892" : "inherit",
                            opacity: isExpanded ? 1 : 0.6,
                            transition: "all 0.2s",
                          }}
                        />
                      )}
                      {open && (
                        <Typography
                          sx={{
                            fontSize: "0.85rem",
                            fontWeight: isExpanded ? 600 : 500,
                            whiteSpace: "nowrap",
                            letterSpacing: "0.01em",
                          }}
                        >
                          {item.title}
                        </Typography>
                      )}
                    </Box>
                    {open && (
                      <LuChevronDown
                        size={14}
                        style={{
                          opacity: 0.4,
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      />
                    )}
                  </Box>
                ) : (
                  <Box
                    component={item.path?.startsWith("http") ? "a" : Link}
                    to={item.path?.startsWith("http") ? undefined : item.path}
                    href={item.path?.startsWith("http") ? item.path : undefined}
                    onClick={() => {
                      if (!item.path?.startsWith("http")) closeMobile();
                      setExpandedMenus({});
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, item.title)}
                    onMouseLeave={handleMouseLeave}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: open ? "flex-start" : "center",
                      gap: 1.5,
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      border: "none",
                      textDecoration: "none",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      bgcolor: isActive ? "rgba(255, 255, 255, 0.08)" : "transparent",
                      color: isActive ? "white" : "rgba(255, 255, 255, 0.6)",
                      position: "relative",
                      "&::before": isActive ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: "20%",
                        height: "60%",
                        width: 3,
                        bgcolor: "#69d892",
                        borderRadius: "0 4px 4px 0",
                        boxShadow: "0 0 10px rgba(105, 216, 146, 0.4)",
                      } : {},
                      "&:hover": {
                        bgcolor: isActive ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.05)",
                        color: "white",
                        "& .nav-icon": {
                          opacity: 1,
                        }
                      },
                    }}
                  >
                    {item.icon && (
                      <item.icon
                        className="nav-icon"
                        size={17}
                        style={{
                          color: isActive ? "#69d892" : "inherit",
                          opacity: isActive ? 1 : 0.6,
                          transition: "all 0.2s",
                        }}
                      />
                    )}
                    {open && (
                      <Typography
                        sx={{
                          fontSize: "0.85rem",
                          fontWeight: isActive ? 600 : 500,
                          whiteSpace: "nowrap",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {item.title}
                      </Typography>
                    )}
                  </Box>
                )}

                {hasSubmenu && (
                  <Collapse
                    in={isExpanded && open}
                    timeout="auto"
                    unmountOnExit
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        mt: 0.5,
                        mb: 1,
                        ml: 2.2,
                        pl: 2,
                        borderLeft: "1px solid #1e3b28",
                      }}
                    >
                      {item.subItems.map((sub) => {
                        if (sub.isAllow !== undefined && !sub.isAllow)
                          return null;
                        const isSubActive = location.pathname === sub.path;
                        return (
                          <Box
                            key={sub.title}
                            component={
                              sub.path?.startsWith("http") ? "a" : Link
                            }
                            to={
                              sub.path?.startsWith("http")
                                ? undefined
                                : sub.path
                            }
                            href={
                              sub.path?.startsWith("http")
                                ? sub.path
                                : undefined
                            }
                            onClick={() =>
                              !sub.path?.startsWith("http") && closeMobile()
                            }
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              px: 1.5,
                              py: 1.2,
                              borderRadius: 1.5,
                              textDecoration: "none",
                              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              bgcolor: isSubActive
                                ? "rgba(255, 255, 255, 0.05)"
                                : "transparent",
                              color: isSubActive ? "white" : "rgba(255, 255, 255, 0.5)",
                              "&:hover": {
                                bgcolor: "rgba(255, 255, 255, 0.03)",
                                color: "white",
                              },
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: "0.8rem",
                                fontWeight: isSubActive ? 600 : 400,
                                whiteSpace: "nowrap",
                                letterSpacing: "0.01em",
                              }}
                            >
                              {sub.title}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                )}
              </Box>
            );
          })}
        </Box>

        {/* LOGOUT BUTTON AREA */}
        <Box sx={{ p: 2, pb: 3, borderTop: "1px solid rgba(255, 255, 255, 0.05)", flexShrink: 0 }}>
          <Box
            component="button"
            onClick={handleLogout}
            onMouseEnter={(e) => handleMouseEnter(e, "Sign Out")}
            onMouseLeave={handleMouseLeave}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: open ? "flex-start" : "center",
              gap: 1.5,
              width: "100%",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              border: "none",
              background: "transparent",
              color: "rgba(255, 255, 255, 0.6)",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                bgcolor: "rgba(239, 68, 68, 0.08)",
                color: "#f87171",
                "& .logout-icon": {
                  opacity: 1,
                  transform: "translateX(3px)",
                }
              },
            }}
          >
            <LuLogOut 
              className="logout-icon"
              size={17} 
              style={{ 
                opacity: 0.6,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }} 
            />
            {open && (
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.01em",
                }}
              >
                Sign Out
              </Typography>
            )}
          </Box>
        </Box>

        {tooltip.visible && (
          <Box
            sx={{
              position: "fixed",
              left: 95,
              top: tooltip.top,
              transform: "translateY(-50%)",
              px: 1.5,
              py: 0.75,
              bgcolor: "#0f1a12",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "white",
              borderRadius: 1,
              fontSize: "0.75rem",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
              zIndex: 1400,
              animation: "fadeInRight 0.15s ease",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: -5,
                width: 10,
                height: 10,
                bgcolor: "#0f1a12",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                transform: "translateY(-50%) rotate(45deg)",
              }}
            />
            <Box sx={{ position: "relative", zIndex: 10 }}>{tooltip.title}</Box>
          </Box>
        )}
      </Box>
    </>
  );
}