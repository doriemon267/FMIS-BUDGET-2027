import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Stack,
  Container,
  IconButton,
  Chip,
  Avatar,
  LinearProgress,
  Fade,
  Zoom,
  Paper,
  Button,
  Tooltip,
  useTheme,
  alpha
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";
import DashboardHeader from "../global/components/DashboardHeader";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TimelineIcon from "@mui/icons-material/Timeline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useThemeContext } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeContext();
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();
  const queryClient = useQueryClient();
  const isDarkMode = mode === 'dark';
  const [animationDelay, setAnimationDelay] = useState(0);
  
  // Get user's hierarchical access information
  const userAccessLevel = currentUser?.hierarchicalAccess?.scope || 'REGION';
  const userDivision = currentUser?.hierarchicalAccess?.accessibleDivisions?.[0];
  const userDepartment = currentUser?.hierarchicalAccess?.accessibleDepartments?.[0]?.departmentName;
  
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

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboardStats", regionName, userAccessLevel],
    queryFn: async () => {
      // Include the region as a query parameter
      const res = await api.get(`/stats/overview?region=${regionName || ''}`);
      return res.data;
    },
    // Enable auto-refresh every 5 seconds to keep dashboard updated
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    // Reduce stale time so data refreshes more frequently
    staleTime: 0,
    // Only run the query if we have a region
    enabled: !!regionName,
  });

  // Fetch active settings for submission deadline
  const { data: activeSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["activeSettings"],
    queryFn: async () => {
      const res = await api.get("/settings/active");
      return res.data;
    },
    // Auto-refresh settings every 30 seconds
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000, // 10 seconds
  });

  // Fallback values if data is not yet loaded
  const totalProposals = stats?.totalProposals || 0;
  const pendingProposals = stats?.pendingProposals || 0;
  const approvedProposals = stats?.approvedProposals || 0;
  const rejectedProposals = stats?.rejectedProposals || 0;
  
  // Budgetary support counts (not included in main totals)
  const budgetarySupportTotal = stats?.budgetarySupport?.total || 0;
  const budgetarySupportPending = stats?.budgetarySupport?.pending || 0;
  const budgetarySupportApproved = stats?.budgetarySupport?.approved || 0;
  const budgetarySupportRejected = stats?.budgetarySupport?.rejected || 0;

  // Animation effect
  useEffect(() => {
    setAnimationDelay(100);
  }, []);
  
  // Refresh data when region changes
  useEffect(() => {
    if (regionName) {
      handleRefreshStats();
    }
  }, [regionName]);

  // Calculate completion percentage
  const completionRate = totalProposals > 0 ? ((approvedProposals / totalProposals) * 100).toFixed(1) : 0;

  // Format submission deadline
  const formatSubmissionDeadline = () => {
    if (!activeSettings?.dueDate) return "To Be Determined";

    const dueDate = new Date(activeSettings.dueDate);
    const now = new Date();
    const timeDiff = dueDate - now;

    // Format the date
    const formattedDate = dueDate.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    // Calculate days remaining
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return `${formattedDate} (Deadline Passed)`;
    } else if (daysRemaining === 0) {
      return `${formattedDate} (Today!)`;
    } else if (daysRemaining === 1) {
      return `${formattedDate} (Tomorrow)`;
    } else {
      return `${formattedDate} (${daysRemaining} days remaining)`;
    }
  };

  // Get deadline status for styling
  const getDeadlineStatus = () => {
    if (!activeSettings?.dueDate) return 'info';

    const dueDate = new Date(activeSettings.dueDate);
    const now = new Date();
    const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) return 'error'; // Passed
    if (daysRemaining <= 3) return 'error'; // Critical
    if (daysRemaining <= 7) return 'warning'; // Warning
    return 'success'; // Good
  };

  const handleCreateProposal = () => {
    navigate("/proposal");
  };

  const handleViewProposals = () => {
    navigate("/myProposals");
  };

  const handleGenerateReports = () => {
    navigate("/consolidated-reports");
  };

  const handleViewAllProposals = () => {
    navigate("/AllProposals");
  };

  const handleManageCategories = () => {
    navigate("/categories");
  };

  const handleFiscalYearSettings = () => {
    navigate("/fysettings");
  };

  const handleIncomeManagement = () => {
    navigate("/income-management");
  };

  const handleRefreshStats = async () => {
    await queryClient.invalidateQueries(["dashboardStats", regionName, userAccessLevel]);
    await queryClient.invalidateQueries(["activeSettings"]);
  };

  return (
    <>
      <DashboardHeader
        title={`Dashboard - ${displayInfo.scope}`}
        description={`Overview of budget proposals and system status for ${displayInfo.name}`}
        action={
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={`${isDarkMode ? '🌙 Dark' : '☀️ Light'} Mode`}
              variant="outlined"
              size="small"
              sx={{
                color: 'inherit',
                borderColor: alpha('#fff', 0.4),
                fontWeight: 600,
                fontSize: '0.75rem',
                '&:hover': {
                  borderColor: alpha('#fff', 0.6),
                  bgcolor: alpha('#fff', 0.1)
                }
              }}
            />
            <Tooltip title={`Click to switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}>
              <IconButton
                onClick={toggleTheme}
                color="inherit"
                sx={{
                  p: 1.5,
                  border: `2px solid ${alpha('#fff', 0.3)}`,
                  borderRadius: 2,
                  bgcolor: alpha('#fff', 0.1),
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'rotate(180deg) scale(1.15)',
                    bgcolor: alpha('#fff', 0.2),
                    borderColor: alpha('#fff', 0.5),
                    boxShadow: `0 6px 16px ${alpha('#000', 0.3)}`
                  },
                  '&:active': {
                    transform: 'rotate(180deg) scale(1.05)',
                  }
                }}
              >
                {isDarkMode ? <Brightness7Icon sx={{ fontSize: 24 }} /> : <Brightness4Icon sx={{ fontSize: 24 }} />}
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <Container maxWidth="xl">
        {/* Enhanced Welcome Card */}
        <Fade in timeout={800}>
          <Card
            elevation={isDarkMode ? 8 : 6}
            sx={{
              mt: 3,
              mb: 4,
              borderRadius: 3,
              background: isDarkMode
                ? "linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)"
                : "linear-gradient(135deg, rgba(38, 69, 36, 0.9) 0%, rgba(55, 94, 56, 0.8) 50%, rgba(76, 175, 80, 0.7) 100%)",
              color: "white",
              position: "relative",
              overflow: "hidden",
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: isDarkMode
                  ? 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)'
                  : 'radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.2) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none'
              }
            }}
          >
            <CardContent sx={{ py: 4, px: 4, position: 'relative', zIndex: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Typography variant="h4" fontWeight="bold" sx={{ mb: 0 }}>
                      Welcome back, {currentUser?.FirstName || 'User'}! 👋
                    </Typography>
                    <Chip
                      label="Online"
                      color="success"
                      size="small"
                      sx={{
                        bgcolor: alpha('#10b981', 0.2),
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontWeight: 600
                      }}
                    />
                  </Stack>
                  <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
                    Budget Proposal Management System - {displayInfo.scope}
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: '600px', mb: 3 }}>
                    {userAccessLevel === 'DIVISION' 
                      ? `Manage budget proposals for your division. You can create proposals within your division scope and process COS personnel data within your access boundaries.`
                      : userAccessLevel === 'DEPARTMENT'
                      ? `Manage budget proposals across your department. You have oversight of all divisions within your department and can process COS personnel accordingly.`
                      : `Manage and track all your budget proposals in one place. Create new proposals, monitor their status, and generate comprehensive reports for ${displayInfo.name}.`
                    }
                  </Typography>
                  
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    {displayInfo.name && (
                      <Chip
                        label={`Active ${displayInfo.level}: ${displayInfo.name}`}
                        color="primary"
                        variant="outlined"
                        size="medium"
                        sx={{
                          bgcolor: alpha('#fff', 0.1),
                          color: '#fff',
                          borderColor: alpha('#fff', 0.3),
                          fontWeight: 600,
                          '&:hover': {
                            bgcolor: alpha('#fff', 0.2),
                            borderColor: alpha('#fff', 0.5)
                          }
                        }}
                      />
                    )}
                    <Chip
                      label={`${totalProposals} Total Proposals`}
                      variant="outlined"
                      size="medium"
                      sx={{
                        bgcolor: alpha('#fff', 0.1),
                        color: '#fff',
                        borderColor: alpha('#fff', 0.3),
                        fontWeight: 600
                      }}
                    />
                    <Chip
                      label={`${completionRate}% Completed`}
                      variant="outlined"
                      size="medium"
                      sx={{
                        bgcolor: alpha('#fff', 0.1),
                        color: '#fff',
                        borderColor: alpha('#fff', 0.3),
                        fontWeight: 600
                      }}
                    />
                  </Stack>
                </Box>
                
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <Stack spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        width: 90,
                        height: 90,
                        bgcolor: alpha('#fff', 0.2),
                        border: '3px solid rgba(255,255,255,0.3)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                      }}
                    >
                      <AssessmentIcon sx={{ fontSize: 45 }} />
                    </Avatar>
                    <Typography variant="caption" sx={{ opacity: 0.8, textAlign: 'center' }}>
                      Last Updated<br />
                      {new Date().toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Fade>

        {/* Enhanced Stats Cards */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                📊 Proposal Statistics - {displayInfo.scope}
              </Typography>
              {stats?.region && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Showing data for {displayInfo.name}. 
                  Excludes Budgetary Support items. Last updated: {new Date().toLocaleTimeString('en-PH')}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                onClick={handleRefreshStats}
                disabled={isLoading}
                startIcon={<RefreshIcon />}
                sx={{
                  fontSize: '0.75rem',
                  borderRadius: 2,
                  px: 2,
                  '& .MuiButton-startIcon': {
                    animation: isLoading ? 'spin 1s linear infinite' : 'none'
                  },
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' }
                  }
                }}
              >
                {isLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              {regionName && (
                <Chip
                  label={`Region: ${regionName}`}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ mr: 1, fontWeight: 600 }}
                />
              )}
              <Chip
                label={`${completionRate}% Completion Rate`}
                color="success"
                variant="outlined"
                icon={<TimelineIcon />}
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Zoom in timeout={600}>
                <Card
                  elevation={isDarkMode ? 8 : 4}
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
                      : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(14, 165, 233, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? '0 20px 40px rgba(59, 130, 246, 0.3)'
                        : '0 20px 40px rgba(14, 165, 233, 0.2)'
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: alpha('#3b82f6', 0.1),
                      mb: 2
                    }}>
                      <TrendingUpIcon sx={{ fontSize: 32, color: '#3b82f6' }} />
                    </Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom color="text.primary">
                      Total Proposals
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#3b82f6' }}>
                      {isLoading ? "..." : totalProposals}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha('#3b82f6', 0.1),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#3b82f6'
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in timeout={800}>
                <Card
                  elevation={isDarkMode ? 8 : 4}
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    border: isDarkMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(217, 119, 6, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? '0 20px 40px rgba(245, 158, 11, 0.3)'
                        : '0 20px 40px rgba(217, 119, 6, 0.2)'
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: alpha('#f59e0b', 0.1),
                      mb: 2
                    }}>
                      <PendingActionsIcon sx={{ fontSize: 32, color: '#f59e0b' }} />
                    </Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom color="text.primary">
                      Pending
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#f59e0b' }}>
                      {isLoading ? "..." : pendingProposals}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={totalProposals > 0 ? (pendingProposals / totalProposals) * 100 : 0}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha('#f59e0b', 0.1),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#f59e0b'
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in timeout={1000}>
                <Card
                  elevation={isDarkMode ? 8 : 4}
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                      : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                    border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(5, 150, 105, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? '0 20px 40px rgba(16, 185, 129, 0.3)'
                        : '0 20px 40px rgba(5, 150, 105, 0.2)'
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: alpha('#10b981', 0.1),
                      mb: 2
                    }}>
                      <CheckCircleIcon sx={{ fontSize: 32, color: '#10b981' }} />
                    </Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom color="text.primary">
                      Approved
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#10b981' }}>
                      {isLoading ? "..." : approvedProposals}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={totalProposals > 0 ? (approvedProposals / totalProposals) * 100 : 0}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha('#10b981', 0.1),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#10b981'
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Zoom in timeout={1200}>
                <Card
                  elevation={isDarkMode ? 8 : 4}
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                      : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                    border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(220, 38, 38, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? '0 20px 40px rgba(239, 68, 68, 0.3)'
                        : '0 20px 40px rgba(220, 38, 38, 0.2)'
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 3 }}>
                    <Box sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      bgcolor: alpha('#ef4444', 0.1),
                      mb: 2
                    }}>
                      <CancelIcon sx={{ fontSize: 32, color: '#ef4444' }} />
                    </Box>
                    <Typography variant="h6" fontWeight="600" gutterBottom color="text.primary">
                      Rejected
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ color: '#ef4444' }}>
                      {isLoading ? "..." : rejectedProposals}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={totalProposals > 0 ? (rejectedProposals / totalProposals) * 100 : 0}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha('#ef4444', 0.1),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: '#ef4444'
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </Zoom>
            </Grid>
          </Grid>
        </Box>

        {/* Budgetary Support Stats (Separate Section) */}
        {budgetarySupportTotal > 0 && (
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  📋 Budgetary Support Items {regionName ? `- ${regionName} Region` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Budgetary support items are tracked separately from regular proposals
                </Typography>
              </Box>
            </Stack>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={isDarkMode ? 4 : 2}
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom color="text.secondary">
                      Total Budgetary Support
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#64748b' }}>
                      {isLoading ? "..." : budgetarySupportTotal}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={isDarkMode ? 4 : 2}
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom color="text.secondary">
                      Pending
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#f59e0b' }}>
                      {isLoading ? "..." : budgetarySupportPending}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={isDarkMode ? 4 : 2}
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom color="text.secondary">
                      Approved
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#10b981' }}>
                      {isLoading ? "..." : budgetarySupportApproved}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card
                  elevation={isDarkMode ? 4 : 2}
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                      : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                  }}
                >
                  <CardContent sx={{ textAlign: "center", p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="600" gutterBottom color="text.secondary">
                      Rejected
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ color: '#ef4444' }}>
                      {isLoading ? "..." : budgetarySupportRejected}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Enhanced Quick Actions */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
            🚀 Quick Actions
          </Typography>
          <Grid container spacing={3}>
            {/* Create New Proposal */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={1000}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha(theme.palette.primary.main, 0.2)}`
                        : `0 20px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleCreateProposal}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <AddCircleOutlineIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Create New Proposal
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Start a new budget proposal submission with our intuitive step-by-step wizard.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        color="primary"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600
                        }}
                      >
                        Get Started
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* View My Proposals */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={1200}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha(theme.palette.secondary.main, 0.2)}`
                        : `0 20px 40px ${alpha(theme.palette.secondary.main, 0.15)}`,
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleViewProposals}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <ListAltIcon sx={{ fontSize: 32, color: 'secondary.main' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          My Proposals
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          View and manage your submitted budget proposals and track their status.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        color="secondary"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600
                        }}
                      >
                        View My Proposals
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* Generate Reports */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={1400}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#10b981', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#10b981', 0.2)}`
                        : `0 20px 40px ${alpha('#10b981', 0.15)}`,
                      border: `1px solid ${alpha('#10b981', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleGenerateReports}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#10b981', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <AssessmentIcon sx={{ fontSize: 32, color: '#10b981' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Generate Reports
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Create customized reports and export comprehensive data for analysis.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#10b981',
                          borderColor: '#10b981',
                          '&:hover': {
                            borderColor: '#059669',
                            bgcolor: alpha('#10b981', 0.1)
                          }
                        }}
                      >
                        Generate Reports
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* View All Proposals (Admin) */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={1600}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#8b5cf6', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#8b5cf6', 0.2)}`
                        : `0 20px 40px ${alpha('#8b5cf6', 0.15)}`,
                      border: `1px solid ${alpha('#8b5cf6', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleViewAllProposals}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#8b5cf6', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <AssessmentIcon sx={{ fontSize: 32, color: '#8b5cf6' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          All Proposals
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Review and manage all budget proposals across regions (Admin access).
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#8b5cf6',
                          borderColor: '#8b5cf6',
                          '&:hover': {
                            borderColor: '#7c3aed',
                            bgcolor: alpha('#8b5cf6', 0.1)
                          }
                        }}
                      >
                        View All Proposals
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* Manage Categories */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={1800}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#f59e0b', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#f59e0b', 0.2)}`
                        : `0 20px 40px ${alpha('#f59e0b', 0.15)}`,
                      border: `1px solid ${alpha('#f59e0b', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleManageCategories}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#f59e0b', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <ListAltIcon sx={{ fontSize: 32, color: '#f59e0b' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Manage Categories
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Configure budget categories and manage system classifications.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#f59e0b',
                          borderColor: '#f59e0b',
                          '&:hover': {
                            borderColor: '#d97706',
                            bgcolor: alpha('#f59e0b', 0.1)
                          }
                        }}
                      >
                        Manage Categories
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* Fiscal Year Settings */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={2000}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#ef4444', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#ef4444', 0.2)}`
                        : `0 20px 40px ${alpha('#ef4444', 0.15)}`,
                      border: `1px solid ${alpha('#ef4444', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleFiscalYearSettings}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#ef4444', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <CalendarTodayIcon sx={{ fontSize: 32, color: '#ef4444' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Fiscal Year Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Configure fiscal year parameters and budget submission deadlines.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#ef4444',
                          borderColor: '#ef4444',
                          '&:hover': {
                            borderColor: '#dc2626',
                            bgcolor: alpha('#ef4444', 0.1)
                          }
                        }}
                      >
                        Fiscal Settings
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>
          </Grid>
        </Box>

        {/* Management Tools Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
            🛠️ Management Tools
          </Typography>
          <Grid container spacing={3}>
            {/* Employee Management */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={2200}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#06b6d4', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#06b6d4', 0.2)}`
                        : `0 20px 40px ${alpha('#06b6d4', 0.15)}`,
                      border: `1px solid ${alpha('#06b6d4', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={() => navigate("/employee")}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#06b6d4', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <TrendingUpIcon sx={{ fontSize: 32, color: '#06b6d4' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Employee Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Manage employee records, benefits, and personnel information.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#06b6d4',
                          borderColor: '#06b6d4',
                          '&:hover': {
                            borderColor: '#0891b2',
                            bgcolor: alpha('#06b6d4', 0.1)
                          }
                        }}
                      >
                        Manage Employees
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* Income Management */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={2400}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#84cc16', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#84cc16', 0.2)}`
                        : `0 20px 40px ${alpha('#84cc16', 0.15)}`,
                      border: `1px solid ${alpha('#84cc16', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={handleIncomeManagement}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#84cc16', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <TrendingUpIcon sx={{ fontSize: 32, color: '#84cc16' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Income Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Track and manage corporate income, revenues, and financial data.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#84cc16',
                          borderColor: '#84cc16',
                          '&:hover': {
                            borderColor: '#65a30d',
                            bgcolor: alpha('#84cc16', 0.1)
                          }
                        }}
                      >
                        Manage Income
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>

            {/* Employee Benefits */}
            <Grid item xs={12} sm={6} md={4}>
              <Fade in timeout={2600}>
                <Card
                  elevation={isDarkMode ? 6 : 3}
                  sx={{
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: isDarkMode
                      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    border: `1px solid ${alpha('#f97316', 0.1)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: isDarkMode
                        ? `0 20px 40px ${alpha('#f97316', 0.2)}`
                        : `0 20px 40px ${alpha('#f97316', 0.15)}`,
                      border: `1px solid ${alpha('#f97316', 0.3)}`
                    },
                    height: '100%'
                  }}
                  onClick={() => navigate("/employeeBenefits")}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 3,
                        bgcolor: alpha('#f97316', 0.1),
                        alignSelf: 'flex-start'
                      }}>
                        <CheckCircleIcon sx={{ fontSize: 32, color: '#f97316' }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                          Employee Benefits
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          Manage allowances, overtime, court appearances, and other benefits.
                        </Typography>
                      </Box>
                      <Button
                        variant="outlined"
                        sx={{
                          alignSelf: 'flex-start',
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          color: '#f97316',
                          borderColor: '#f97316',
                          '&:hover': {
                            borderColor: '#ea580c',
                            bgcolor: alpha('#f97316', 0.1)
                          }
                        }}
                      >
                        Manage Benefits
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Fade>
            </Grid>
          </Grid>
        </Box>

        {/* Enhanced Announcements & Deadlines */}
        <Fade in timeout={1600}>
          <Paper
            elevation={isDarkMode ? 8 : 4}
            sx={{
              borderRadius: 3,
              mb: 4,
              background: isDarkMode
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
              overflow: 'hidden'
            }}
          >
            <Box sx={{
              background: isDarkMode
                ? 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)'
                : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
              p: 3,
              color: 'white'
            }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={2}>
                  <NotificationsIcon sx={{ fontSize: 28 }} />
                  <Typography variant="h5" fontWeight="bold">
                    📢 Announcements & Important Dates
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    color: 'white',
                    borderColor: alpha('#fff', 0.3),
                    '&:hover': {
                      borderColor: alpha('#fff', 0.5),
                      bgcolor: alpha('#fff', 0.1)
                    }
                  }}
                  startIcon={<RefreshIcon />}
                  onClick={handleRefreshStats}
                >
                  Refresh
                </Button>
              </Stack>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                  <Stack spacing={3}>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 3,
                      borderRadius: 3,
                      bgcolor: alpha(getDeadlineStatus() === 'error' ? '#ef4444' : getDeadlineStatus() === 'warning' ? '#f59e0b' : '#10b981', 0.1),
                      border: `2px solid ${alpha(getDeadlineStatus() === 'error' ? '#ef4444' : getDeadlineStatus() === 'warning' ? '#f59e0b' : '#10b981', 0.2)}`,
                      transition: 'all 0.3s ease'
                    }}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: '50%',
                        bgcolor: getDeadlineStatus() === 'error' ? '#ef4444' : getDeadlineStatus() === 'warning' ? '#f59e0b' : '#10b981',
                        mr: 3,
                        boxShadow: `0 4px 12px ${alpha(getDeadlineStatus() === 'error' ? '#ef4444' : getDeadlineStatus() === 'warning' ? '#f59e0b' : '#10b981', 0.3)}`
                      }}>
                        <CalendarTodayIcon sx={{ fontSize: 20, color: 'white' }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            color={getDeadlineStatus() === 'error' ? '#ef4444' : getDeadlineStatus() === 'warning' ? '#f59e0b' : '#10b981'}
                          >
                            Submission Deadline
                          </Typography>
                          <Chip
                            label={getDeadlineStatus() === 'error' ? 'Overdue' : getDeadlineStatus() === 'warning' ? 'Urgent' : 'On Track'}
                            size="small"
                            color={getDeadlineStatus() === 'error' ? 'error' : getDeadlineStatus() === 'warning' ? 'warning' : 'success'}
                            sx={{ fontWeight: 600 }}
                          />
                        </Stack>
                        <Typography variant="body1" fontWeight="600" sx={{ wordBreak: 'break-word', mb: 1 }}>
                          {settingsLoading ? "Loading..." : formatSubmissionDeadline()}
                        </Typography>
                        {activeSettings?.fiscalYear && (
                          <Typography variant="body2" color="text.secondary">
                            Fiscal Year: {activeSettings.fiscalYear} | Budget Type: {activeSettings?.budgetType || "Not Set"}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      p: 3, 
                      borderRadius: 3, 
                      bgcolor: alpha('#3b82f6', 0.1),
                      border: `2px solid ${alpha('#3b82f6', 0.2)}`,
                      transition: 'all 0.3s ease'
                    }}>
                      <Box sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: '50%',
                        bgcolor: '#3b82f6',
                        mr: 3,
                        boxShadow: `0 4px 12px ${alpha('#3b82f6', 0.3)}`
                      }}>
                        <TimelineIcon sx={{ fontSize: 20, color: 'white' }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight="bold" color="#3b82f6" gutterBottom>
                          System Performance
                        </Typography>
                        <Stack direction="row" spacing={3}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Active Users: <strong>24</strong>
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Uptime: <strong>99.9%</strong>
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Last Backup: <strong>2 hours ago</strong>
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: `2px solid ${alpha(theme.palette.info.main, 0.1)}`,
                    height: '100%',
                    minHeight: '200px'
                  }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom color="info.main" sx={{ mb: 3 }}>
                      📊 Quick Stats Overview
                    </Typography>
                    <Stack spacing={3}>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha('#10b981', 0.1)
                      }}>
                        <Typography variant="body2" fontWeight="600">Approval Rate:</Typography>
                        <Chip 
                          label={`${completionRate}%`} 
                          size="small" 
                          color="success" 
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha('#f59e0b', 0.1)
                      }}>
                        <Typography variant="body2" fontWeight="600">Pending Review:</Typography>
                        <Chip 
                          label={pendingProposals} 
                          size="small" 
                          color="warning" 
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha('#3b82f6', 0.1)
                      }}>
                        <Typography variant="body2" fontWeight="600">{displayInfo.level} Active:</Typography>
                        <Chip 
                          label={displayInfo.name || 'N/A'} 
                          size="small" 
                          color="info" 
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              </Grid>

              {stats?.settings?.additionalAnnouncements?.length > 0 && (
                <Box sx={{ mt: 4, pt: 4, borderTop: `2px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                    📋 Additional Announcements
                  </Typography>
                  <Stack spacing={2}>
                    {stats.settings.additionalAnnouncements.map((announcement, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          p: 3, 
                          borderRadius: 3, 
                          bgcolor: alpha(theme.palette.info.main, 0.05),
                          border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            transform: 'translateX(8px)'
                          }
                        }}
                      >
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: 'info.main',
                          mr: 3,
                          flexShrink: 0
                        }} />
                        <Typography variant="body1" fontWeight="500">
                          {announcement}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Paper>
        </Fade>
      </Container>
    </>
  );
};

export default HomePage;
