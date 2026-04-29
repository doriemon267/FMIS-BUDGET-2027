import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Divider,
  List,
  Tooltip,
  Typography,
  Avatar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { TbCategory, TbReportAnalytics, TbLogout } from "react-icons/tb";
import { BiData } from "react-icons/bi";
import { FiUsers } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { MdHistory, MdFiberManualRecord } from "react-icons/md";
import { LuContact } from "react-icons/lu";
import {
  FaChartBar,
  FaChevronCircleDown,
  FaClipboardList,
  FaFileAlt,
  FaRegChartBar,
  FaArrowLeft,
  FaBriefcase,
} from "react-icons/fa";
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

const CustomDrawer = () => {
  const { currentUser, logout } = useUser();
  const { open, collapsed: isCollapsed, toggleDrawer } = useDrawer(); 
  const theme = useTheme();
  const isMdScreen = useMediaQuery(theme.breakpoints.down("lg"));
  const collapsed = isMdScreen ? !open : isCollapsed;
  const navigate = useNavigate();

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
        bgcolor: "rgba(0, 0, 0, 0.9)",
        fontSize: "0.875rem",
        fontWeight: 500,
        "& .MuiTooltip-arrow": { color: "rgba(0, 0, 0, 0.9)" },
      },
    },
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        overflow: "hidden",
        background: "#061a11",
      }}
    >
      {/* Scrollable Content Area from Based Code */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.05)", borderRadius: "10px" },
          "&:hover::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.1)" },
          p: collapsed ? 1 : 2,
          pt: 3,
        }}
      >
        {/* Header with Logo */}
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
                width: 34, 
                height: 34, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                bgcolor: "white",
                borderRadius: "6px",
                p: "1.5px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor: "pointer",
                transition: "transform 0.2s ease",
                "&:hover": { transform: "scale(1.05)" }
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
              <Typography variant="h6" sx={{ color: "white", fontWeight: 700, letterSpacing: 1, fontSize: "1rem" }}>
                FMIS
              </Typography>
            )}
          </Box>
        </Tooltip>

        {/* Current Role Section */}
        <Tooltip title={collapsed ? `Role: ${displayRole}` : ""} placement="right" slotProps={tooltipSx}>
          <Box
            sx={{
              bgcolor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "16px",
              p: collapsed ? "12px 0" : "12px 16px",
              mb: 4,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              cursor: "pointer",
              transition: "all 0.3s ease",
              justifyContent: collapsed ? "center" : "flex-start",
              mx: collapsed ? "auto" : 0,
            }}
          >
            <Avatar 
              sx={{ 
                bgcolor: "rgba(74, 222, 128, 0.1)", 
                width: 36, 
                height: 36,
                color: "#4ade80",
                fontSize: "1rem",
                fontWeight: "bold"
              }}
            >
              {displayRole.charAt(0)}
            </Avatar>
            {!collapsed && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, display: "block", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  CURRENT ROLE
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Typography sx={{ color: "white", fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayRole}
                  </Typography>
                  <Box sx={{ width: 8, height: 8, bgcolor: "#4ade80", borderRadius: "50%", boxShadow: "0 0 10px #4ade80" }} />
                </Box>
              </Box>
            )}
          </Box>
        </Tooltip>

        <List sx={{ py: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <LinkTo
            icon={<TbCategory size={22} />}
            name="Dashboard"
            link="/dashboard"
            isAllow
            collapsed={collapsed}
          />

          {/* Budget Proposal Management */}
          <LinkTo
            icon={<HiOutlineBanknotes size={22} />}
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
            icon={<TbReportAnalytics size={22} />}
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
            icon={<FiUsers size={22} />}
            name="Employee List"
            link="/employee"
            isAllow={!isReviewer && (hasPermission(currentUser, "EditAllProposals") || isOverallApprover || isBRDLevel || isSuperAdmin(currentUser))}
            collapsed={collapsed}
          />

          <LinkTo
            icon={<FaBriefcase size={22} />}
            name="Employee Benefits"
            link="/employeeBenefits"
            isAllow={isSuperAdmin(currentUser) || (hasPermission(currentUser, "EditAllProposals") && !isOverallApprover && !isBudgetOfficer)}
            collapsed={collapsed}
          />

          {/* Settings */}
          <LinkTo
            icon={<IoSettingsOutline size={22} />}
            name="Settings"
            isAllow={isSuperAdmin(currentUser) || hasPermission(currentUser, "ManageSettings") || isOverallApprover}
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
              { link: "/setup/organization", name: "Organization Structure Setup", isAllow: isSuperAdmin(currentUser), icon: <IoSettingsOutline /> },
              { link: "/hierarchical-user-assignments", name: "Hierarchical User Assignments", isAllow: hasPermission(currentUser, "ManageSettings"), icon: <IoSettingsOutline /> },
              { link: "/user-activity-logs", name: "User Activity Logs", isAllow: isSuperAdmin(currentUser), icon: <MdHistory /> },
            ]}
          />

          {/* FMIS Subsystems */}
          <LinkTo
            icon={<TbCategory size={22} />}
            name="FMIS Subsystems"
            isAllow
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: IS_PRODUCTION ? "https://fmis.nia.gov.ph/dashboard" : "http://localhost:5000/dashboard",
                name: "Back To FMIS",
                isAllow: true,
                icon: <FaArrowLeft />,
              },
              {
                link: IS_PRODUCTION ? "https://fmis.nia.gov.ph/contacts" : "http://localhost:5000/contacts",
                name: "Contact Support",
                isAllow: true,
                icon: <LuContact />,
              },
            ]}
          />
        </List>
      </Box>

      {/* Footer Section */}
      <Box
        sx={{
          p: collapsed ? 1 : 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          bgcolor: "rgba(0,0,0,0.2)",
          borderTop: "1px solid rgba(255,255,255,0.05)"
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
              color: "rgba(255,255,255,0.5)",
              transition: "all 0.2s ease",
              justifyContent: collapsed ? "center" : "flex-start",
              "&:hover": {
                bgcolor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
              },
            }}
          >
            <TbLogout size={22} />
            {!collapsed && (
              <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                Sign Out
              </Typography>
            )}
          </Box>
        </Tooltip>

        <Tooltip title={collapsed ? "NIA - FMIS © 2026" : ""} placement="right" slotProps={tooltipSx}>
          <Box sx={{ textAlign: "center", opacity: 0.3 }}>
            {!collapsed ? (
              <Typography variant="caption" sx={{ color: "white", fontWeight: 600, fontSize: "0.7rem", letterSpacing: 0.5 }}>
                &copy; {new Date().getFullYear()} NIA - FMIS
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: "white", fontWeight: 900, fontSize: "0.7rem" }}>
                NIA
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CustomDrawer;