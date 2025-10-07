import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarExport,
  GridToolbarDensitySelector,
} from "@mui/x-data-grid";
import {
  Box,
  IconButton,
  Collapse,
  Typography,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  Paper,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
} from "@mui/material";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  Edit,
  Delete,
  Add,
  Save,
  Cancel,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { NumericFormat } from "react-number-format";
import { toast } from "react-toastify";
import api from "../../config/api";
import { useRegion } from "../../context/RegionContext";
import { useUser } from "../../context/UserContext";

// Number format component
const NumberFormatCustom = React.forwardRef(function NumberFormatCustom(props, ref) {
  const { onChange, name = "amount", ...other } = props;

  return (
    <NumericFormat
      {...other}
      getInputRef={ref}
      onValueChange={(values) => {
        onChange({
          target: {
            name: name,
            value: values.value,
          },
        });
      }}
      thousandSeparator
      valueIsNumericString
      prefix="₱"
    />
  );
});

// Format number helper
const formatNumber = (number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number || 0);
};

// Custom Toolbar
function CustomToolbar({ onRefresh, onAddNew, loading }) {
  return (
    <GridToolbarContainer sx={{ p: 1, gap: 1 }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      <Box sx={{ flexGrow: 1 }} />
      <Button
        size="small"
        startIcon={<Refresh />}
        onClick={onRefresh}
        disabled={loading}
      >
        Refresh
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<Add />}
        onClick={onAddNew}
      >
        Add New
      </Button>
    </GridToolbarContainer>
  );
}

