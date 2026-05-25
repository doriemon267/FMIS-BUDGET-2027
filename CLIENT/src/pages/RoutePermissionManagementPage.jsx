import React, { useState } from "react";
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
} from "@mui/material";
import {
  MdSearch,
  MdAdd,
  MdDeleteOutline,
} from "react-icons/md";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../config/api";

const roleOptions = [
  { id: "superAdmin", label: "Super Admin", color: "error" },
  { id: "preparer", label: "Preparer", color: "primary" },
  { id: "reviewer", label: "Reviewer", color: "warning" },
  { id: "approver", label: "Approver", color: "success" },
  { id: "overallBudgetApprover", label: "Overall Approver", color: "info" },
  { id: "budgetAnalyst", label: "Budget Analyst", color: "secondary" },
  { id: "regionCreator", label: "Region Creator", color: "default" },
  { id: "divisionCreator", label: "Division Creator", color: "default" },
  { id: "departmentCreator", label: "Department Creator", color: "default" },
  { id: "BUDGET_PLANNING_ANALYST", label: "Planning Analyst", color: "secondary" },
  { id: "BUDGET_OFFICER", label: "Budget Officer", color: "info" },
  { id: "BUDGET_MANAGER", label: "Budget Manager", color: "primary" },
];

const RoutePermissionManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  
  // States for Add Route Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newRoute, setNewRoute] = useState({ path: "", label: "", group: "General" });

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
      setSnackbar({ open: true, message: "Matagumpay na na-update ang permission!", severity: "success" });
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
      setNewRoute({ path: "", label: "", group: "General" });
      setSnackbar({ open: true, message: "Matagumpay na naidagdag ang bagong ruta!", severity: "success" });
    },
    onError: (err) => {
      setSnackbar({
        open: true,
        message: "Failed to add route: " + (err.response?.data?.error || err.message),
        severity: "error",
      });
    },
  });

  // 4. Mutation to delete a custom route
  const deleteRouteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/route-permissions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["route-permissions-all"]);
      setSnackbar({ open: true, message: "Matagumpay na nabura ang ruta!", severity: "success" });
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
        requiredWorkflowRoles: newRoles,
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
        excludeRoles: route.excludeRoles,
        isActive: !route.isActive,
      },
    });
  };

  const handleAddRoute = () => {
    if (!newRoute.path.startsWith("/")) {
      setSnackbar({ open: true, message: "Ang Route Path ay kailangang magsimula sa '/' (e.g. /rata)", severity: "warning" });
      return;
    }
    if (!newRoute.label) {
      setSnackbar({ open: true, message: "Kailangan ang Display Label.", severity: "warning" });
      return;
    }
    addRouteMutation.mutate(newRoute);
  };

  const handleDeleteRoute = (id) => {
    if (window.confirm("Sigurado ka bang gusto mong burahin ang rutang ito?")) {
      deleteRouteMutation.mutate(id);
    }
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
        <Alert severity="error">Nagka-error sa pag-load ng route permissions: {error.message}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Card sx={{ borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
            <Box>
              <Typography variant="h5" fontWeight="700" color="primary.main" gutterBottom>
                🛡️ Route Permission Matrix
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Magtakda ng access rules sa bawat ruta gamit ang switches at checkboxes. Awtomatikong mase-save ang mga pagbabago.
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              {(updateMutation.isPending || addRouteMutation.isPending || deleteRouteMutation.isPending) && (
                <Chip
                  icon={<CircularProgress size={14} color="inherit" />}
                  label="Sine-save..."
                  color="info"
                  variant="outlined"
                />
              )}
              <Button
                variant="contained"
                startIcon={<MdAdd />}
                onClick={() => setOpenAddDialog(true)}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: "600" }}
              >
                Magdagdag ng Ruta
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Search & Filters */}
          <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
            <TextField
              size="small"
              placeholder="Maghanap ng Ruta o Path..."
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

          {/* Permission Matrix Table */}
          <TableContainer component={Paper} sx={{ borderRadius: "8px", border: "1px solid", borderColor: "divider", maxHeight: "65vh" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "700", minWidth: 280, backgroundColor: "background.paper", zIndex: 3 }}>
                    Ruta / Page Path
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "700", minWidth: 100, backgroundColor: "background.paper", zIndex: 3 }}>
                    Active Status
                  </TableCell>
                  {roleOptions.map((role) => (
                    <TableCell
                      key={role.id}
                      align="center"
                      sx={{ fontWeight: "700", minWidth: 120, backgroundColor: "background.paper", zIndex: 3 }}
                    >
                      <Tooltip title={role.label}>
                        <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                          <Chip label={role.label} size="small" color={role.color} variant="outlined" sx={{ fontSize: "10px", height: "20px" }} />
                        </Box>
                      </Tooltip>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={roleOptions.length + 2} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Walang rutang tumutugma sa iyong hinahanap.</Typography>
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
                            <Tooltip title="Burahin itong custom ruta">
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
                        <Tooltip title={route.isActive ? "Active (Gumagana ang rules)" : "Inactive (Naka-bypass)"}>
                          <Switch
                            checked={route.isActive}
                            onChange={() => handleToggleActive(route)}
                            color="success"
                            size="small"
                          />
                        </Tooltip>
                      </TableCell>

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
        </CardContent>
      </Card>

      {/* Add Route Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Magdagdag ng Bagong Ruta</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Route Path (dapat magsimula sa '/')"
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
            <TextField
              label="Group / Kategorya"
              placeholder="Settings"
              size="small"
              fullWidth
              value={newRoute.group}
              onChange={(e) => setNewRoute({ ...newRoute, group: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>
            I-cancel
          </Button>
          <Button
            onClick={handleAddRoute}
            variant="contained"
            disabled={addRouteMutation.isPending}
            sx={{ textTransform: "none", borderRadius: "6px" }}
          >
            I-save
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
