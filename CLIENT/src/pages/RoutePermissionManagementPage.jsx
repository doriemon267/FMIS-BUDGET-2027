import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Switch,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
  IconButton,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import {
  MdSearch,
  MdAdd,
  MdDeleteOutline,
  MdSync,
  MdSave,
  MdRestore,
  MdEngineering,
  MdWarning,
  MdCheckCircle,
} from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";
import { PAGE_TITLES } from "../layout/Dashboard";
import { useRoutePermissions } from "../context/RoutePermissionContext";

const roleOptions = [
  { id: "SUPER_ADMIN", label: "Admin", color: "error" },
  { id: "BUDGET_PREPARER", label: "Budget Preparer", color: "primary" },
  { id: "BUDGET_REVIEWER", label: "Budget Reviewer", color: "warning" },
  { id: "BUDGET_APPROVER", label: "Budget Approver", color: "success" },
  { id: "BUDGET_PLANNING_ANALYST", label: "Budget Planning Analyst", color: "secondary" },
  { id: "BUDGET_OFFICER", label: "Budget Officer", color: "info" },
  { id: "BUDGET_MANAGER", label: "Budget Manager", color: "primary" },
];

const proposalTypeOptions = [
  { id: "Initial", label: "Initial", color: "primary" },
  { id: "NEP", label: "NEP", color: "warning" },
  { id: "GAA", label: "GAA", color: "success" },
];

const RoutePermissionManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // States for Add Route Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newRoute, setNewRoute] = useState({
    path: "",
    label: "",
    group: "General",
    applicableProposalTypes: ["Initial", "NEP", "GAA"]
  });

  const [activeTab, setActiveTab] = useState(0);
  const [selectedRoleForView, setSelectedRoleForView] = useState(roleOptions[0].id);

  // States for Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  // ─── Maintenance Mode ──────────────────────────────────────────────────────
  const {
    isMaintenanceMode,
    maintenanceMessage,
    maintenanceUpdatedAt,
    maintenanceUpdatedBy,
    updateMaintenanceStatus,
    refetchMaintenanceStatus,
  } = useRoutePermissions();

  const [maintModeActive, setMaintModeActive] = useState(isMaintenanceMode);
  const [maintMessageInput, setMaintMessageInput] = useState(maintenanceMessage || "");
  const [isSubmittingMaint, setIsSubmittingMaint] = useState(false);

  // Sync local state with context when context changes
  useEffect(() => {
    setMaintModeActive(isMaintenanceMode);
    setMaintMessageInput(maintenanceMessage || "");
  }, [isMaintenanceMode, maintenanceMessage]);

  const handleToggleMaintenanceClick = (newChecked) => {
    setConfirmDialog({
      open: true,
      title: newChecked ? "Enable Maintenance Mode" : "Disable Maintenance Mode",
      message: newChecked
        ? "Are you sure you want to enable maintenance mode? All non-Super Admin users will be immediately locked out of the system."
        : "Are you sure you want to disable maintenance mode? All users will regain normal access.",
      onConfirm: async () => {
        setIsSubmittingMaint(true);
        try {
          await updateMaintenanceStatus(newChecked, maintMessageInput);
          setSnackbar({
            open: true,
            message: newChecked ? "✅ Maintenance Mode enabled. All users are now locked out." : "✅ Maintenance Mode disabled. Normal access restored.",
            severity: newChecked ? "warning" : "success",
          });
        } catch (err) {
          setSnackbar({
            open: true,
            message: "Failed to update maintenance mode: " + (err?.response?.data?.error || err.message),
            severity: "error",
          });
        } finally {
          setIsSubmittingMaint(false);
        }
      },
    });
  };

  const handleSaveMaintenanceMessage = async () => {
    setIsSubmittingMaint(true);
    try {
      await updateMaintenanceStatus(maintModeActive, maintMessageInput);
      setSnackbar({ open: true, message: "Maintenance message updated.", severity: "success" });
    } catch (err) {
      setSnackbar({
        open: true,
        message: "Failed to save message: " + (err?.response?.data?.error || err.message),
        severity: "error",
      });
    } finally {
      setIsSubmittingMaint(false);
    }
  };

  // 1. Fetch all routes from backend
  const { data, isLoading, error } = useQuery({
    queryKey: ["route-permissions-all"],
    queryFn: async () => {
      const res = await api.get("/route-permissions/all");
      return res.data?.routes || res.data?.["route-permissions"] || [];
    },
  });

  // 2. Mutation to update route permissions
  const updateMutation = useMutation({
    mutationFn: async ({ id, updatedData }) => {
      const res = await api.put(`/route-permissions/${id}`, updatedData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: "Permission updated successfully!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to update permission: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 3. Mutation to add new route
  const addRouteMutation = useMutation({
    mutationFn: async (routeData) => {
      const res = await api.post("/route-permissions", routeData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setOpenAddDialog(false);
      setNewRoute({
        path: "",
        label: "",
        group: "General",
        applicableProposalTypes: ["Initial", "NEP", "GAA"]
      });
      setSnackbar({ open: true, message: "New route added successfully!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to add route: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post("/route-permissions/bulk-update", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: "Bulk update successful!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed bulk update: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 4. Mutation to sync routes
  const syncRoutesMutation = useMutation({
    mutationFn: async (routesToSync) => {
      const res = await api.post("/route-permissions/sync", { routes: routesToSync });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: `Routes synced successfully! Inserted: ${data.inserted?.length}, Skipped: ${data.skipped?.length}`, severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to sync routes: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 4.1 Mutation to save current configuration as defaults
  const saveDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/route-permissions/save-defaults");
      return res.data;
    },
    onSuccess: (data) => {
      setSnackbar({ open: true, message: data.message || "Defaults saved successfully!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to save defaults: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 4.2 Mutation to restore defaults
  const restoreDefaultsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/route-permissions/restore-defaults");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: data.message || "Defaults restored successfully!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to restore defaults: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 5. Mutation to delete a custom route
  const deleteRouteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/route-permissions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: "Route deleted successfully!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to delete route: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  const handleToggleRole = (route, roleId) => {
    const isAssigned = route.requiredWorkflowRoles?.includes(roleId);
    let newRoles = [];
    if (isAssigned) {
      newRoles = route.requiredWorkflowRoles.filter((r) => r !== roleId);
    } else {
      newRoles = [...(route.requiredWorkflowRoles || []), roleId];
    }

    updateMutation.mutate({
      id: route._id,
      updatedData: {
        label: route.label,
        group: route.group,
        requiredPermissions: route.requiredPermissions,
        excludeRoles: route.excludeRoles,
        isActive: route.isActive,
        applicableProposalTypes: route.applicableProposalTypes,
        requiredWorkflowRoles: newRoles,
      },
    });
  };

  const handleToggleProposalType = (route, typeId) => {
    const isAssigned = route.applicableProposalTypes?.includes(typeId);
    let newTypes = [];
    if (isAssigned) {
      newTypes = route.applicableProposalTypes.filter((t) => t !== typeId);
    } else {
      newTypes = [...(route.applicableProposalTypes || []), typeId];
    }

    updateMutation.mutate({
      id: route._id,
      updatedData: {
        label: route.label,
        group: route.group,
        requiredPermissions: route.requiredPermissions,
        excludeRoles: route.excludeRoles,
        isActive: route.isActive,
        requiredWorkflowRoles: route.requiredWorkflowRoles,
        applicableProposalTypes: newTypes,
      },
    });
  };

  const handleToggleActive = (route) => {
    updateMutation.mutate({
      id: route._id,
      updatedData: {
        label: route.label,
        group: route.group,
        requiredPermissions: route.requiredPermissions,
        requiredWorkflowRoles: route.requiredWorkflowRoles,
        applicableProposalTypes: route.applicableProposalTypes,
        excludeRoles: route.excludeRoles,
        isActive: !route.isActive,
      },
    });
  };

  const handleBulkToggle = (groupRoutes, roleId, isSelectAll) => {
    const routeIds = groupRoutes.map(r => r._id);
    if (routeIds.length === 0) return;
    bulkUpdateMutation.mutate({
      routeIds,
      roleId,
      action: isSelectAll ? "add" : "remove"
    });
  };

  const handleAddRoute = () => {
    if (!newRoute.path.startsWith("/")) {
      setSnackbar({ open: true, message: "Route path must start with '/' (e.g. /rata)", severity: "warning" });
      return;
    }
    if (!newRoute.label) {
      setSnackbar({ open: true, message: "Display label is required.", severity: "warning" });
      return;
    }
    addRouteMutation.mutate(newRoute);
  };

  const handleDeleteRoute = (id) => {
    setConfirmDialog({
      open: true,
      title: "Confirm Deletion",
      message: "Are you sure you want to delete this route? This action cannot be undone.",
      onConfirm: () => deleteRouteMutation.mutate(id),
    });
  };

  const handleSyncRoutes = () => {
    setConfirmDialog({
      open: true,
      title: "Sync System Routes",
      message: "Are you sure you want to sync all system routes? This will automatically add any missing routes to the list.",
      onConfirm: () => {
        const routesToSync = Object.entries(PAGE_TITLES).map(([path, label]) => {
          let group = "General";
          if (path === '/dashboard') group = "Dashboard";
          else if (['/proposal', '/allproposal', '/brd-consolidation', '/nep-ceiling', '/tier', '/tier-comparison'].includes(path)) group = "Proposal Management";
          else if (['/consolidated-corporate-income', '/consolidated-reports', '/consolidated-capital-outlay-reports', '/consolidated-personnel-services-reports', '/comparative-report', '/comprehensive-reports'].includes(path)) group = "Reports & Analytics";
          else if (['/employee'].includes(path)) group = "Employees";
          else if (['/employeeBenefits', '/courtAppearance', '/overTime', '/subsistenceAllowanceMDS', '/subsistenceAllowanceST', '/subsistenceAllowance', '/loyaltyPay', '/mealallowance', '/medicalAllowance', '/childrenAllowance', '/retirees'].includes(path)) group = "Benefits";
          else if (['/fysettings', '/compensation-management', '/rata', '/categories', '/income-management', '/salary-table', '/cos-salary-table', '/employee-salary-table', '/salary-management', '/setup/organization', '/hierarchical-user-assignments', '/user-activity-logs', '/bulk-upload-management', '/route-permissions', '/settings', '/fiscalYear', '/audit-logs'].includes(path)) group = "Settings";
          else if (['/subsidy-monitoring', '/corporate-income-upload', '/mooe-upload', '/database-backup', '/grouped-income-categories', '/region-selection'].includes(path)) group = "System / Utility";
          else if (path.includes("report")) group = "Reports & Analytics";
          else if (path.includes("proposal")) group = "Proposal Management";
          else if (path.includes("tier") || path.includes("ceiling") || path.includes("brd")) group = "Proposal Management";
          else if (path.includes("setting") || path.includes("salary") || path.includes("setup") || path.includes("upload") || path.includes("permission") || path.includes("log")) group = "Settings";
          else if (path.includes("allowance") || path.includes("pay") || path.includes("employee") || path.includes("retiree") || path.includes("court")) group = "Benefits";
          return { path, label, group };
        });
        syncRoutesMutation.mutate(routesToSync);
      }
    });
  };

  const handleSaveDefaults = () => {
    setConfirmDialog({
      open: true,
      title: "Save as Default",
      message: "Are you sure you want to save the current configuration as the new default? This will overwrite any previously saved defaults.",
      onConfirm: () => saveDefaultsMutation.mutate(),
    });
  };

  const handleRestoreDefaults = () => {
    setConfirmDialog({
      open: true,
      title: "Restore Default Configuration",
      message: "Are you sure you want to restore to the default configuration? This will undo any unsaved changes.",
      onConfirm: () => restoreDefaultsMutation.mutate(),
    });
  };

  // Filter routes based on search and group selection
  const routesList = data || [];
  const groups = ["All", ...new Set(routesList.map((r) => r.group || "General"))];

  const filteredRoutes = routesList.filter((route) => {
    const matchesSearch =
      route.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (route.group || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === "All" || (route.group || "General") === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Error loading route permissions: {error.message}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* ─── MAINTENANCE MODE CARD ─────────────────────────────────────────── */}
      <Card
        sx={{
          borderRadius: "12px",
          mb: 3,
          border: maintModeActive ? "1.5px solid #eab308" : "1.5px solid transparent",
          boxShadow: maintModeActive
            ? "0 0 0 3px rgba(234,179,8,0.12), 0 4px 20px rgba(0,0,0,0.08)"
            : "0 4px 20px rgba(0,0,0,0.08)",
          transition: "all 0.3s ease",
        }}
      >
        <CardContent>
          <Box display="flex" alignItems="flex-start" gap={2} flexWrap="wrap">
            {/* Icon */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 2,
                background: maintModeActive
                  ? "linear-gradient(135deg, #fef08a, #fde047)"
                  : "rgba(0,0,0,0.05)",
                flexShrink: 0,
                transition: "all 0.3s ease",
              }}
            >
              <MdEngineering size={28} color={maintModeActive ? "#854d0e" : "#64748b"} />
            </Box>

            {/* Main Content */}
            <Box flex={1} minWidth={240}>
              <Box display="flex" alignItems="center" gap={1.5} mb={0.5} flexWrap="wrap">
                <Typography variant="h6" fontWeight={700}>
                  🔧 System Maintenance Mode
                </Typography>
                <Chip
                  icon={
                    maintModeActive ? (
                      <MdWarning size={14} />
                    ) : (
                      <MdCheckCircle size={14} />
                    )
                  }
                  label={maintModeActive ? "MAINTENANCE ACTIVE" : "SYSTEM OPERATIONAL"}
                  color={maintModeActive ? "warning" : "success"}
                  size="small"
                  sx={{ fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.06em" }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                When enabled, all non-Super Admin users are immediately locked out of the system and shown a maintenance page. Super Admin retains full access.
              </Typography>

              {/* Announcement message input */}
              <TextField
                label="Maintenance Announcement Message"
                placeholder="e.g. We are performing scheduled maintenance. Back online shortly."
                value={maintMessageInput}
                onChange={(e) => setMaintMessageInput(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                variant="outlined"
                size="small"
                sx={{ mb: 1.5 }}
                disabled={isSubmittingMaint}
              />

              {/* Meta info */}
              {maintenanceUpdatedAt && (
                <Typography variant="caption" color="text.disabled" display="block" mb={1.5}>
                  Last updated: {new Date(maintenanceUpdatedAt).toLocaleString()} by{" "}
                  <strong>{maintenanceUpdatedBy || "System"}</strong>
                </Typography>
              )}

              {/* Actions row */}
              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <Box display="flex" alignItems="center" gap={1}>
                  <Switch
                    checked={maintModeActive}
                    onChange={(e) => handleToggleMaintenanceClick(e.target.checked)}
                    disabled={isSubmittingMaint}
                    color="warning"
                    id="maintenance-mode-switch"
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {maintModeActive ? "Maintenance ON" : "Maintenance OFF"}
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSaveMaintenanceMessage}
                  disabled={isSubmittingMaint || maintMessageInput === (maintenanceMessage || "")}
                  startIcon={isSubmittingMaint ? <CircularProgress size={14} color="inherit" /> : <MdSave />}
                  sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
                >
                  Save Message
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* ─── ROUTE PERMISSION MATRIX ────────────────────────────────────────── */}
      <Card sx={{ borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
            <Box>
              <Typography variant="h5" fontWeight="700" color="primary.main" gutterBottom>
                🛡️ Route Permission Matrix
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure access rules for each route using switches and checkboxes. Changes are saved automatically.
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              {(updateMutation.isPending || addRouteMutation.isPending || deleteRouteMutation.isPending || syncRoutesMutation.isPending || saveDefaultsMutation.isPending || restoreDefaultsMutation.isPending) && (
                <Chip
                  icon={<CircularProgress size={14} color="inherit" />}
                  label="Saving..."
                  color="info"
                  variant="outlined"
                />
              )}
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<MdSave />}
                onClick={handleSaveDefaults}
                disabled={saveDefaultsMutation.isPending}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: "600" }}
              >
                Save as Default
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<MdRestore />}
                onClick={handleRestoreDefaults}
                disabled={restoreDefaultsMutation.isPending}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: "600" }}
              >
                Restore Default
              </Button>
              <Button
                variant="outlined"
                startIcon={<MdSync />}
                onClick={handleSyncRoutes}
                disabled={syncRoutesMutation.isPending}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: "600" }}
              >
                Sync Routes
              </Button>
              <Button
                variant="contained"
                startIcon={<MdAdd />}
                onClick={() => setOpenAddDialog(true)}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: "600" }}
              >
                Add Route
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Search & Filters */}
          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              size="small"
              placeholder="Search Route or Path..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: { xs: "100%", md: "350px" } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MdSearch size={20} />
                  </InputAdornment>
                ),
              }}
            />

            <Box display="flex" gap={1} flexWrap="wrap">
              {groups.map((group) => (
                <Chip
                  key={group}
                  label={group}
                  clickable
                  color={selectedGroup === group ? "primary" : "default"}
                  onClick={() => setSelectedGroup(group)}
                  variant={selectedGroup === group ? "filled" : "outlined"}
                  sx={{ fontWeight: "600" }}
                />
              ))}
            </Box>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Matrix View (By Route)" sx={{ fontWeight: 600, textTransform: "none" }} />
            <Tab label="Role Management (By Role)" sx={{ fontWeight: 600, textTransform: "none" }} />
          </Tabs>

          {activeTab === 0 && (
            <TableContainer component={Paper} sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", maxHeight: "65vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "700", minWidth: 280, backgroundColor: "background.paper", zIndex: 3 }}>
                    Route / Page Path
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "700", minWidth: 100, backgroundColor: "background.paper", zIndex: 3 }}>
                    Active Status
                  </TableCell>
                  {proposalTypeOptions.map((type) => (
                    <TableCell
                      key={type.id}
                      align="center"
                      sx={{
                        fontWeight: "700",
                        minWidth: 80,
                        backgroundColor: "background.paper",
                        zIndex: 3,
                        p: 1,
                        borderLeft: type.id === "Initial" ? "1px solid" : "none",
                        borderLeftColor: "divider",
                      }}
                    >
                      <Tooltip title={`${type.label} Proposal Type`}>
                        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                          <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 700, textAlign: "center", lineHeight: 1.2, color: type.color + ".main" }}>
                            {type.label}
                          </Typography>
                          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.disabled", mt: -0.5 }}>
                            TYPE
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  ))}
                  {roleOptions.map((role) => {
                    const allInRoleAssigned = filteredRoutes.length > 0 && filteredRoutes.every(r => r.requiredWorkflowRoles?.includes(role.id));
                    const someInRoleAssigned = filteredRoutes.some(r => r.requiredWorkflowRoles?.includes(role.id));
                    return (
                    <TableCell
                      key={role.id}
                      align="center"
                      sx={{ fontWeight: "700", minWidth: 80, backgroundColor: "background.paper", zIndex: 3, p: 1 }}
                    >
                      <Tooltip title={role.label}>
                        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                          <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 700, textAlign: "center", lineHeight: 1.2, color: "text.primary" }}>
                            {role.label}
                          </Typography>
                          <Checkbox
                            size="small"
                            sx={{ p: 0, mt: 0.5 }}
                            checked={allInRoleAssigned}
                            indeterminate={someInRoleAssigned && !allInRoleAssigned}
                            onChange={() => handleBulkToggle(filteredRoutes, role.id, !allInRoleAssigned)}
                            color={role.color}
                          />
                        </Box>
                      </Tooltip>
                    </TableCell>
                  )})}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={roleOptions.length + 2} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No routes match your search.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((route) => (
                    <TableRow key={route._id} hover>
                      {/* Route Path and Details */}
                      <TableCell>
                        <Box display="flex" alignItems="flex-start" gap={1}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                              {route.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              {route.path}
                            </Typography>
                            <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                              <Chip
                                label={route.group || "General"}
                                size="small"
                                variant="outlined"
                                sx={{ height: "16px", fontSize: "9px" }}
                              />
                              {route.requiredPermissions?.length > 0 && (
                                <Chip
                                  label={`Req: ${route.requiredPermissions.join(", ")}`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ height: "16px", fontSize: "9px" }}
                                />
                              )}
                            </Box>
                          </Box>
                          {!route.isSeeded && (
                            <Tooltip title="Delete this custom route">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteRoute(route._id)}
                                sx={{ alignSelf: "center" }}
                              >
                                <MdDeleteOutline size={18} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>

                      {/* Active Toggle Switch */}
                      <TableCell align="center">
                        <Tooltip title={route.isActive ? "Active (Rules apply)" : "Inactive (Bypassed)"}>
                          <Switch
                            checked={route.isActive}
                            onChange={() => handleToggleActive(route)}
                            color="success"
                            size="small"
                          />
                        </Tooltip>
                      </TableCell>

                      {/* Proposal Type Checkboxes */}
                      {proposalTypeOptions.map((type) => {
                        const isAssigned = route.applicableProposalTypes?.includes(type.id);
                        return (
                          <TableCell
                            key={type.id}
                            align="center"
                            sx={{
                              borderLeft: type.id === "Initial" ? "1px solid" : "none",
                              borderLeftColor: "divider",
                              backgroundColor: isAssigned ? "rgba(0, 0, 0, 0.02)" : "transparent",
                            }}
                          >
                            <Checkbox
                              checked={isAssigned || false}
                              disabled={!route.isActive}
                              onChange={() => handleToggleProposalType(route, type.id)}
                              color={type.color}
                              size="small"
                            />
                          </TableCell>
                        );
                      })}

                      {/* Role Checkboxes */}
                      {roleOptions.map((role) => {
                        const isAssigned = route.requiredWorkflowRoles?.includes(role.id);
                        return (
                          <TableCell key={role.id} align="center">
                            <Checkbox
                              checked={isAssigned || false}
                              disabled={!route.isActive}
                              onChange={() => handleToggleRole(route, role.id)}
                              color={role.color}
                              size="medium"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          )}

          {activeTab === 1 && (
            <Box>
              <FormControl sx={{ minWidth: 300, mb: 3 }}>
                <InputLabel>Select Role</InputLabel>
                <Select
                  value={selectedRoleForView}
                  label="Select Role"
                  onChange={(e) => setSelectedRoleForView(e.target.value)}
                  size="small"
                >
                  {roleOptions.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip label={role.label} size="small" color={role.color} variant="outlined" sx={{ height: 20, fontSize: '10px' }} />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {groups.filter(g => g !== 'All').map(group => {
                const routesInGroup = filteredRoutes.filter(r => (r.group || "General") === group);
                if (routesInGroup.length === 0) return null;
                return (
                  <Box key={group} mb={4}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" fontWeight="700" color="primary">
                        {group}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const allAssigned = routesInGroup.every(r => r.requiredWorkflowRoles?.includes(selectedRoleForView));
                          handleBulkToggle(routesInGroup, selectedRoleForView, !allAssigned);
                        }}
                        disabled={bulkUpdateMutation.isPending}
                        sx={{ fontSize: '0.7rem', height: 24, textTransform: "none" }}
                      >
                        {routesInGroup.every(r => r.requiredWorkflowRoles?.includes(selectedRoleForView)) ? "Deselect All" : "Select All"}
                      </Button>
                    </Box>
                    <Paper variant="outlined" sx={{ borderRadius: "8px", overflow: "hidden" }}>
                      <Table size="small">
                        <TableBody>
                          {routesInGroup.map(route => {
                            const isAssigned = route.requiredWorkflowRoles?.includes(selectedRoleForView);
                            return (
                              <TableRow key={route._id} hover>
                                <TableCell sx={{ width: 60, borderRight: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                                  <Switch
                                    checked={isAssigned || false}
                                    disabled={!route.isActive}
                                    onChange={() => handleToggleRole(route, selectedRoleForView)}
                                    color="primary"
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Box display="flex" flexDirection="column">
                                    <Typography variant="body2" fontWeight="600">{route.label}</Typography>
                                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{route.path}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ width: 100 }}>
                                  {!route.isActive && <Chip label="Inactive Route" size="small" color="error" variant="outlined" sx={{ fontSize: '9px', height: '20px' }}/>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Paper>
                  </Box>
                )
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Route Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Add New Route</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Route Path (must start with '/')"
              placeholder="/rata"
              size="small"
              fullWidth
              value={newRoute.path}
              onChange={(e) => setNewRoute({ ...newRoute, path: e.target.value })}
            />
            <TextField
              label="Display Label"
              placeholder="RATA Management"
              size="small"
              fullWidth
              value={newRoute.label}
              onChange={(e) => setNewRoute({ ...newRoute, label: e.target.value })}
            />
            <Autocomplete
              freeSolo
              options={groups.filter(g => g !== "All")}
              value={newRoute.group}
              onInputChange={(event, newInputValue) => {
                setNewRoute({ ...newRoute, group: newInputValue });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Group / Category"
                  placeholder="Settings"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleAddRoute}
            variant="contained"
            disabled={addRouteMutation.isPending}
            sx={{ textTransform: "none", borderRadius: "6px" }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        PaperProps={{ sx: { borderRadius: "12px", minWidth: "320px" } }}
      >
        <DialogTitle sx={{ fontWeight: "700", display: "flex", alignItems: "center", gap: 1 }}>
          <MdSave size={24} color="#1976d2" style={{ display: confirmDialog.title.includes("Save") ? "block" : "none" }} />
          <MdRestore size={24} color="#ed6c02" style={{ display: confirmDialog.title.includes("Restore") ? "block" : "none" }} />
          <MdDeleteOutline size={24} color="#d32f2f" style={{ display: confirmDialog.title.includes("Delete") ? "block" : "none" }} />
          <MdSync size={24} color="#0288d1" style={{ display: confirmDialog.title.includes("Sync") ? "block" : "none" }} />
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" color="text.secondary">
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            sx={{ textTransform: "none", fontWeight: "600" }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (confirmDialog.onConfirm) confirmDialog.onConfirm();
              setConfirmDialog({ ...confirmDialog, open: false });
            }}
            variant="contained"
            color={
              confirmDialog.title.includes("Delete") ? "error" :
              confirmDialog.title.includes("Restore") ? "warning" :
              "primary"
            }
            sx={{ textTransform: "none", borderRadius: "6px", fontWeight: "600" }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoutePermissionManagementPage;
