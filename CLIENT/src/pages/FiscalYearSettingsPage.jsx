// src/pages/FiscalYearSettingsPage.jsx
import React, { useState } from "react";
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
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import {
  MdCalendarToday,
  MdSettings,
  MdTrendingUp,
  MdAccountBalance,
  MdDateRange,
  MdTimer
} from "react-icons/md";
import {
  AiOutlineEdit,
  AiOutlineEye,
  AiOutlineDownload,
  AiOutlineReload,
  AiOutlinePlus,
  AiOutlineDelete
} from "react-icons/ai";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import AddSettingsDialog_Enhanced from "../components/settings/AddSettingsDialog_Enhanced";
import AddRegionExtensionDialog from "../components/settings/AddRegionExtensionDialog";
import ProposalActionsButton from "../global/components/ProposalActionsButton";
import CustomPage from "../global/components/CustomPage";
import api from "../config/api";

const FiscalYearSettingsPage = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [rowForExtension, setRowForExtension] = useState(null);
  const [extensionMenuAnchor, setExtensionMenuAnchor] = useState(null);
  const [extensionMenuRow, setExtensionMenuRow] = useState(null);
  // Periods are simplified to a single window; no separate manage dialog

  const removeExtensionMutation = useMutation({
    mutationFn: async ({ settingsId, extensionId }) => {
      await api.delete(`/settings/${settingsId}/region-extension/${extensionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["settings"]);
      toast.success("Region extension removed.");
      setExtensionMenuAnchor(null);
      setExtensionMenuRow(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to remove extension.");
    }
  });

  // Fetch settings data for summary cards
  const { data: settingsData, isLoading: settingsLoading, refetch, error } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/settings", {
        params: {
          page: 1,
          limit: 20
        }
      });
      return response.data;
    },
  });

  // Enhanced validation: allow same year with different budget type, but not same year and same budget type
  const handleOpenAddDialog = (data = null) => {
    if (!data) {
      // Adding new
      setSelectedData(null);
      setIsAddDialogOpen(true);
      return;
    }

    // Check for any id property for edit detection
    const hasId = typeof data.id !== 'undefined' || typeof data._id !== 'undefined' || typeof data.settingId !== 'undefined';
    if (data && hasId) {
      // Editing: always allow
      setSelectedData(data);
      setIsAddDialogOpen(true);
      return;
    }

    // Only for adding, check for duplicate year and budget type
    const existing = settingsData?.settings?.find(
      s => s.fiscalYear === data?.fiscalYear && s.budgetType === data?.budgetType
    );
    if (existing) {
      alert('Cannot save: Same year and same budget type already exists.');
      return;
    }
    setSelectedData(data);
    setIsAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedData(null);
    refetch(); // Refresh data after dialog closes
  };

  const handleOpenExtensionDialog = (row) => {
    setRowForExtension(row);
    setExtensionDialogOpen(true);
  };

  const handleCloseExtensionDialog = () => {
    setExtensionDialogOpen(false);
    setRowForExtension(null);
    refetch();
  };

  // No-op: periods management removed in simplified flow

  const handleExport = () => {
    // Export functionality
  };

  // Enhanced schema with better formatting and actions
  const settingsSchema = {
    action: {
      type: "action",
      label: "Actions",
      customRender: (row) => (
        <Stack direction="row" spacing={1}>
          {/* Manage Periods removed: single submission window now */}
          <Tooltip title={row.isActive ? "Edit Cut Off Settings" : "Expired/inactive settings cannot be edited. Create a new one."}>
            <span>
              <IconButton
                size="small"
                onClick={() => row.isActive && handleOpenAddDialog(row)}
                disabled={!row.isActive}
                sx={{
                  color: row.isActive ? theme.palette.primary.main : 'text.disabled',
                  '&:hover': {
                    backgroundColor: row.isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent'
                  }
                }}
              >
                <AiOutlineEdit />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Add region due date extension (same FY & budget type, extended due date for specific region)">
            <span>
              <IconButton
                size="small"
                onClick={() => handleOpenExtensionDialog(row)}
                sx={{
                  color: theme.palette.secondary.main,
                  '&:hover': { backgroundColor: alpha(theme.palette.secondary.main, 0.1) }
                }}
              >
                <AiOutlinePlus />
              </IconButton>
            </span>
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
      required: true,
      unique: true,
      searchable: true,
      show: true,
      customRender: (row) => (
        <Chip
          label={row.fiscalYear}
          color={row.isActive ? "primary" : "default"}
          variant={row.isActive ? "filled" : "outlined"}
          size="small"
          icon={<MdCalendarToday />}
        />
      )
    },
    budgetType: {
      type: "Text",
      label: "Budget Type",
      required: true,
      show: true,
      customRender: (row) => (
        <Chip
          label={row.budgetType || "N/A"}
          color={
            row.budgetType === "GAA" ? "success" :
            row.budgetType === "NEP" ? "warning" : "info"
          }
          variant="outlined"
          size="small"
        />
      )
    },
    startDate: {
      type: "date",
      label: "Start Date",
      required: true,
      show: true,
      customRender: (row) => row.startDate ? new Date(row.startDate).toLocaleDateString() : "N/A"
    },
    dueDate: {
      type: "date",
      label: "Due Date",
      required: true,
      show: true,
      customRender: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "N/A"
    },
    isActive: {
      type: "boolean",
      label: "Status",
      default: false,
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
    // Window column removed per latest design; keep schema key hidden for backward compatibility
    budgetPeriods: {
      type: "custom",
      label: "Window",
      show: false,
      customRender: () => null
    },
    applicableRegions: {
      type: "custom",
      label: "Regions",
      show: true,
      customRender: (row) => (
        <Chip
          label={row.applicableRegions?.includes("All") ? "NIA-Wide" : `${row.applicableRegions?.length || 0} Region(s)`}
          size="small"
          color={row.applicableRegions?.includes("All") ? "primary" : "default"}
          variant="outlined"
        />
      )
    },
    regionDueDateExtensions: {
      type: "custom",
      label: "Region extensions",
      show: true,
      customRender: (row) => {
        const exts = row.regionDueDateExtensions || [];
        if (exts.length === 0) {
          return (
            <Typography variant="caption" color="text.secondary">—</Typography>
          );
        }
        return (
          <>
            <Tooltip
              title={
                <Stack spacing={0.5} sx={{ py: 0.5 }}>
                  {exts.map((ext, i) => (
                    <Typography key={i} variant="caption" component="div">
                      {ext.label || `${ext.regions?.length || 0} region(s)`}: due {ext.dueDate ? new Date(ext.dueDate).toLocaleDateString() : "—"}
                    </Typography>
                  ))}
                  <Typography variant="caption" color="text.secondary">Click chip to remove an extension</Typography>
                </Stack>
              }
            >
              <Chip
                label={`${exts.length} extension(s)`}
                size="small"
                color="secondary"
                variant="outlined"
                onClick={(e) => {
                  setExtensionMenuAnchor(e.currentTarget);
                  setExtensionMenuRow(row);
                }}
                sx={{ cursor: "pointer" }}
              />
            </Tooltip>
            <Menu
              anchorEl={extensionMenuAnchor}
              open={Boolean(extensionMenuAnchor) && extensionMenuRow?._id === row._id}
              onClose={() => { setExtensionMenuAnchor(null); setExtensionMenuRow(null); }}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
              {extensionMenuRow?._id === row._id && exts.map((ext, i) => (
                <MenuItem
                  key={ext._id || i}
                  onClick={() => {
                    if (ext._id) {
                      removeExtensionMutation.mutate({ settingsId: row._id, extensionId: ext._id });
                    }
                  }}
                  disabled={!ext._id || removeExtensionMutation.isPending}
                >
                  <ListItemIcon><AiOutlineDelete fontSize="small" /></ListItemIcon>
                  <ListItemText
                    primary={ext.label || `${ext.regions?.length || 0} region(s)`}
                    secondary={ext.dueDate ? new Date(ext.dueDate).toLocaleDateString() : "—"}
                  />
                </MenuItem>
              ))}
            </Menu>
          </>
        );
      }
    },
  };

  // Summary Cards Component
  const SummaryCards = () => {
    const activeSettings = settingsData?.settings?.find(s => s.isActive);
    const totalSettings = settingsData?.settings?.length || 0;
    const activeBudgetType = activeSettings?.budgetType || "None";

    // Calculate days remaining until due date
    const daysRemaining = activeSettings?.dueDate
      ? Math.ceil((new Date(activeSettings.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

    const summaryData = [
      {
        title: "Active Fiscal Year",
        value: activeSettings?.fiscalYear || "None",
        icon: <MdCalendarToday />,
        color: theme.palette.primary.main,
        bgColor: alpha(theme.palette.primary.main, 0.1)
      },
      {
        title: "Budget Type",
        value: activeBudgetType,
        icon: <MdAccountBalance />,
        color: theme.palette.success.main,
        bgColor: alpha(theme.palette.success.main, 0.1)
      },
      {
        title: "Days Remaining",
        value: daysRemaining > 0 ? `${daysRemaining} days` : "Expired",
        icon: <MdTimer />,
        color: daysRemaining > 30 ? theme.palette.info.main :
               daysRemaining > 0 ? theme.palette.warning.main : theme.palette.error.main,
        bgColor: alpha(daysRemaining > 30 ? theme.palette.info.main :
                      daysRemaining > 0 ? theme.palette.warning.main : theme.palette.error.main, 0.1)
      },
      {
        title: "Total Settings",
        value: totalSettings,
        icon: <MdSettings />,
        color: theme.palette.secondary.main,
        bgColor: alpha(theme.palette.secondary.main, 0.1)
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
              Cut Off Settings
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Manage fiscal year periods, budget types, and cut-off dates
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
          No active fiscal year found. Please create and activate a fiscal year setting to enable budget operations.
        </Alert>
      )}

      {/* Alert for expired due date */}
      {!settingsLoading && settingsData?.settings?.find(s => s.isActive && s.dueDate && new Date(s.dueDate) < new Date()) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          The current fiscal year has expired. Please update the due date or create a new fiscal year.
        </Alert>
      )}

      <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
        <CustomPage
          dataListName="settings"
          schema={settingsSchema}
          hasEdit={false}
          hasAdd={true}
          searchable={true}
          customAddElement={
            <Stack direction="row" spacing={2} sx={{ mb: 0 }}>
              <Button
                variant="contained"
                onClick={() => handleOpenAddDialog()}
                startIcon={<AiOutlinePlus />}
                sx={{
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                  boxShadow: `0 3px 5px 2px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 10px 4px ${alpha(theme.palette.primary.main, 0.3)}`
                  }
                }}
              >
                ADD CUT OFF
              </Button>
              {/* <Button
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
              </Button> */}
            </Stack>
          }
          title=""
          description=""
          ROWS_PER_PAGE={10}
          data={settingsData?.settings?.slice().sort((a, b) => {
            // Improved sorting: numeric years at top, descending; non-numeric below, alphabetically descending
            const isNumA = /^\d+$/.test(a.fiscalYear);
            const isNumB = /^\d+$/.test(b.fiscalYear);
            if (isNumA && isNumB) {
              // Both numeric, sort descending
              return Number(b.fiscalYear) - Number(a.fiscalYear);
            }
            if (isNumA && !isNumB) {
              // a is numeric, b is not: a comes first
              return -1;
            }
            if (!isNumA && isNumB) {
              // b is numeric, a is not: b comes first
              return 1;
            }
            // Both non-numeric, sort alphabetically descending
            if (a.fiscalYear < b.fiscalYear) return 1;
            if (a.fiscalYear > b.fiscalYear) return -1;
            // If fiscalYear is equal, sort by budgetType descending
            if (a.budgetType < b.budgetType) return 1;
            if (a.budgetType > b.budgetType) return -1;
            return 0;
          })}
        />
      </Paper>

      {/* Enhanced Dialog */}
      {isAddDialogOpen && (
        <AddSettingsDialog_Enhanced
          open={isAddDialogOpen}
          onCloseDialog={handleCloseAddDialog}
          row={selectedData}
        />
      )}

      {/* Add region due date extension (same FY + budget type, different region extended due date) */}
      {extensionDialogOpen && rowForExtension && (
        <AddRegionExtensionDialog
          open={extensionDialogOpen}
          onClose={handleCloseExtensionDialog}
          settingsRow={rowForExtension}
          onSuccess={() => refetch()}
        />
      )}

      {/* Periods management dialog removed in simplified flow */}
    </Box>
  );
};

export default FiscalYearSettingsPage;
