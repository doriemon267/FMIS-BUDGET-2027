import React, { useState, useEffect } from "react";
import { Box, Tab, Tabs, Typography, Paper, ButtonBase } from "@mui/material";
import { styled } from "@mui/material/styles";
import { FaGavel, FaClock, FaAward, FaBriefcase } from "react-icons/fa";
import { GiMeal } from "react-icons/gi";
import { BiSolidShieldPlus, BiChild } from "react-icons/bi";
import { AiFillMedicineBox } from "react-icons/ai";
import { useLocation, useNavigate } from "react-router-dom";

// Import all benefit pages
import EmployeeCourtAppearancePage from "./CourtAppearancePage";
import EmployeeOvertimePayPage from "./EmployeeOvertimePayPage";
import SubsistenceAllowanceMDSPage from "./SubsistenceAllowanceMDSPage";
import SubsistenceAllowanceSTPage from "./SubsistenceAllowanceSTPage";
import SubsistenceAllowancePage from "./SubsistenceAllowancePage";
import MealAllowancePage from "./MealAllowancePage";
import MedicalAllowancePage from "./MedicalAllowancePage";
import LoyaltyPayPage from "./LoyaltyPayPage";
import ChildrenAllowancePage from "./ChildrenAllowancePage";
import RetireePage from "./RetireePage";

// Custom Tab Panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`benefits-tabpanel-${index}`}
      aria-labelledby={`benefits-tab-${index}`}
      {...other}
      style={{ width: "100%" }}
    >
      {value === index && <Box sx={{ p: 0, mt: 2 }}>{children}</Box>}
    </div>
  );
}

// Styled Tab component
const StyledTab = styled((props) => <Tab {...props} />)(({ theme }) => ({
  textTransform: "none",
  minWidth: 0,
  padding: '12px 16px',
  [theme.breakpoints.up("sm")]: {
    minWidth: 0,
  },
  fontWeight: theme.typography.fontWeightRegular,
  marginRight: theme.spacing(1),
  color: "rgba(0, 0, 0, 0.7)",
  borderRadius: '8px 8px 0 0',
  transition: 'all 0.3s ease',
  "&:hover": {
    backgroundColor: "rgba(55, 94, 56, 0.08)",
    color: theme.palette.primary.main,
    "& svg": {
      transform: "scale(1.2)",
      color: theme.palette.primary.main,
    },
  },
  "&.Mui-selected": {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium,
    backgroundColor: "rgba(55, 94, 56, 0.12)",
  },
  "& .MuiSvgIcon-root, & svg": {
    marginRight: theme.spacing(1),
    fontSize: "1.2rem",
    transition: 'transform 0.3s ease',
  },
}));

// Tab mapping for URL paths
const tabPathMapping = {
  "/courtAppearance": 0,
  "/overTime": 1,
  "/subsistenceAllowanceMDS": 2,
  "/subsistenceAllowanceST": 3,
  "/subsistenceAllowance": 4,
  "/mealallowance": 5,
  "/medicalAllowance": 6,
  "/loyaltyPay": 7,
  "/childrenAllowance": 8,
  "/retirees": 9,
  "/employeeBenefits": 0 // Default tab
};

const EmployeeBenefitsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);

  // Set the initial tab based on the URL path
  useEffect(() => {
    const path = location.pathname;
    if (tabPathMapping[path] !== undefined) {
      setTabValue(tabPathMapping[path]);
    }
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    
    // Update URL when tab changes (optional)
    const paths = Object.keys(tabPathMapping);
    const newPath = paths.find(path => tabPathMapping[path] === newValue) || "/employeeBenefits";
    
    // Only navigate if we're not already on this path
    if (location.pathname !== newPath) {
      navigate(newPath, { replace: true });
    }
  };

  // Tabs list with icons and colors matching Proposals segmented tabs
  const tabsList = [
    { label: "Special Counsel Allowance", value: 0, Icon: FaGavel, color: "#43a047" },
    { label: "Overtime Pay", value: 1, Icon: FaClock, color: "#1976d2" },
    { label: "Subsistence MDS", value: 2, Icon: GiMeal, color: "#f57c00" },
    { label: "Subsistence ST", value: 3, Icon: BiSolidShieldPlus, color: "#9c27b0" },
    { label: "Subsistence", value: 4, Icon: GiMeal, color: "#00b0ff" },
    { label: "Meal Allowance", value: 5, Icon: GiMeal, color: "#e91e63" },
    { label: "Medical Allowance", value: 6, Icon: AiFillMedicineBox, color: "#009688" },
    { label: "Loyalty Pay", value: 7, Icon: FaAward, color: "#607d8b" },
    { label: "Children Allowance", value: 8, Icon: BiChild, color: "#ff5722" },
    { label: "Retiree", value: 9, Icon: FaBriefcase, color: "#795548" },
  ];

  const activeTabObj = tabsList[tabValue] || tabsList[0];
  const ActiveIcon = activeTabObj.Icon;

  return (
    <Box sx={{ width: "100%", p: 2 }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 0,
          background: 'linear-gradient(135deg, #1e3d22 0%, #375e38 50%, #4e7d4f 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          borderBottom: '4px solid #2d5016',
          transition: 'all 0.3s ease',
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Box
            sx={{
              bgcolor: "rgba(255, 255, 255, 0.15)",
              p: 1.5,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 2px 4px rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(4px)",
            }}
          >
            <FaBriefcase style={{ fontSize: "2rem", color: "#fff" }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: "1.8rem", m: 0, textShadow: "0 2px 4px rgba(0,0,0,0.15)", letterSpacing: "0.5px" }}>
              Employee Benefits
            </Typography>
            <Typography variant="body1" component="h2" sx={{ opacity: 0.85, fontSize: "0.88rem", mt: 0.5, fontWeight: 500 }}>
              Submit and manage your employee benefits and allowances
            </Typography>
          </Box>
        </Box>

        {/* Dynamic Category Pill Chip */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            bgcolor: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "20px",
            py: 0.75,
            px: 2,
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: "rgba(255, 255, 255, 0.2)",
              transform: "translateY(-1px)",
            }
          }}
        >
          <ActiveIcon style={{ fontSize: "1.1rem", color: activeTabObj.color }} />
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.3px" }}>
            ACTIVE BENEFIT: {activeTabObj.label.toUpperCase()}
          </Typography>
        </Box>
      </Paper>
      
      {/* Segmented white card tab dock */}
      <Paper
        elevation={2}
        sx={{
          p: 1.5,
          borderRadius: "16px",
          bgcolor: "#ffffff",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0,0,0,0.01)",
          border: "1px solid rgba(0, 0, 0, 0.04)",
          mb: 3,
        }}
      >
        <Box sx={{ width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              bgcolor: "rgba(0, 0, 0, 0.04)",
              borderRadius: "12px",
              p: 0.5,
              width: "100%",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03)",
              gap: 0.5,
              flexWrap: "nowrap",
              overflowX: "auto",
              "&::-webkit-scrollbar": {
                height: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(0,0,0,0.1)",
                borderRadius: "2px",
              }
            }}
          >
            {tabsList.map((tab, index) => {
              const isActive = tabValue === tab.value;
              const Icon = tab.Icon;
              return (
                <ButtonBase
                  key={index}
                  onClick={(e) => handleTabChange(e, tab.value)}
                  sx={{
                    flex: 1,
                    bgcolor: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#2d5016" : "#64748b",
                    fontSize: "0.78rem",
                    fontWeight: isActive ? 800 : 600,
                    py: 1.25,
                    px: 2,
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.8,
                    minWidth: 145,
                    whiteSpace: "nowrap",
                    boxShadow: isActive ? "0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.02)" : "none",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                      color: isActive ? "#2d5016" : "#334155",
                      bgcolor: isActive ? "#ffffff" : "rgba(0,0,0,0.02)",
                      "& .tab-icon-wrapper": {
                        transform: "scale(1.1)",
                      }
                    },
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: "2px",
                    }
                  }}
                >
                  <Box 
                    className="tab-icon-wrapper"
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      transition: 'transform 0.2s', 
                      color: isActive ? tab.color : 'inherit' 
                    }}
                  >
                    <Icon size={14} />
                  </Box>
                  {tab.label}
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <EmployeeCourtAppearancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <EmployeeOvertimePayPage />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <SubsistenceAllowanceMDSPage />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <SubsistenceAllowanceSTPage />
      </TabPanel>
      <TabPanel value={tabValue} index={4}>
        <SubsistenceAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={5}>
        <MealAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={6}>
        <MedicalAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={7}>
        <LoyaltyPayPage />
      </TabPanel>
      <TabPanel value={tabValue} index={8}>
        <ChildrenAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={9}>
        <RetireePage />
      </TabPanel>
    </Box>
  );
};

export default EmployeeBenefitsPage;