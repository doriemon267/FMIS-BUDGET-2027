import { useState, useEffect, useMemo } from "react";
import {
  Box,
  IconButton,
  List,
  Tooltip,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme,
  alpha,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { TbCategory, TbReportAnalytics, TbLogout } from "react-icons/tb";
import { BiData } from "react-icons/bi";
import { FiUsers } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { MdHistory, MdFiberManualRecord } from "react-icons/md";
import { LuContact } from "react-icons/lu";
import {
  FaChevronCircleDown,
  FaClipboardList,
  FaFileAlt,
  FaRegChartBar,
  FaArrowLeft,
  FaBriefcase,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import {
  FaChartBar,
  FaFileContract,
  FaFileInvoiceDollar,
  FaFileSignature,
  FaMoneyBillTransfer,
  FaMoneyBillWave,
  FaPiggyBank,
  FaRegCalendarDays,
  FaSignature,
  FaUserCheck,
  FaUserGear,
  FaWallet,
} from "react-icons/fa6";
import { FaPesoSign } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";

// Logic & Utils from Original Code
import LinkTo from "../global/components/LinkTo";
import { isSuperAdmin } from "../utils/checkRole";
import { hasPermission } from "../utils/permissions";
import {
  JOB_ROLES,
  isBRDLevelUser,
  hasApproverRole as checkHasApproverRole,
} from "../constants/roles";
import { useUser } from "../context/UserContext";
import { useDrawer } from "../context/DrawerContext"; // Using the hook from based code
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import api from "../config/api";
import logger from "../utils/logger";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import env from "../utils/env";

const CustomDrawer = () => {
  const { currentUser, logout } = useUser();
  const { open, collapsed: isCollapsed, toggleDrawer, toggleCollapsed } = useDrawer(); 
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const collapsed = isMobile ? !open : isCollapsed;
  const showDesktopCollapseControls = !isMobile;
  const navigate = useNavigate();

  // Responsive padding based on screen size
  const getResponsivePadding = () => {
    if (isXs) return "6px 8px";
    if (isMobile) return "8px 10px";
    if (collapsed) return "8px 12px";
    return 2;
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Logout?",
      text: "Are you sure you want to sign out?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#386641",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, logout",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
    });

    if (result.isConfirmed) {
      try {
        await logout();
        // The logout function in UserContext already handles redirection
        toast.success("Logged out successfully");
      } catch (err) {
        logger.error("Logout failed", err);
        toast.error("Logout failed");
      }
    }
  };

  const [hasFinalizedProposals, setHasFinalizedProposals] = useState(false);
  const [canAccessCreateProposal, setCanAccessCreateProposal] = useState(false);

  // --- Logic from Original Code ---
  const roles = (currentUser?.Roles || []).map(String);
  const workflowRoles = (currentUser?.workflowRoles || []).map(String);
  
  const isOverallApprover = roles.some((r) => String(r) === JOB_ROLES.BUDGET_MANAGER);
  const isBudgetAdmin = roles.some((r) => String(r) === JOB_ROLES.BUDGET_ADMIN);
  const isBudgetOfficer = roles.some((r) => String(r) === JOB_ROLES.BUDGET_OFFICER);
  const isApprover = checkHasApproverRole(roles, workflowRoles);
  const isReviewer = roles.some((r) => String(r) === JOB_ROLES.BUDGET_REVIEWER);
  const isBudgetPlanningAnalyst = roles.some((r) => String(r) === JOB_ROLES.BUDGET_PLANNING_ANALYST);
  const isBRDLevel = isBRDLevelUser(currentUser);

  const displayRole = useMemo(() => {
    if (!roles.length) {
      if (isSuperAdmin(currentUser)) return "Admin";
      return "User";
    }
    const primary = roles[0];
    if (primary.toLowerCase().includes("super")) return "Admin";
    return primary.replace(/_/g, " ");
  }, [roles, currentUser]);

  const canSeeBRDOnlyMenus =
    isBRDLevel ||
    isBudgetPlanningAnalyst ||
    isBudgetOfficer ||
    isOverallApprover ||
    isSuperAdmin(currentUser);

  const isBudgetPlanningAnalystOrApprover = isBudgetPlanningAnalyst || isApprover;

  useEffect(() => {
    let isMounted = true;
    const fetchHasFinalized = async () => {
      try {
        const settingsRes = await api.get("/settings/active");
        const fiscalYear = settingsRes?.data?.fiscalYear;
        const params = fiscalYear ? { fiscalYear } : {};
        const res = await api.get("/allproposal/proposals/has-finalized", { params });
        if (isMounted && res?.data?.success) {
          setHasFinalizedProposals(!!res.data.hasFinalized);
        }
      } catch (err) {
        logger.error("Failed to check finalized proposals", err);
        if (isMounted) setHasFinalizedProposals(false);
      }
    };
    fetchHasFinalized();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkCreateProposalAccess = async () => {
      try {
        if (isSuperAdmin(currentUser)) {
          if (isMounted) setCanAccessCreateProposal(true);
          return;
        }
        const isCreateProposalCandidate =
          (hasPermission(currentUser, "CreateProposals") || hasPermission(currentUser, "EditOwnProposals")) &&
          !isOverallApprover && !isBudgetOfficer && !isApprover && !isReviewer && !isBudgetPlanningAnalyst;

        if (!isCreateProposalCandidate) {
          if (isMounted) setCanAccessCreateProposal(false);
          return;
        }
        const response = await api.get("/allproposal/proposals/preparer-create-access");
        if (isMounted) setCanAccessCreateProposal(!response?.data?.hasInProcessProposal);
      } catch (err) {
        logger.warn("Failed to evaluate create proposal access", err);
      }
    };
    if (currentUser) checkCreateProposalAccess();
    return () => { isMounted = false; };
  }, [currentUser, isOverallApprover, isBudgetOfficer, isApprover, isReviewer, isBudgetPlanningAnalyst]);

  const tooltipSx = {
    tooltip: {
      sx: {
        bgcolor: "rgba(0, 0, 0, 0.95)",
        fontSize: "0.875rem",
        fontWeight: 500,
        backdropFilter: "blur(4px)",
        borderRadius: "8px",
        "& .MuiTooltip-arrow": { color: "rgba(0, 0, 0, 0.95)" },
      },
    },
  };

  // ✨ Animation for floating logo
  const logoFloat = keyframes`
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-2px); }
  `;

  // ✨ Pulse animation for active indicator
  const activePulse = keyframes`
    0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
    50% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
  `;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        overflow: "hidden",
        background: "linear-gradient(180deg, #051f12 0%, #061a11 50%, #020d08 100%)",
        position: "relative",
        
        // Subtle animated gradient overlay
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(74, 222, 128, 0.03) 0%, rgba(59, 130, 246, 0.02) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      {/* Scrollable Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
          zIndex: 1,
          p: getResponsivePadding(),
          pt: isXs ? 2 : 2.5,
          
          // Enhanced scrollbar styling
          "&::-webkit-scrollbar": { 
            width: "6px",
          },
          "&::-webkit-scrollbar-track": { 
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": { 
            background: "linear-gradient(180deg, rgba(74, 222, 128, 0.3), rgba(59, 130, 246, 0.2))",
            borderRadius: "10px",
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "&::-webkit-scrollbar-thumb:hover": { 
            background: "linear-gradient(180deg, rgba(74, 222, 128, 0.5), rgba(59, 130, 246, 0.4))",
            backgroundClip: "padding-box",
          },
        }}
      >
        {/* Header with Logo - Enhanced */}
        {!collapsed && (
          <Tooltip title={collapsed ? "FMIS-OSBPIS Dashboard" : ""} placement="right" slotProps={tooltipSx}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 4,
                px: collapsed ? 0 : 1,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Box 
                sx={{ 
                  width: 42, 
                  height: 42, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  bgcolor: "white",
                  borderRadius: "12px",
                  p: "2px",
                  boxShadow: "0 8px 24px rgba(74, 222, 128, 0.15), 0 0 1px rgba(255, 255, 255, 0.3) inset",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  animation: `${logoFloat} 3s ease-in-out infinite`,
                  
                  "&:hover": { 
                    transform: "scale(1.08)",
                    boxShadow: "0 12px 32px rgba(74, 222, 128, 0.25), 0 0 1px rgba(255, 255, 255, 0.3) inset",
                  }
                }}
                onClick={() => navigate("/")}
              >
                <img 
                  src="/2020-nia-logo.svg" 
                  alt="Logo" 
                  style={{ height: "100%", width: "100%", objectFit: "contain" }} 
                />
              </Box>
              {!collapsed && (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: "white", 
                      fontWeight: 800, 
                      letterSpacing: "1.2px", 
                      fontSize: "0.95rem",
                      lineHeight: 1,
                      background: "linear-gradient(135deg, #fff 0%, #e0e7ff 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    FMIS
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: "rgba(255, 255, 255, 0.5)", 
                      fontSize: "0.65rem",
                      fontWeight: 500,
                      letterSpacing: "0.5px",
                      display: "block",
                      lineHeight: 1,
                      mt: "2px",
                    }}
                  >
                    OSBPIS
                  </Typography>
                </Box>
              )}
              {showDesktopCollapseControls && (
                <Tooltip title="Collapse Menu" placement="bottom" arrow>
                  <IconButton 
                    onClick={toggleCollapsed} 
                    size="small"
                    sx={{ 
                      ml: "auto",
                      color: "#e2e8f0",
                      bgcolor: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      transition: "all 0.2s ease",
                      "&:hover": { 
                        color: "#ffffff", 
                        bgcolor: "rgba(74, 222, 128, 0.22)",
                        borderColor: "rgba(74, 222, 128, 0.55)",
                        transform: "scale(1.08)",
                      },
                      display: collapsed ? "none" : "flex"
                    }}
                  >
                    <FaChevronLeft size={14} />
                  </IconButton>
                </Tooltip>
            )}
          </Box>
        </Tooltip>
        )}

        {collapsed && showDesktopCollapseControls && (
          <Box sx={{ 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center", 
            gap: 1,
            mb: 2,
            mt: 0,
            py: 0
          }}>
            {/* Compact Logo in Collapsed State */}
            <Box 
              sx={{ 
                width: 38, 
                height: 38, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                bgcolor: "white",
                borderRadius: "10px",
                p: "1px",
                boxShadow: "0 4px 12px rgba(74, 222, 128, 0.2)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                
                "&:hover": { 
                  transform: "scale(1.1)",
                  boxShadow: "0 6px 16px rgba(74, 222, 128, 0.3)",
                }
              }}
              onClick={() => navigate("/")}
            >
              <img 
                src="/2020-nia-logo.svg" 
                alt="Logo" 
                style={{ height: "100%", width: "100%", objectFit: "contain" }} 
              />
            </Box>
            
            {/* Expand Button - Sleek Edition */}
            <Tooltip title="Expand Menu" placement="right" arrow>
              <IconButton 
                onClick={toggleCollapsed} 
                size="medium"
                sx={{ 
                  color: "#fff",
                  bgcolor: "#4ade80",
                  transition: "all 0.3s ease",
                  borderRadius: "10px",
                  padding: "10px",
                  minWidth: 38,
                  minHeight: 38,
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  
                  "&:hover": { 
                    bgcolor: "#65f281",
                    transform: "scale(1.15)",
                    boxShadow: "0 6px 20px rgba(74, 222, 128, 0.4)"
                  },
                  
                  "&:active": {
                    transform: "scale(0.95)"
                  }
                }}
              >
                <FaChevronRight size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Current Role Section - Enhanced */}
        <Tooltip title={collapsed ? `Role: ${displayRole}` : ""} placement="right" slotProps={tooltipSx}>
          <Box
            sx={{
              background: "linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
              border: "1.5px solid",
              borderColor: alpha("#4ade80", 0.2),
              borderRadius: "16px",
              p: collapsed ? "8px 0" : "14px 16px",
              mb: 2.5,
              display: "flex",
              alignItems: "center",
              gap: collapsed ? 0 : 1.5,
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              justifyContent: collapsed ? "center" : "flex-start",
              mx: collapsed ? "auto" : 0,
              backdropFilter: "blur(8px)",
              width: collapsed ? 42 : "auto",
              
              "&:hover": {
                background: "linear-gradient(135deg, rgba(74, 222, 128, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)",
                borderColor: alpha("#4ade80", 0.4),
                boxShadow: "0 8px 24px rgba(74, 222, 128, 0.1), 0 0 1px rgba(255, 255, 255, 0.1) inset",
              }
            }}
          >
            <Avatar 
              sx={{ 
                background: "linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)",
                width: collapsed ? 32 : 38, 
                height: collapsed ? 32 : 38,
                color: "#4ade80",
                fontSize: collapsed ? "0.8rem" : "0.95rem",
                fontWeight: 700,
                border: "1.5px solid rgba(74, 222, 128, 0.3)",
                flexShrink: 0,
              }}
            >
              {displayRole.charAt(0)}
            </Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: "rgba(255,255,255,0.45)", 
                    fontWeight: 700, 
                    display: "block", 
                    fontSize: "0.6rem", 
                    textTransform: "uppercase", 
                    letterSpacing: "0.6px",
                    mb: 0.3,
                  }}
                >
                  CURRENT ROLE
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <Typography 
                    sx={{ 
                      color: "white", 
                      fontWeight: 700, 
                      fontSize: "0.8rem", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap",
                      background: "linear-gradient(135deg, #fff 0%, #e0e7ff 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {displayRole}
                  </Typography>
                  <Box 
                    sx={{ 
                      width: 7, 
                      height: 7, 
                      bgcolor: "#4ade80", 
                      borderRadius: "50%", 
                      boxShadow: "0 0 12px #4ade80",
                      flexShrink: 0,
                    }} 
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Tooltip>

        {/* Navigation Section */}
        <List sx={{ py: 0, display: "flex", flexDirection: "column", gap: collapsed ? 0.25 : 0.75 }}>
          <LinkTo
            icon={<TbCategory size={24} />}
            name="Dashboard"
            link="/dashboard"
            isAllow
            collapsed={collapsed}
          />

          {/* Budget Proposal Management */}
          <LinkTo
            icon={<HiOutlineBanknotes size={24} />}
            name="Proposal Management"
            isAllow
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: "/proposal",
                name: "Create Proposal",
                isAllow: canAccessCreateProposal,
                icon: <FaFileAlt />,
              },
              {
                link: "/allproposal",
                name: "All Proposals",
                isAllow: hasPermission(currentUser, "CreateProposals") || hasPermission(currentUser, "EditOwnProposals"),
                icon: <FaClipboardList />,
              },
              {
                link: "/brd-consolidation",
                name: "BRD Consolidation Structure",
                isAllow: canSeeBRDOnlyMenus,
                icon: <BiData />,
              },
              {
                link: "/nep-ceiling",
                name: "NEP Ceiling Management",
                isAllow: canSeeBRDOnlyMenus && hasFinalizedProposals,
                icon: <FaChartBar />,
              },
              {
                link: "/tier",
                name: "Tier",
                isAllow: canSeeBRDOnlyMenus,
                icon: <FaChartBar />,
              },
            ]}
          />

          {/* Reports & Analytics */}
          <LinkTo
            icon={<TbReportAnalytics size={24} />}
            name="Reports & Analytics"
            isAllow={isBudgetPlanningAnalyst || isBudgetOfficer || isOverallApprover || isSuperAdmin(currentUser)}
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              ...(canSeeBRDOnlyMenus ? [
                { link: "/consolidated-corporate-income", name: "Consolidated Corporate Income", isAllow: true, icon: <FaPesoSign /> },
                { link: "/consolidated-reports", name: "Consolidated MOOE", isAllow: true, icon: <TbReportAnalytics /> },
                { link: "/consolidated-capital-outlay-reports", name: "Consolidated Capital Outlay Reports", isAllow: true, icon: <FaPesoSign /> },
                { link: "/consolidated-personnel-services-reports", name: "Consolidated Personnel Services Reports", isAllow: true, icon: <FiUsers /> },
                { link: "/comparative-report", name: "Comparative Budget Report", isAllow: true, icon: <FaChartBar /> },
              ] : []),
              {
                link: "/comprehensive-reports",
                name: "Budget Summary Report",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FaRegChartBar />,
              },
            ]}
          />

          <LinkTo
            icon={<FiUsers size={24} />}
            name="Employee List"
            link="/employee"
            isAllow={!isReviewer && (hasPermission(currentUser, "EditAllProposals") || isOverallApprover || isBRDLevel || isSuperAdmin(currentUser))}
            collapsed={collapsed}
          />

          <LinkTo
            icon={<FaBriefcase size={24} />}
            name="Employee Benefits"
            link="/employeeBenefits"
            isAllow={isSuperAdmin(currentUser) || (hasPermission(currentUser, "EditAllProposals") && !isOverallApprover && !isBudgetOfficer)}
            collapsed={collapsed}
          />

          {/* FMIS Subsystems */}
          <LinkTo
            icon={<TbCategory size={24} />}
            name="FMIS Subsystems"
            isAllow
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: IS_PRODUCTION ?  env("DV_URL_PROD") + "/dashboard"
            : env("DV_URL_DEV") + "/dashboard",
                name: "Dv System",
                isAllow: true,
                icon: <FaFileInvoiceDollar />,
              },
                 {
                link: IS_PRODUCTION  ? env("CMIS_URL_PROD") + "/dashboard"
            : env("CMIS_URL_DEV") + "/dashboard",
                name: "Cash System",
                isAllow: true,
                icon: <FaMoneyBillWave />,
              },
                 {
                link: IS_PRODUCTION ? env("BCD_URL_PROD") + "/dashboard"
            : env("BCD_URL_DEV") + "/dashboard",
                name: "BCD System",
                isAllow: true,
                icon: <FaMoneyBillTransfer />,
              },
                 {
                link: IS_PRODUCTION ? env("ITINERARY_URL_PROD") + "/itinerary_info"
            : env("ITINERARY_URL_DEV") + "/itinerary_info",
                name: "Itinerary",
                isAllow: true,
                icon: <FaWallet />,
              },
              {
                link: IS_PRODUCTION ? "https://fmis.nia.gov.ph/contacts" : "http://localhost:5000/contacts",
                name: "Contact Support",
                isAllow: true,
                icon: <LuContact />,
              },
            ]}
          />

          {/* Settings - Admin Configuration */}
          <LinkTo
            icon={<IoSettingsOutline size={24} />}
            name="Settings"
            isAllow={isSuperAdmin(currentUser) || isBudgetAdmin || (isOverallApprover && isBRDLevel)}
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              { link: "/fysettings", name: "Set Cut-Off", isAllow: true, icon: <IoSettingsOutline /> },
              { link: "/compensation-management", name: "Compensation Management Settings", isAllow: true, icon: <IoSettingsOutline /> },
              { link: "/rata", name: "RATA", isAllow: true, icon: <IoSettingsOutline /> },
              { link: "/categories", name: "Capital Outlay", isAllow: true, icon: <IoSettingsOutline /> },
              { link: "/income-management", name: "Income Management", isAllow: true, icon: <TbCategory /> },
              { link: "/employee-salary-table", name: "Permanent & Casual Salary Table", isAllow: true, icon: <FaPesoSign /> },
              { link: "/cos-salary-table", name: "COS Salary Table (SSL4)", isAllow: true, icon: <FaPesoSign /> },
              { link: "/setup/organization", name: "Organization Structure Setup", isAllow: hasPermission(currentUser, "ManageSettings") || isSuperAdmin(currentUser), icon: <IoSettingsOutline /> },
              { link: "/hierarchical-user-assignments", name: "Hierarchical User Assignments", isAllow: hasPermission(currentUser, "ManageSettings"), icon: <IoSettingsOutline /> },
              { link: "/user-activity-logs", name: "User Activity Logs", isAllow: isSuperAdmin(currentUser), icon: <MdHistory /> },
            ]}
          />
        </List>
      </Box>

      {/* Footer Section - Enhanced */}
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)",
          borderTop: "1px solid rgba(74, 222, 128, 0.1)",
          backdropFilter: "blur(8px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Tooltip title={collapsed ? "Logout" : ""} placement="right" slotProps={tooltipSx}>
          <Box
            onClick={handleLogout}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: collapsed ? 0 : 2,
              py: 1.5,
              borderRadius: "12px",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              justifyContent: collapsed ? "center" : "flex-start",
              
              "&:hover": {
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)",
                color: "#ff6b6b",
                borderRadius: "14px",
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.1), 0 0 1px rgba(255, 255, 255, 0.1) inset",
              },
            }}
          >
            <TbLogout size={24} />
            {!collapsed && (
              <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                Sign Out
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CustomDrawer;