import { TbCategory } from "react-icons/tb"; 
import { BiChild } from "react-icons/bi"; 
import { AiFillMedicineBox } from "react-icons/ai"; 
import { FaFileUpload } from "react-icons/fa";
import { useState } from "react";
import { Box, Divider, List, Toolbar, Typography } from "@mui/material";
import DisplayRoles from "../global/components/DisplayRoles";
import LinkTo from "../global/components/LinkTo";
import {
  FaChartBar,
  FaChevronCircleDown,
  FaClipboardList,
  FaInfoCircle,
  FaRegMoneyBillAlt,
  FaPhone,
  FaHome,
  FaFileAlt,
  FaRegChartBar,
} from "react-icons/fa";
import { TbReportAnalytics } from "react-icons/tb";
import { FiUsers } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { HiOutlineBanknotes } from "react-icons/hi2";
import { MdOutlineContactSupport } from "react-icons/md";
import { FaBriefcase } from "react-icons/fa";
import { FaGavel } from "react-icons/fa";
import { FaClock } from "react-icons/fa";
import { GiMeal } from "react-icons/gi";
import { BiSolidShieldPlus } from "react-icons/bi";
import { FaAward } from "react-icons/fa6";
import { BiData } from "react-icons/bi";
import { isBudgetAdmin, isSuperAdmin } from "../utils/checkRole";
import { useUser } from "../context/UserContext";
const CustomDrawer = ({ collapsed = false }) => {
  const [openSettings, setOpenSettings] = useState(false);
const {currentUser} =  useUser();
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
                link: "/Proposal",
                name: "Create Proposal",
                icon: <FaFileAlt />,
              },

              {
                link: "/AllProposals",
                name: "Proposals",
                icon: <FaClipboardList />,
              },
              {
                link: "/myProposals",
                name: "My Proposals",
                icon: <FaClipboardList />,
              },
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
            isAllow
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
                icon: <FaRegMoneyBillAlt />,
              },
              {
                link: "/consolidated-reports",
                name: "Consolidated MOOE",
                icon: <TbReportAnalytics />,
              },
              {
                link: "/consolidated-capital-outlay-reports",
                name: "Consolidated Capital Outlay Reports",
                icon: <FaRegMoneyBillAlt />,
              },
              {
                link: "/consolidated-personnel-services-reports",
                name: "Consolidated Personnel Services Reports",
                icon: <FiUsers />,
              },
              {
                link: "/comprehensive-reports",
                name: "Comprehensive Budget Report",
                icon: <FaRegChartBar />,
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
            link="/Employee"
            isAllow
            collapsed={collapsed}
          />

          <LinkTo
            icon={<FaBriefcase />}
            name="Employee Benefits"
            link="/employeeBenefits"
            isAllow
            collapsed={collapsed}
          />

          {/* Expandable Settings Menu */}
          <LinkTo
            icon={<IoSettingsOutline />}
            name="Settings"
             isAllow={isSuperAdmin(currentUser) || isBudgetAdmin(currentUser)}
            collapsed={collapsed}
            iconRight={<FaChevronCircleDown />}
            subLinks={[
              {
                link: "/fysettings",
                name: "Set Cut-Off",
                icon: <IoSettingsOutline />,
              },
              {
                link: "/compsettings",
                name: "Compensation Settings",
                icon: <IoSettingsOutline />,
              },
              // {
              //   link: "/settings",
              //   name: "Settings Management",
              //   icon: <IoSettingsOutline />,
              // },
              {
                link: "/rata",
                name: "RATA",
                icon: <IoSettingsOutline />,
              },

              {
                // link: "/capital-outlay-title-mapping",
                link: "/categories",
                name: "Capital Outlay",
                icon: <IoSettingsOutline />,
              },

              {
                link: "/income-management",
                name: "Income Management",
                icon: <TbCategory />,
              },
              
              // {
              //   link: "/corporate-income-upload",
              //   name: "Corporate Income Upload",
              //   icon: <FaFileUpload />,
              // },


              {
                
                link: "/hierarchical-user-assignments",
                name: "Hierarchical User Assignments",
                icon: <IoSettingsOutline />,
                
              }


              // {
              //   link: "/database-backup",
              //   name: "Database Backup",
              //   icon: <BiData />,
              // }

            ]}
           
          />

          {/* <LinkTo icon={<FiUsers />} name="Uploader" link="/uploader" isAllow /> */}
        </List>
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          background: "rgba(0,0,0,0.7996848739495799)",
          backdropFilter: "blur(2px)",
        }}
      >
        <Divider sx={{ borderColor: "primary.light" }} />
        {!collapsed && (
          <Typography
            variant="body2"
            align="center"
            sx={{ color: "common.white", py: 2 }}
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
              py: 2,
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
