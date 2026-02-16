import { TbCategory } from "react-icons/tb";
import { BiChild } from "react-icons/bi";
import { AiFillMedicineBox } from "react-icons/ai";
import { FaFileUpload } from "react-icons/fa";
import { useState, useEffect } from "react";
import { Box, Divider, List, Toolbar, Typography } from "@mui/material";
import DisplayRoles from "../global/components/DisplayRoles";
import LinkTo from "../global/components/LinkTo";
import {
  FaChartBar,
  FaChevronCircleDown,
  FaClipboardList,
  FaInfoCircle,
  FaRegMoneyBillAlt,
  FaMoneyBillWave,
  FaPhone,
  FaHome,
  FaFileAlt,
  FaRegChartBar,
  FaArrowLeft,
} from "react-icons/fa";
import { TbReportAnalytics } from "react-icons/tb";
import { FiUsers } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { MdOutlineContactSupport, MdHistory } from "react-icons/md";
import { FaBriefcase } from "react-icons/fa";
import { FaGavel } from "react-icons/fa";
import { FaClock } from "react-icons/fa";
import { GiMeal } from "react-icons/gi";
import { BiSolidShieldPlus } from "react-icons/bi";
import { FaAward } from "react-icons/fa6";
import { BiData } from "react-icons/bi";
import {
  isBudgetAdmin,
  isPreparer,
  isSuperAdmin,
} from "../utils/checkRole";
import { hasPermission } from "../utils/permissions";
import { useUser } from "../context/UserContext";
import IS_PRODUCTION from "../utils/IS_PRODUCTION";
import api from "../config/api";
const CustomDrawer = ({ collapsed = false }) => {
  const [openSettings, setOpenSettings] = useState(false);
  const [hasFinalizedProposals, setHasFinalizedProposals] = useState(false);
  const { currentUser } = useUser();
  // Simple role flags - check both primary roles and workflow roles
  const roles = (currentUser?.Roles || []).map(String);
  const workflowRoles = (currentUser?.workflowRoles || []).map(String);
  const allRoles = [...roles, ...workflowRoles];
  
  // Helper function to check if user has any approver role
  const hasApproverRole = () => {
    const approverWorkflowRoles = ['divisionapprover', 'officeapprover', 'approver'];
    const approverPrimaryRoles = ['APPROVER', 'DIVISION APPROVER', 'OFFICE APPROVER', 'BUDGET APPROVER'];
    
    const hasWorkflowApprover = workflowRoles.some(role => 
      approverWorkflowRoles.includes(role.toLowerCase())
    );
    const hasPrimaryApprover = roles.some(role => 
      approverPrimaryRoles.some(approverRole => role.toUpperCase().includes(approverRole))
    );
    
    return hasWorkflowApprover || hasPrimaryApprover;
  };
  
  const isOverallApprover = roles.includes("BUDGET MANAGER");
  const isBudgetOfficer = roles.includes("BUDGET OFFICER");
  const isApprover = hasApproverRole();
  const isReviewer = roles.includes("BUDGET REVIEWER");
  const isBudgetPlanningAnalyst = roles.includes("BUDGET PLANNING ANALYST");
  // Determine if this user is BRD-level (Budget and Revenue Division) either by hierarchical access or by job role
  const isBRDLevel =
    currentUser?.hierarchicalAccess?.scope === "BUDGET_AND_REVENUE_DIVISION" ||
    currentUser?.hierarchicalAccess?.assignmentLevel === "BUDGET_AND_REVENUE_DIVISION" ||
    roles.some((r) => String(r).toUpperCase().includes("BRD"));

  // BUDGET_PLANNING_ANALYST should have same access as APPROVER for menus
  const isBudgetPlanningAnalystOrApprover = isBudgetPlanningAnalyst || isApprover;
  const fmisUrl =
    process.env.NODE_ENV === "production"
      ? "https://fmis.nia.gov.ph/dashboard"
      : "https://main.fmis.local/dashboard";

  // Show NEP Ceiling menu only when there are FINALIZED proposals (for active fiscal year)
  useEffect(() => {
    let isMounted = true;
    const fetchHasFinalized = async () => {
      try {
        const settingsRes = await api.get("/settings/active");
        const fiscalYear = settingsRes?.data?.fiscalYear;
        const params = fiscalYear ? { fiscalYear } : {};
        const res = await api.get("/api/allproposal/proposals/has-finalized", {
          params,
        });
        if (!isMounted) return;
        if (res?.data?.success) {
          setHasFinalizedProposals(!!res.data.hasFinalized);
        } else {
          setHasFinalizedProposals(false);
        }
      } catch (err) {
        console.error(
          "Failed to check finalized proposals for NEP Ceiling menu:",
          err?.message || err
        );
        if (isMounted) setHasFinalizedProposals(false);
      }
    };

    fetchHasFinalized();

    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        position: "relative",
      }}
    >
      <Box>
        <Toolbar />
        <DisplayRoles collapsed={collapsed} />
        <Divider sx={{ borderColor: "secondary.light" }} />
        <List sx={{ py: 0 }}>
          <LinkTo
            icon={<FaHome />}
            name="Dashboard"
            link="/dashboard"
            isAllow
            collapsed={collapsed}
          />

          {/* Expandable Budget Proposal Menu */}
          <LinkTo
            icon={<HiOutlineBanknotes />}
            name="Budget Proposal Management"
            isAllow
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: "/proposal",
                name: "Create Proposal",
                isAllow:
                  (hasPermission(currentUser, "CreateProposals") ||
                    hasPermission(currentUser, "EditOwnProposals")) &&
                  !isOverallApprover &&
                  !isBudgetOfficer &&
                  !isApprover &&
                  !isReviewer &&
                  !isBudgetPlanningAnalyst,  // ✅ Block both BUDGET_PLANNING_ANALYST and APPROVER from creating proposals
                icon: <FaFileAlt />,
              },

              // {
              //   link: "/AllProposals",
              //   name: "Proposals",
              //   isAllow: hasPermission(currentUser, "ViewReports"),
              //   icon: <FaClipboardList />,
              // },
              {
                link: "/allproposal",
                name: "All Proposals",
                isAllow: hasPermission(currentUser, "CreateProposals") || hasPermission(currentUser, "EditOwnProposals"),
                icon: <FaClipboardList />,
              },
              {
                link: "/brd-consolidation",
                name: "BRD Consolidation Structure",
                isAllow: isBudgetPlanningAnalyst || isBudgetOfficer || isOverallApprover || isSuperAdmin(currentUser),
                icon: <BiData />,
              },
              {
                link: "/nep-ceiling",
                name: "NEP Ceiling Management",
                // Visible only when there are finalized proposals for the active fiscal year,
                // and user is BRD decision-maker (Budget Officer / Manager / Super Admin)
                isAllow:
                  hasFinalizedProposals &&
                  (isBudgetOfficer || isOverallApprover || isSuperAdmin(currentUser)),
                icon: <FaChartBar />,
              },
              {
                link: "/tier",
                name: "Tier",
                isAllow: isBudgetPlanningAnalyst || isBudgetOfficer || isOverallApprover || isSuperAdmin(currentUser),
                icon: <FaChartBar />,
              },
              // {
              //   link: "/myProposals",
              //   name: "My Proposals",
              //   isAllow: hasPermission(currentUser, 'EditOwnProposals') && !isOverallApprover && !isBudgetOfficer,
              //   icon: <FaClipboardList />,
              // },
              // {
              //   link: "/annexis",
              //   name: "Annex",
              //   icon: <FaChartBar />,
              // },
            ]}
          />

          {/* Expandable Reports Menu */}
          <LinkTo
            icon={<TbReportAnalytics />}
            name="Reports & Analytics"
            
            isAllow ={ isBudgetPlanningAnalyst || isBudgetOfficer || isOverallApprover || isSuperAdmin(currentUser)}
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              // {
              //   link: "/createProposal2",
              //   name: "Proposal Summary",
              //   icon: <FaChartBar />,
              // },
              {
                link: "/consolidated-corporate-income",
                name: "Consolidated Corporate Income",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FaRegMoneyBillAlt />,
              },
              {
                link: "/consolidated-reports",
                name: "Consolidated MOOE",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <TbReportAnalytics />,
              },
              {
                link: "/consolidated-capital-outlay-reports",
                name: "Consolidated Capital Outlay Reports",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FaRegMoneyBillAlt />,
              },
              {
                link: "/consolidated-personnel-services-reports",
                name: "Consolidated Personnel Services Reports",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FiUsers />,
              },
              {
                link: "/comprehensive-reports",
                name: "Comprehensive Budget Report",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FaRegChartBar />,
              },
              {
                link: "/comparative-report",
                name: "Comparative Budget Report",
                isAllow: hasPermission(currentUser, "ViewReports"),
                icon: <FaChartBar />,
              },
              // {
              //   link: "/corporate-income-upload",
              //   name: "Corporate Income Upload",
              //   icon: <FaFileUpload />,
              // },
            ]}
          />

          {/* Expandable Help & Support Menu
          <LinkTo
            icon={<MdOutlineContactSupport />}
            name="Help & Support"
            isAllow
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            expandedMenu={expandedMenu}
            setExpandedMenu={setExpandedMenu}
            subLinks={[
              {
                link: "/guidelines",
                name: "Guidelines",
                icon: <FaInfoCircle />,
              },
              {
                link: "/contact",
                name: "Contact Support",
                icon: <FaPhone />,
              },
            ]}
          /> */}

          <LinkTo
            icon={<FiUsers />}
            name="Employee List"
            link="/employee"
            isAllow={
              (
                hasPermission(currentUser, "EditAllProposals") &&
              
                !isBudgetOfficer &&
                !isBudgetPlanningAnalystOrApprover

              ) || isOverallApprover || isBRDLevel || isSuperAdmin(currentUser)
            }
            collapsed={collapsed}
          />

          <LinkTo
            icon={<FaBriefcase />}
            name="Employee Benefits"
            link="/employeeBenefits"
            isAllow={
              hasPermission(currentUser, "EditAllProposals") &&
              !isOverallApprover &&
              !isBudgetOfficer &&
              !isBudgetPlanningAnalystOrApprover
            }
            collapsed={collapsed}
          />

          {/* Expandable Settings Menu */}
          <LinkTo
            icon={<IoSettingsOutline />}
            name="Settings"
            isAllow={
              hasPermission(currentUser, "ManageSettings") || isOverallApprover
            }
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: "/fysettings",
                name: "Set Cut-Off",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <IoSettingsOutline />,
              },
              {
                link: "/compensation-management",
                name: "Compensation Management Settings",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <IoSettingsOutline />,
              },
              // {
              //   link: "/audit-logs",
              //   name: "Audit Logs",
              //   isAllow:
              //     hasPermission(currentUser, "ManageSettings") ||
              //     isOverallApprover,
              //   icon: <MdHistory />,
              // },

              // {
              //   link: "/settings",
              //   name: "Settings Management",
              //   icon: <IoSettingsOutline />,
              // },
              {
                link: "/rata",
                name: "RATA",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <IoSettingsOutline />,
              },

              {
                link: "/categories",
                name: "Capital Outlay",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <IoSettingsOutline />,
              },

              {
                link: "/income-management",
                name: "Income Management",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <TbCategory />,
              },

              // {
              //   link: "/salary-management",
              //   name: "Salary Management",
              //   isAllow:
              //     hasPermission(currentUser, "ManageSettings") ||
              //     isOverallApprover,
              //   icon: <FaMoneyBillWave />,
              // },
              {
                link: "/salary-table",
                name: "Salary Table",
                isAllow:
                  hasPermission(currentUser, "ManageSettings") ||
                  isOverallApprover,
                icon: <FaMoneyBillWave />,
              },

              // {
              //   link: "/grouped-income-categories",
              //   name: "Grouped Income Categories",
              //   isAllow:
              //     hasPermission(currentUser, "ManageSettings") ||
              //     isOverallApprover,
              //   icon: <TbCategory />,
              // },

              // {
              //   link: "/corporate-income-upload",
              //   name: "Corporate Income Upload",
              //   icon: <FaFileUpload />,
              // },

              {
                link: "/hierarchical-user-assignments",
                name: "Hierarchical User Assignments",
                isAllow: hasPermission(currentUser, "ManageSettings"),
                icon: <IoSettingsOutline />,
              },

              // {
              //   link: "/database-backup",
              //   name: "Database Backup",
              //   icon: <BiData />,
              //   isAllow: isSuperAdmin(currentUser),
              // },
            ]}
          />
{/* 
          <LinkTo
            icon={<FaArrowLeft />}
            name="Back To FMIS"
            link={fmisUrl}
            
            isAllow
            collapsed={collapsed}
          /> */}



 {/* GO BACK TO FMIS */}
        <Divider sx={{ borderColor: "secondary.light" }} />
        <LinkTo
          isAllow
          icon={<FaArrowLeft size={22} />}
          name="Back To FMIS"
          collapsed={collapsed}
          link={
            IS_PRODUCTION
              ? "https://fmis.nia.gov.ph/dashboard"
              : "https://main.fmis.local/dashboard"
          }
        />


          {/* <LinkTo icon={<FiUsers />} name="Uploader" link="/uploader" isAllow /> */}
        </List>
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 100%)",
          backdropFilter: "blur(4px)",
        }}
      >
        <Divider sx={{ borderColor: "primary.light" }} />
        {!collapsed && (
          <Typography
            variant="body2"
            align="center"
            sx={{ color: "common.white", py: 1.75, letterSpacing: "0.03em" }}
          >
            &copy; {new Date().getFullYear()} NIA - FMIS
          </Typography>
        )}
        {collapsed && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 1.75,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "common.white",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              NIA
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CustomDrawer;
