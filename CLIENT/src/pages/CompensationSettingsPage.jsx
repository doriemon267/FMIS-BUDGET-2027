import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Stack,
  Alert,
  Divider,
  useTheme,
  alpha
} from "@mui/material";
import {
  AiFillCreditCard,
  AiOutlineEdit,
  AiOutlineEye,
  AiOutlineDownload,
  AiOutlineReload
} from "react-icons/ai";
import {
  MdSettings,
  MdTrendingUp,
  MdAccountBalance,
  MdPeople,
  MdAttachMoney
} from "react-icons/md";
import { useQuery } from "@tanstack/react-query";
import CustomPage from "../global/components/CustomPage";
import CompensationSettingsDialogForm from "../components/settings/CompensationSettingsForm";
import api from "../config/api";
import '../global/components/CreditCardIcon.css'

const CompensationSettingsPage = () => {
  const { fiscalYear } = useParams();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'

  // Fetch settings data for summary cards
  const { data: settingsData, isLoading: settingsLoading, refetch } = useQuery({
    queryKey: ["settings", fiscalYear],
    queryFn: async () => {
      // Always fetch all settings, don't filter by fiscal year for this page
      const response = await api.get('/settings');
      return response.data;
    },
  });

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedData(null);
    refetch(); // Refresh data after dialog closes
  };

  const handleAddOrEdit = (data = null) => {
    setSelectedData(data);
    setDialogOpen(true);
  };

  const handleExport = () => {
    // Export functionality
  };

  // Enhanced schema with more fields and better actions
  const settingsSchema = {
    action: {
      type: "action",
      label: "Actions",
      customRender: (row) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Compensation Settings">
            <IconButton
              size="small"
              onClick={() => handleAddOrEdit(row)}
              sx={{
                color: theme.palette.primary.main,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              <AiOutlineEdit />
            </IconButton>
          </Tooltip>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              sx={{
                color: theme.palette.info.main,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.info.main, 0.1)
                }
              }}
            >
              <AiOutlineEye />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
    fiscalYear: {
      type: "Text",
      label: "Fiscal Year",
      show: true,
      customRender: (row) => (
        <Chip
          label={row.fiscalYear}
          color={row.isActive ? "primary" : "default"}
          variant={row.isActive ? "filled" : "outlined"}
          size="small"
        />
      )
    },
    isActive: {
      type: "boolean",
      label: "Status",
      show: true,
      customRender: (row) => (
        <Chip
          label={row.isActive ? "Active" : "Inactive"}
          color={row.isActive ? "success" : "default"}
          variant="filled"
          size="small"
        />
      )
    },
    PERA: {
      type: "currency",
      label: "PERA",
      show: true,
      customRender: (row) => `₱${(row.PERA || 0).toLocaleString()}`
    },
    medicalAllowance: {
      type: "currency",
      label: "Medical Allowance",
      show: true,
      customRender: (row) => `₱${(row.medicalAllowance || 0).toLocaleString()}`
    },
    meal: {
      type: "currency",
      label: "Meal Allowance",
      show: true,
      customRender: (row) => `₱${(row.meal || 0).toLocaleString()}`
    },
    budgetType: {
      type: "Text",
      label: "Budget Type",
      show: true,
      customRender: (row) => (
        <Chip
          label={row.budgetType || "N/A"}
          color="secondary"
          variant="outlined"
          size="small"
        />
      )
    }
  };

  // Summary Cards Component
  const SummaryCards = () => {
    const activeSettings = settingsData?.settings?.find(s => s.isActive);

    const summaryData = [
      {
        title: "Active Fiscal Year",
        value: activeSettings?.fiscalYear || "None",
        icon: <MdAccountBalance />,
        color: theme.palette.primary.main,
        bgColor: alpha(theme.palette.primary.main, 0.1)
      },
      {
        title: "PERA Amount",
        value: `₱${(activeSettings?.PERA || 0).toLocaleString()}`,
        icon: <MdAttachMoney />,
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.1)
      },
      {
        title: "Medical Allowance",
        value: `₱${(activeSettings?.medicalAllowance || 0).toLocaleString()}`,
        icon: <MdPeople />,
        color: theme.palette.info.main,
        bgColor: alpha(theme.palette.info.main, 0.1)
      },
      {
        title: "Total Settings",
        value: settingsData?.settings?.length || 0,
        icon: <MdSettings />,
        color: theme.palette.warning.main,
        bgColor: alpha(theme.palette.warning.main, 0.1)
      }
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {summaryData.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                background: `linear-gradient(135deg, ${item.bgColor} 0%, ${alpha(item.color, 0.05)} 100%)`,
                border: `1px solid ${alpha(item.color, 0.2)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 8px 25px ${alpha(item.color, 0.3)}`,
                  border: `1px solid ${alpha(item.color, 0.4)}`
                }
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: item.color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color={item.color}>
                      {item.value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          color: 'white'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Compensation Settings
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage compensation rates, allowances, and government contributions
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Tooltip title="Export Settings">
              <IconButton
                onClick={handleExport}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) }
                }}
              >
                <AiOutlineDownload />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Data">
              <IconButton
                onClick={() => refetch()}
                sx={{
                  color: 'white',
                  backgroundColor: alpha('#fff', 0.1),
                  '&:hover': { backgroundColor: alpha('#fff', 0.2) }
                }}
              >
                <AiOutlineReload />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Summary Cards */}
      {!settingsLoading && <SummaryCards />}

      {/* Alert for no active settings */}
      {!settingsLoading && !settingsData?.settings?.find(s => s.isActive) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No active fiscal year settings found. Please create and activate a fiscal year setting.
        </Alert>
      )}

      <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
        <CustomPage
          dataListName="settings"
          schema={settingsSchema}
          filter={{ fiscalYear }}
          hasEdit={false}
          hasAdd={false}
          searchable={true}
          orderByDefault="fiscalYear"
          customAddElement={
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                onClick={() => handleAddOrEdit()}
                startIcon={<MdSettings />}
                sx={{
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                  boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 10px 4px ${alpha(theme.palette.primary.main, 0.3)}`
                  }
                }}
              >
                ADD COMPENSATION SETTINGS
              </Button>
              <Button
                variant="outlined"
                onClick={handleExport}
                startIcon={<AiOutlineDownload />}
                sx={{
                  borderColor: theme.palette.primary.main,
                  color: theme.palette.primary.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    borderColor: theme.palette.primary.dark
                  }
                }}
              >
                EXPORT
              </Button>
            </Stack>
          }
          title=""
          description=""
          ROWS_PER_PAGE={10}
        />
      </Paper>
      {/* Enhanced Dialog Form */}
      <CompensationSettingsDialogForm
        open={dialogOpen}
        onClose={handleDialogClose}
        fiscalYear={fiscalYear}
        editData={selectedData}
        onSaved={handleDialogClose}
      />
    </Box>
  );
};

export default CompensationSettingsPage;
