import React, { useState, useEffect } from "react";
import { Box, Tab, Tabs, Typography, Paper } from "@mui/material";
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
  "/mealallowance": 4,
  "/medicalAllowance": 5,
  "/loyaltyPay": 6,
  "/childrenAllowance": 7,
  "/retirees": 8,
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

  // Tab titles for the page header
  const tabTitles = [
    "Special Counsel Allowance",
    "Overtime Pay",
    "Subsistence Allowance MDS",
    "Subsistence Allowance ST",
    "Meal Allowance",
    "Medical Allowance",
    "Loyalty Pay",
    "Children Allowance",
    "Retiree"
  ];

  return (
    <Box sx={{ width: "100%", p: 2 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 2,
          background: 'linear-gradient(135deg, #375e38 0%, #2e4d30 100%)',
          color: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            transform: 'translateY(-2px)',
          }
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
          Employee Benefits
        </Typography>
        <Typography variant="h5" component="h2" sx={{ opacity: 0.9 }}>
          {tabTitles[tabValue]}
        </Typography>
      </Paper>
      
      <Paper 
        elevation={3} 
        sx={{ 
          mb: 2, 
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="employee benefits tabs"
          >
            <StyledTab 
              icon={<FaGavel />} 
              iconPosition="start" 
              label="Special Counsel Allowance" 
            />
            <StyledTab 
              icon={<FaClock />} 
              iconPosition="start" 
              label="Overtime Pay" 
            />
            <StyledTab 
              icon={<GiMeal />} 
              iconPosition="start" 
              label="Subsistence Allowance MDS" 
            />
            <StyledTab 
              icon={<BiSolidShieldPlus />} 
              iconPosition="start" 
              label="Subsistence Allowance ST" 
            />
            <StyledTab 
              icon={<GiMeal />} 
              iconPosition="start" 
              label="Meal Allowance" 
            />
            <StyledTab 
              icon={<AiFillMedicineBox />} 
              iconPosition="start" 
              label="Medical Allowance" 
            />
            <StyledTab 
              icon={<FaAward />} 
              iconPosition="start" 
              label="Loyalty Pay" 
            />
            <StyledTab 
              icon={<BiChild />} 
              iconPosition="start" 
              label="Children Allowance" 
            />
            <StyledTab 
              icon={<FaBriefcase />} 
              iconPosition="start" 
              label="Retiree" 
            />
          </Tabs>
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
        <MealAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={5}>
        <MedicalAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={6}>
        <LoyaltyPayPage />
      </TabPanel>
      <TabPanel value={tabValue} index={7}>
        <ChildrenAllowancePage />
      </TabPanel>
      <TabPanel value={tabValue} index={8}>
        <RetireePage />
      </TabPanel>
    </Box>
  );
};

export default EmployeeBenefitsPage;