// Expandable Detail Row Component
function DetailRow({ details, onEdit, onDelete, canEdit, canDelete }) {
  if (!details || details.length === 0) {
    return (
      <Box sx={{ p: 2, bgcolor: "#f5f5f5" }}>
        <Typography variant="body2" color="text.secondary">
          No breakdown details available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: "#f9f9f9" }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Breakdown Details ({details.length} items)
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {details.map((detail, index) => (
          <Paper
            key={detail._id || index}
            elevation={0}
            sx={{
              p: 1.5,
              border: "1px solid #e0e0e0",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {detail.particulars || "No particulars"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Box sx={{ textAlign: "right", minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">
                  Income
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  ₱{formatNumber(detail.income_amount)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">
                  Subsidy
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  ₱{formatNumber(detail.subsidy_amount)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", minWidth: 120 }}>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                  ₱{formatNumber((detail.income_amount || 0) + (detail.subsidy_amount || 0))}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

const CapitalOutlayDataGrid = ({ onDataChange, disableIncomeInputs = false }) => {
  // State
  const [capitalOutlays, setCapitalOutlays] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [capitalOutlayDetails, setCapitalOutlayDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Context
  const { currentUser } = useUser();
  const { activeRegion } = useRegion();

  // Permissions
  const canEdit = useMemo(() => {
    if (!currentUser || !currentUser.Roles) return false;
    return currentUser.Roles.some(
      (role) =>
        role.toUpperCase().includes("ADMIN") ||
        role.toUpperCase().includes("BUDGET")
    );
  }, [currentUser]);

  const canDelete = useMemo(() => {
    if (!currentUser || !currentUser.Roles) return false;
    return currentUser.Roles.some(
      (role) =>
        role.toUpperCase().includes("ADMIN") ||
        role.toUpperCase().includes("SUPER")
    );
  }, [currentUser]);

  // Fetch capital outlays
  const fetchCapitalOutlays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        region: activeRegion,
        fiscalYear: new Date().getFullYear(),
      };

      const response = await api.get("/api/capital-outlay", { params });
      const data = response.data.capitalOutlays || [];

      setCapitalOutlays(data);
      onDataChange?.(data);
    } catch (err) {
      console.error("Error fetching capital outlays:", err);
      setError(err.message || "Failed to fetch capital outlays");
      toast.error("Failed to load capital outlays");
    } finally {
      setLoading(false);
    }
  }, [activeRegion, onDataChange]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/api/categories");
      setCategories(response.data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
      toast.error("Failed to load categories");
    }
  }, []);

  // Fetch details for a specific capital outlay
  const fetchDetails = useCallback(async (capitalOutlayId) => {
    if (capitalOutlayDetails[capitalOutlayId]) {
      return; // Already loaded
    }

    try {
      setLoadingDetails((prev) => ({ ...prev, [capitalOutlayId]: true }));
      const response = await api.get(`/api/capital-outlay/${capitalOutlayId}/details`);
      const details = response.data.details || [];

      setCapitalOutlayDetails((prev) => ({
        ...prev,
        [capitalOutlayId]: details,
      }));
    } catch (err) {
      console.error("Error fetching details:", err);
      toast.error("Failed to load breakdown details");
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [capitalOutlayId]: false }));
    }
  }, [capitalOutlayDetails]);

  // Toggle row expansion
  const handleToggleExpand = useCallback(
    (id) => {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
        fetchDetails(id); // Fetch details when expanding
      }
      setExpandedRows(newExpanded);
    },
    [expandedRows, fetchDetails]
  );

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return;

    try {
      await api.delete(`/api/capital-outlay/${itemToDelete}`);
      toast.success("Capital outlay deleted successfully");
      fetchCapitalOutlays();
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error("Error deleting capital outlay:", err);
      toast.error("Failed to delete capital outlay");
    }
  }, [itemToDelete, fetchCapitalOutlays]);

  // Initial load
  useEffect(() => {
    fetchCapitalOutlays();
    fetchCategories();
  }, [fetchCapitalOutlays, fetchCategories]);

  // DataGrid columns
  const columns = useMemo(
    () => [
      {
        field: "expand",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const isExpanded = expandedRows.has(params.row._id);
          const details = capitalOutlayDetails[params.row._id] || [];
          const hasDetails = details.length > 0;

          return (
            <Tooltip title={hasDetails ? "Show breakdown" : "No breakdown details"}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleToggleExpand(params.row._id)}
                  disabled={!hasDetails && !loadingDetails[params.row._id]}
                >
                  {loadingDetails[params.row._id] ? (
                    <CircularProgress size={20} />
                  ) : isExpanded ? (
                    <KeyboardArrowUp />
                  ) : (
                    <KeyboardArrowDown />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      },
      {
        field: "categoryName",
        headerName: "TITLE",
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => params.row.category?.name || params.row.categoryName || "-",
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {params.value}
          </Typography>
        ),
      },
      {
        field: "sublineItem",
        headerName: "Subline Item",
        flex: 1,
        minWidth: 150,
      },
      {
        field: "accountingTitle",
        headerName: "Accounting Title",
        flex: 1,
        minWidth: 150,
      },
      {
        field: "uacsCode",
        headerName: "UACS Code",
        width: 120,
      },
      {
        field: "particulars",
        headerName: "Particulars",
        flex: 1.5,
        minWidth: 200,
        renderCell: (params) => {
          const details = capitalOutlayDetails[params.row._id] || [];
          const itemCount = details.length;

          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {params.value || "-"}
              </Typography>
              {itemCount > 0 && (
                <Chip
                  label={`${itemCount} item${itemCount > 1 ? "s" : ""}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          );
        },
      },
      {
        field: "income",
        headerName: "INCOME",
        width: 140,
        type: "number",
        valueFormatter: (params) => `₱${formatNumber(params.value)}`,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ₱{formatNumber(params.value)}
          </Typography>
        ),
      },
      {
        field: "subsidy",
        headerName: "SUBSIDY",
        width: 140,
        type: "number",
        valueFormatter: (params) => `₱${formatNumber(params.value)}`,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ₱{formatNumber(params.value)}
          </Typography>
        ),
      },
      {
        field: "cost",
        headerName: "TOTAL",
        width: 140,
        type: "number",
        valueGetter: (params) => (params.row.income || 0) + (params.row.subsidy || 0),
        valueFormatter: (params) => `₱${formatNumber(params.value)}`,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
            ₱{formatNumber(params.value)}
          </Typography>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => {
                    // TODO: Implement edit functionality
                    toast.info("Edit functionality coming soon");
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setItemToDelete(params.row._id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [expandedRows, capitalOutlayDetails, loadingDetails, canEdit, canDelete, handleToggleExpand]
  );

  // Row with detail panel
  const getDetailPanelContent = useCallback(
    ({ row }) => {
      const details = capitalOutlayDetails[row._id] || [];
      return (
        <DetailRow
          details={details}
          onEdit={() => {}}
          onDelete={() => {}}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      );
    },
    [capitalOutlayDetails, canEdit, canDelete]
  );

  const getDetailPanelHeight = useCallback(() => "auto", []);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "calc(100vh - 200px)" }}>
      <DataGrid
        rows={capitalOutlays}
        columns={columns}
        getRowId={(row) => row._id}
        loading={loading}
        pageSizeOptions={[10, 25, 50, 100]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        checkboxSelection
        disableRowSelectionOnClick
        getDetailPanelHeight={getDetailPanelHeight}
        getDetailPanelContent={getDetailPanelContent}
        isRowExpanded={(row) => expandedRows.has(row._id)}
        slots={{
          toolbar: CustomToolbar,
        }}
        slotProps={{
          toolbar: {
            onRefresh: fetchCapitalOutlays,
            onAddNew: () => toast.info("Add new functionality coming soon"),
            loading,
          },
        }}
        sx={{
          "& .MuiDataGrid-row": {
            cursor: "pointer",
          },
          "& .MuiDataGrid-cell:focus": {
            outline: "none",
          },
          "& .MuiDataGrid-detailPanel": {
            bgcolor: "#f9f9f9",
          },
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this capital outlay item? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CapitalOutlayDataGrid;