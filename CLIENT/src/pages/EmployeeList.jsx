import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Switch,
  Box,
  Typography,
  Chip,
  Avatar,
  Tooltip,
  Badge,
  Card,
  CardContent,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
  Paper,
  Stack,
  IconButton,
  alpha,
  Fade,
  Grow,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import EmployeeCustomPage from "../components/employee/EmployeeCustomPage";
import EmployeeCustomAdd from "../components/employee/EmployeeCustomAdd";
import EmployeeEditDialog from "../components/employee/EmployeeEditDialog";
import TextSearchable from "../global/components/TextSearchable";
import api from "../config/api";
import { toast } from "react-hot-toast";
import PersonIcon from "@mui/icons-material/Person";
import WorkIcon from "@mui/icons-material/Work";
import EventIcon from "@mui/icons-material/Event";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import GroupIcon from "@mui/icons-material/Group";
import LocationIcon from "@mui/icons-material/LocationOn";
import { useThemeContext } from "../context/ThemeContext";
import { useRegion } from "../context/RegionContext";
import { useUser } from "../context/UserContext";

const EmployeeList = () => {
  const theme = useTheme();
  const { mode } = useThemeContext();
  const { activeRegion } = useRegion();
  const { currentUser } = useUser();
  const resolveProcessByFilter = (user) => {
    if (!user) return null;
    if (user.FirstName && user.LastName) {
      return `${user.FirstName} ${user.LastName}`;
    }
    if (user.fullName) {
      return user.fullName;
    }
    if (user.name) {
      return user.name;
    }
    if (user.username) {
      return user.username;
    }
    return null;
  };

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const [employeeStats, setEmployeeStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  // State to trigger refreshes
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  const rawDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDivision = typeof rawDivision === "string" ? rawDivision : rawDivision?.divisionName;
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
  const userRegion = currentUser?.hierarchicalAccess?.accessibleRegions?.[0]?.regionName;

  // Get the active region name
  const regionName = activeRegion?.name || activeRegion?.regionName;

  // Determine display name and level based on user's access
  const getDisplayInfo = () => {
    switch (userAccessLevel) {
      case 'DIVISION':
        return {
          level: 'Division',
          name: userDivision || 'Your Division',
          scope: `${userDivision || 'Division'} (${userDepartment || 'Department'}, ${regionName || 'Region'})`
        };
      case 'DEPARTMENT':
        return {
          level: 'Department',
          name: userDepartment || 'Your Department',
          scope: `${userDepartment || 'Department'} (${regionName || 'Region'})`
        };
      case 'REGION':
        return {
          level: 'Region',
          name: regionName || 'Your Region',
          scope: `${regionName || 'Region'}`
        };
      case 'BUDGET_AND_REVENUE_DIVISION':
        return {
          level: 'BRD',
          name: 'Budget & Revenue Division',
          scope: 'Full System Access'
        };
      case 'FULL':
        return {
          level: 'System',
          name: 'All Regions',
          scope: 'Full System Access'
        };
      default:
        return {
          level: 'Region',
          name: regionName || 'Your Region',
          scope: `${regionName || 'Region'}`
        };
    }
  };

  const displayInfo = getDisplayInfo();

  // Fetch employee statistics based on active region and hierarchical access
  useEffect(() => {
    const fetchEmployeeStats = async () => {
      if (!activeRegion) {
        setEmployeeStats({
          total: 0,
          active: 0,
          inactive: 0,
        });
        return;
      }

      try {
        // Get the region name - ensure we're using the exact region name
        const regionName = activeRegion.name || activeRegion.regionName;

        if (!regionName) {
          console.error("Invalid region name");
          toast.error("Invalid region selected");
          return;
        }

        // Build query parameters based on hierarchical access level
        const queryParams = { region: regionName };

        // Add hierarchical access parameters based on user level
        if (userAccessLevel === 'DIVISION' && userDivision) {
          queryParams.Division = userDivision;
        }
        if (userAccessLevel === 'DEPARTMENT' && userDepartment) {
          queryParams.Department = userDepartment;
        }
        if (userAccessLevel === 'REGION' && userRegion) {
          queryParams.region = userRegion;
        }
        // For FULL access, no additional filters needed

        // Add processBy parameter for additional access control
        // This allows users to see employees they processed, in addition to hierarchical access
        const processByFilter = resolveProcessByFilter(currentUser);
        if (processByFilter) {
          queryParams.processBy = processByFilter;
        }

        // Include the hierarchical access parameters in the request
        // Use the correct endpoint from EmployeeList_router.js
        const response = await api.get("/employees/stats", {
          params: queryParams,
        });

        if (response.data) {
          setEmployeeStats(response.data);
        }
      } catch (error) {
        console.error("Error fetching employee statistics:", error);
        console.error("Error details:", error.response?.data || error.message);

        // Set default values in case of error
        setEmployeeStats({
          total: 0,
          active: 0,
          inactive: 0,
        });

        // Show error toast
        toast.error(
          error.response?.data?.message || "Failed to load employee statistics",
          {
            style: {
              borderRadius: "10px",
              background: theme.palette.mode === "dark" ? "#333" : "#fff",
              color: theme.palette.mode === "dark" ? "#fff" : "#333",
            },
          }
        );
      }
    };

    fetchEmployeeStats();
  }, [activeRegion, theme.palette.mode, refreshTrigger, userAccessLevel, userDivision, userDepartment, userRegion]); // Include hierarchical access dependencies

  // Refresh stats when employee data changes
  const refreshStats = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const employeeSchema = {
    action: {
      type: "action",
      label: "Actions",
    },
    EmployeeFullName: {
      type: "text",
      label: "Employee Name",
      customRender: (row) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar
            sx={{
              bgcolor: theme.palette.primary.main,
              width: 32,
              height: 32,
              fontSize: "0.9rem",
            }}
          >
            {row.EmployeeFullName ? row.EmployeeFullName.charAt(0) : "E"}
          </Avatar>
          <TextSearchable
            columnName={row.EmployeeFullName}
            sx={{
              fontWeight: 500,
              "&:hover": {
                color: theme.palette.primary.main,
                textDecoration: "underline",
              },
            }}
          />
        </Box>
      ),
      show: true,
      searchable: true,
    },
    Department: {
      type: "text",
      label: "Department",
      customRender: (row) => (
        <Tooltip title={`Department: ${row.Department}`} arrow>
          <Box>
            <TextSearchable
              columnName={row.Department}
              sx={{
                maxWidth: "150px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            />
          </Box>
        </Tooltip>
      ),
      show: true,
      searchable: true,
    },
    Division: {
      type: "text",
      label: "Division",
      searchable: true,
      show: true,
      customRender: (row) => (
        <Tooltip title={`Division: ${row.Division || "N/A"}`} arrow>
          <Typography
            sx={{
              maxWidth: "150px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.Division || "N/A"}
          </Typography>
        </Tooltip>
      ),
    },
    Section: {
      type: "text",
      label: "Section",
      searchable: true,
      show: true,
      customRender: (row) => (
        <Typography
          sx={{
            maxWidth: "150px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.Section || "N/A"}
        </Typography>
      ),
    },
    Region: {
      type: "text",
      label: "Region",
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip
          label={row.Region}
          size="small"
          sx={{
            bgcolor: alpha(theme.palette.success.main, 0.1),
            color: theme.palette.success.main,
            fontWeight: 600,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            "&:hover": {
              bgcolor: alpha(theme.palette.success.main, 0.15),
              transform: "scale(1.05)",
            },
            transition: "all 0.2s ease-in-out",
          }}
        />
      ),
    },
    PositionTitle: {
      type: "text",
      label: "Position Title",
      searchable: true,
      show: true,
      customRender: (row) => (
        <Tooltip title={row.PositionTitle} arrow>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <WorkIcon fontSize="small" color="action" />
            <Typography
              sx={{
                maxWidth: "150px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.PositionTitle}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    StatusOfAppointment: {
      type: "text",
      label: "Appointment",
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip
          label={row.StatusOfAppointment}
          size="small"
          sx={{
            bgcolor: alpha(theme.palette.info.main, 0.1),
            color: theme.palette.info.main,
            fontWeight: 600,
            border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
            "&:hover": {
              bgcolor: alpha(theme.palette.info.main, 0.15),
              transform: "scale(1.05)",
            },
            transition: "all 0.2s ease-in-out",
          }}
        />
      ),
    },
    SalaryInfo: {
      type: "custom",
      label: "Salary Info",
      show: true,
      customRender: (row) => (
        <Tooltip
          title={
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Salary Grade: {row.SG || "N/A"}
              </Typography>
              <Typography variant="body2">Step: {row.Step || "N/A"}</Typography>
              <Typography variant="body2">
                Job Grade: {row.JG ? row.JG.toString().replace(/^JG-?/, '') : "N/A"}
              </Typography>
              <Divider sx={{ my: 1, bgcolor: "rgba(255,255,255,0.2)" }} />
              <Typography variant="body2" fontWeight={600}>
                Monthly Rate: ₱{row.Rate ? row.Rate.toLocaleString() : "N/A"}
              </Typography>
            </Box>
          }
          arrow
          componentsProps={{
            tooltip: {
              sx: {
                bgcolor: theme.palette.grey[900],
                "& .MuiTooltip-arrow": {
                  color: theme.palette.grey[900],
                },
              },
            },
          }}
        >
          <Paper
            elevation={1}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              borderRadius: "8px",
              bgcolor: alpha(theme.palette.warning.main, 0.05),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                transform: "scale(1.02)",
                boxShadow: `0 2px 8px ${alpha(
                  theme.palette.warning.main,
                  0.2
                )}`,
              },
            }}
          >
            <Typography variant="body2" fontWeight={600} color="warning.main">
              SG: {row.SG || "N/A"}
            </Typography>
            <Divider
              orientation="vertical"
              flexItem
              sx={{ bgcolor: alpha(theme.palette.warning.main, 0.3) }}
            />
            <Typography variant="body2" fontWeight={500} color="text.primary">
              ₱{row.Rate ? row.Rate.toLocaleString() : "N/A"}
            </Typography>
          </Paper>
        </Tooltip>
      ),
    },
    DateOfAppointment: {
      type: "date",
      label: "Appointment Date",
      searchable: true,
      show: true,
      customRender: (row) => {
        if (!row.DateOfAppointment) return "N/A";

        const date = new Date(row.DateOfAppointment);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <EventIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {format(date, "MMM dd, yyyy")}
            </Typography>
          </Box>
        );
      },
    },
    employeeStatus: {
      type: "text",
      label: "Status",
      searchable: true,
      show: true,
      customRender: (row) => {
        const handleStatusToggle = async (checked) => {
          const newStatus = checked ? "Active" : "Inactive";
          try {
            await api.put(`/employees/${row._id}`, {
              employeeStatus: newStatus,
            });
            toast.success(`Employee status updated to ${newStatus}`, {
              style: {
                borderRadius: "10px",
                background: theme.palette.mode === "dark" ? "#333" : "#fff",
                color: theme.palette.mode === "dark" ? "#fff" : "#333",
              },
              iconTheme: {
                primary: newStatus === "Active" ? "#4caf50" : "#f44336",
                secondary: "#FFFAEE",
              },
            });
            return true;
          } catch (error) {
            toast.error("Failed to update employee status", {
              style: {
                borderRadius: "10px",
                background: theme.palette.mode === "dark" ? "#333" : "#fff",
                color: theme.palette.mode === "dark" ? "#fff" : "#333",
              },
            });
            console.error("Error updating status:", error);
            return false;
          }
        };

        return {
          render: (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label={row.employeeStatus || "N/A"}
                color={row.employeeStatus === "Active" ? "success" : "error"}
                size="small"
                sx={{ minWidth: "70px" }}
              />
              <Switch
                checked={row.employeeStatus === "Active"}
                onChange={async (e) => {
                  const success = await handleStatusToggle(e.target.checked);
                  return success;
                }}
                color="primary"
                size="small"
                inputProps={{ "aria-label": "employee status toggle" }}
              />
            </Box>
          ),
          onChange: handleStatusToggle,
        };
      },
    },
  };

  return (
    <>
      {!activeRegion ? (
        <Fade in={true} timeout={800}>
          <Paper
            elevation={3}
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: "16px",
              bgcolor:
                theme.palette.mode === "light"
                  ? "#fff"
                  : theme.palette.background.paper,
              background: `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                0.05
              )} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          >
            <Box sx={{ mb: 3 }}>
              <GroupIcon
                sx={{
                  fontSize: 80,
                  color: theme.palette.primary.main,
                  opacity: 0.6,
                  mb: 2,
                }}
              />
            </Box>
            <Typography
              variant="h4"
              color="primary"
              fontWeight="bold"
              gutterBottom
            >
              No Region Selected
            </Typography>
            <Typography
              variant="h6"
              paragraph
              sx={{ color: "text.secondary", mb: 3 }}
            >
              Please select a region from the region selector to view employee
              data.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Employee data is region-specific for security and data isolation
              purposes.
            </Typography>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => navigate('/region-selection')}
                startIcon={<LocationIcon />}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                }}
              >
                Select Region
              </Button>
            </Box>
          </Paper>
        </Fade>
      ) : (
        <Box
          sx={{
            // Hide the DashboardHeader component completely
            "& .MuiPaper-root > div:nth-of-type(2)": {
              display: "none !important",
            },
            // Also target by searching for elements with search functionality
            "& [role='search']": {
              display: "none !important",
            },
            "& div[class*='search']": {
              display: "none !important",
            },
          }}
        >
          <EmployeeCustomPage
            dataListName="employees"
            title=""
            description=""
            schema={employeeSchema}
            searchable={false}
            hasAdd={true}
            hasEdit={true}
            hasDelete={false}
            ROWS_PER_PAGE={20}
            customAddElement={<EmployeeCustomAdd />}
            customEditElement={<EmployeeEditDialog dataListName="employees" />}
            onDataChange={refreshStats}
            refreshTrigger={refreshTrigger}
            tableContainerProps={{
              sx: {
                height: "calc(100vh - 320px)", // Adjusted since we're hiding the dashboard header
                maxHeight: "calc(100vh - 320px)", // Override the default maxHeight
                borderRadius: "16px",
                boxShadow: `0 8px 32px ${alpha(
                  theme.palette.primary.main,
                  0.12
                )}`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                bgcolor:
                  theme.palette.mode === "light"
                    ? "#ffffff"
                    : theme.palette.background.paper,
                // Enhanced table row hover effects
                "& .MuiTableBody-root .MuiTableRow-root": {
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "light"
                        ? alpha(theme.palette.primary.main, 0.04)
                        : alpha(theme.palette.primary.main, 0.08),
                    transform: "scale(1.001)",
                    boxShadow: `0 4px 8px ${alpha(
                      theme.palette.primary.main,
                      0.1
                    )}`,
                  },
                },
                // Override the existing table header styles from EmployeeCustomTable
                "& .MuiTableHead-root .MuiTableRow-root .MuiTableCell-head": {
                  bgcolor: `${theme.palette.secondary.main} !important`,
                  color: "#ffffff !important",
                  fontWeight: "600 !important",
                  fontSize: "0.875rem !important",
                  borderBottom: `1px solid ${alpha(
                    theme.palette.secondary.dark,
                    0.5
                  )} !important`,
                  textTransform: "none",
                  letterSpacing: "normal",
                  "&:hover": {
                    bgcolor: `${theme.palette.secondary.dark} !important`,
                  },
                },
                // Enhanced pagination styling
                "& .MuiTablePagination-root": {
                  borderTop: `2px solid ${alpha(
                    theme.palette.primary.main,
                    0.1
                  )}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                  "& .MuiTablePagination-toolbar": {
                    padding: theme.spacing(1, 2),
                  },
                  "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                    {
                      fontWeight: 500,
                      color: theme.palette.text.primary,
                    },
                  "& .MuiTablePagination-select": {
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: "8px",
                    border: `1px solid ${alpha(
                      theme.palette.primary.main,
                      0.2
                    )}`,
                    "&:focus": {
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 0 0 2px ${alpha(
                        theme.palette.primary.main,
                        0.2
                      )}`,
                    },
                  },
                  "& .MuiTablePagination-actions": {
                    "& .MuiIconButton-root": {
                      border: `1px solid ${alpha(
                        theme.palette.primary.main,
                        0.2
                      )}`,
                      borderRadius: "8px",
                      margin: "0 2px",
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        transform: "scale(1.05)",
                        borderColor: theme.palette.primary.main,
                      },
                      "&:disabled": {
                        opacity: 0.3,
                        "&:hover": {
                          transform: "none",
                        },
                      },
                    },
                  },
                },
              },
            }}
            headerContent={
              <Box sx={{ mb: 4 }}>
                {/* Enhanced Header Section */}
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    mb: 3,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: "white",
                    borderRadius: "16px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="h4" fontWeight="bold" gutterBottom>
                        Employee Management
                      </Typography>
                      <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        {activeRegion
                          ? `Managing employees in ${
                              activeRegion.name || activeRegion.regionName || activeRegion.Region
                            } region`
                          : "Employee management dashboard"}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                        Access Level: {displayInfo.level} - {displayInfo.scope}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.6, mt: 0.5 }}>
                        {userAccessLevel === 'DIVISION' 
                          ? `You can view and manage employees in ${userDivision || 'your division'}. You can process personnel within your division scope only.`
                          : userAccessLevel === 'DEPARTMENT'
                          ? `You can view all employees in ${userDepartment || 'your department'} and oversee all divisions.`
                          : userAccessLevel === 'BUDGET_AND_REVENUE_DIVISION'
                          ? `You have full access to view and manage all employees across all regions, divisions, and departments.`
                          : `You have full access to view and manage employees within ${regionName || 'your region'}.`
                        }
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Refresh Employee Statistics">
                        <IconButton
                          onClick={refreshStats}
                          sx={{
                            color: "white",
                            backgroundColor: alpha("#fff", 0.1),
                            "&:hover": {
                              backgroundColor: alpha("#fff", 0.2),
                              transform: "scale(1.05)",
                            },
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Analytics">
                        <IconButton
                          sx={{
                            color: "white",
                            backgroundColor: alpha("#fff", 0.1),
                            "&:hover": {
                              backgroundColor: alpha("#fff", 0.2),
                              transform: "scale(1.05)",
                            },
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          <TrendingUpIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>

                {/* Enhanced Stats Cards */}
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <Grow in={true} timeout={600}>
                      <Card
                        elevation={4}
                        sx={{
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "#ffffff"
                              : theme.palette.background.paper,
                          borderRadius: "16px",
                          overflow: "hidden",
                          position: "relative",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            transform: "translateY(-8px) scale(1.02)",
                            boxShadow: `0 20px 40px ${alpha(
                              theme.palette.primary.main,
                              0.2
                            )}`,
                          },
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            sx={{ mb: 2 }}
                          >
                            <Box>
                              <Typography
                                variant="h6"
                                color="textSecondary"
                                fontWeight={500}
                              >
                                Total Employees
                              </Typography>
                              <Typography
                                variant="h3"
                                component="div"
                                color="primary"
                                fontWeight="bold"
                                sx={{ mt: 1 }}
                              >
                                {employeeStats.total}
                              </Typography>
                            </Box>
                            <Avatar
                              sx={{
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                width: 56,
                                height: 56,
                              }}
                            >
                              <GroupIcon fontSize="large" />
                            </Avatar>
                          </Stack>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <PersonIcon color="primary" sx={{ mr: 1 }} />
                            <Typography variant="body2" color="textSecondary">
                              {activeRegion
                                ? `All employees in ${
                                    activeRegion.name || activeRegion.regionName
                                  }`
                                : "All registered employees"}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grow>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Grow in={true} timeout={800}>
                      <Card
                        elevation={4}
                        sx={{
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "#ffffff"
                              : theme.palette.background.paper,
                          borderRadius: "16px",
                          overflow: "hidden",
                          position: "relative",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            transform: "translateY(-8px) scale(1.02)",
                            boxShadow: `0 20px 40px ${alpha(
                              theme.palette.success.main,
                              0.2
                            )}`,
                          },
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            sx={{ mb: 2 }}
                          >
                            <Box>
                              <Typography
                                variant="h6"
                                color="textSecondary"
                                fontWeight={500}
                              >
                                Active Employees
                              </Typography>
                              <Typography
                                variant="h3"
                                component="div"
                                sx={{
                                  color: theme.palette.success.main,
                                  mt: 1,
                                }}
                                fontWeight="bold"
                              >
                                {employeeStats.active}
                              </Typography>
                            </Box>
                            <Avatar
                              sx={{
                                bgcolor: alpha(theme.palette.success.main, 0.1),
                                color: theme.palette.success.main,
                                width: 56,
                                height: 56,
                              }}
                            >
                              <Badge color="success" variant="dot">
                                <PersonIcon fontSize="large" />
                              </Badge>
                            </Avatar>
                          </Stack>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Badge color="success" variant="dot" sx={{ mr: 1 }}>
                              <PersonIcon
                                sx={{ color: theme.palette.success.main }}
                              />
                            </Badge>
                            <Typography variant="body2" color="textSecondary">
                              Currently active employees
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grow>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Grow in={true} timeout={1000}>
                      <Card
                        elevation={4}
                        sx={{
                          bgcolor:
                            theme.palette.mode === "light"
                              ? "#ffffff"
                              : theme.palette.background.paper,
                          borderRadius: "16px",
                          overflow: "hidden",
                          position: "relative",
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            transform: "translateY(-8px) scale(1.02)",
                            boxShadow: `0 20px 40px ${alpha(
                              theme.palette.error.main,
                              0.2
                            )}`,
                          },
                          "&::before": {
                            content: '""',
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.error.light})`,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="flex-start"
                            sx={{ mb: 2 }}
                          >
                            <Box>
                              <Typography
                                variant="h6"
                                color="textSecondary"
                                fontWeight={500}
                              >
                                Inactive Employees
                              </Typography>
                              <Typography
                                variant="h3"
                                component="div"
                                sx={{ color: theme.palette.error.main, mt: 1 }}
                                fontWeight="bold"
                              >
                                {employeeStats.inactive}
                              </Typography>
                            </Box>
                            <Avatar
                              sx={{
                                bgcolor: alpha(theme.palette.error.main, 0.1),
                                color: theme.palette.error.main,
                                width: 56,
                                height: 56,
                              }}
                            >
                              <Badge color="error" variant="dot">
                                <PersonIcon fontSize="large" />
                              </Badge>
                            </Avatar>
                          </Stack>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Badge color="error" variant="dot" sx={{ mr: 1 }}>
                              <PersonIcon
                                sx={{ color: theme.palette.error.main }}
                              />
                            </Badge>
                            <Typography variant="body2" color="textSecondary">
                              Currently inactive employees
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grow>
                  </Grid>
                </Grid>
              </Box>
            }
            footerElement={null}
          />
        </Box>
      )}
    </>
  );
};

export default EmployeeList;
