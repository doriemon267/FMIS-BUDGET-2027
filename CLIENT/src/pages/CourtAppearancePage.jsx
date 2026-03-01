import React, { useEffect, useState, useCallback, useMemo } from "react";
import CustomPage from "../components/courtofappearance/CustomPage";
import api from "../config/api";
import { toast } from "react-hot-toast";
import {
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from "@mui/material";
import { useUser } from "../context/UserContext";
import { useRegion } from "../context/RegionContext";
import SaveIcon from "@mui/icons-material/Save";
import { MdCancel } from "react-icons/md";
import GetAppIcon from "@mui/icons-material/GetApp";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { alpha } from "@mui/material/styles";

const EmployeeCourtAppearancePage = () => {
  const { currentUser, assignmentLevel } = useUser();
  
  // Function to get hierarchical display
  const getHierarchicalDisplay = () => {
    const hierarchical = currentUser?.hierarchicalAccess || {};
    
    switch (assignmentLevel) {
      case 'DIVISION':
        // Division names are stored as strings in accessibleDivisions array
        return `Division: ${hierarchical.accessibleDivisions?.[0] || currentUser?.divisionName || 'N/A'}`;
      case 'DEPARTMENT':
        return `Department: ${hierarchical.accessibleDepartments?.[0]?.departmentName || 'N/A'}`;
      case 'REGION':
        return `Region: ${hierarchical.accessibleRegions?.[0]?.regionName || 'N/A'}`;
      case 'FULL':
        return 'Full Access: All Data';
      default:
        return `Region: N/A`;
    }
  };
  
  // Function to get hierarchical display color
  const getHierarchicalColor = () => {
    switch (assignmentLevel) {
      case 'DIVISION':
        return 'orange';
      case 'DEPARTMENT':
        return 'green';
      case 'REGION':
        return 'blue';
      case 'FULL':
        return 'purple';
      default:
        return 'gray';
    }
  };

  // Core data state
  const [settings, setSettings] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [inputErrors, setInputErrors] = useState({});

  // Enhanced UI state
  const [loading, setLoading] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // Default to false as per user preference
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [validationErrors, setValidationErrors] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

  // 1) Load active settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings/active");
        if (res.data) {
          setSettings(res.data);
        } else {
          toast.error("No active settings found.");
        }
      } catch (err) {
        toast.error("Failed to fetch settings.");
      }
    };
    fetchSettings();
  }, []);

  // Get region context
  const { activeRegion } = useRegion();
  
  // Enhanced data fetching with loading states and region filtering
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get the active region name
      const regionName = activeRegion?.name || activeRegion?.regionName;
      
      // Include region in the API request
      const res = await api.get("/court-appearances", { 
        params: { 
          limit: 10000,
          region: regionName || '' 
        } 
      });
      
      const data = res.data.data || [];
      
      // If data is empty and there's a message, show it to the user
      if (data.length === 0 && res.data.message) {
        toast(res.data.message, {
          icon: 'ℹ️',
          style: {
            borderRadius: '10px',
            background: '#3498db',
            color: '#fff',
          },
          duration: 4000,
        });
      }
      
      // Add isModified flag
      const dataWithFlag = data.map((row) => ({ ...row, isModified: false }));
      setTableData(dataWithFlag);
      setOriginalData(JSON.parse(JSON.stringify(dataWithFlag)));
      setHasUnsavedChanges(false);
      setValidationErrors({});
    
    } catch (err) {
      console.error("Error fetching court appearances:", err);
      toast.error("Failed to load court appearances.");
    } finally {
      setLoading(false);
    }
  }, [activeRegion]);

  // Export functionality
  const handleExportToCSV = useCallback(() => {
    if (!tableData || tableData.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    // Get hierarchical display for filename
    const hierarchicalDisplay = getHierarchicalDisplay();
    const filenameSafe = hierarchicalDisplay.replace(/[^a-zA-Z0-9-]/g, '-');

    const csvData = [
      ["Employee Number", "Full Name", "Position Title", "Office", "Responsibility Center", "No. of Court Appearances", "Court Appearance Amount", "Fiscal Year", "Budget Type"],
      ...tableData.map(row => [
        row.employeeNumber || '',
        row.employeeFullName || '',
        row.positionTitle || '',
        row.department || '',
        row.division || '',
        row.region || '',
        row.noOfCourtAppearance || 0,
        row.courtAppearanceAmount || 0,
        row.fiscalYear || '',
        row.budgetType || ''
      ])
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `court-appearances-${filenameSafe}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success(`Data exported successfully for ${hierarchicalDisplay}!`);
    setExportMenuAnchor(null);
  }, [tableData, activeRegion]);

  // Export court appearance PDF - server-side Muhammara
  const handleExportPDF = useCallback(async () => {
    try {
      if (!tableData || tableData.length === 0) {
        toast.error("No data available to export");
        return;
      }

      setLoading(true);
      toast.loading("Generating PDF...", { id: 'pdf-export' });

      // Build filters based on current data context
      const filters = {};
      if (activeRegion?.name || activeRegion?.regionName) {
        filters.region = activeRegion.name || activeRegion.regionName;
      }

      const response = await api.post(
        '/court-appearances/export-pdf',
        { filters },
        { responseType: 'blob' }
      );

      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `court-appearance-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF exported successfully", { id: 'pdf-export' });
      setExportMenuAnchor(null);
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(error.response?.data?.message || "Failed to export PDF", { id: 'pdf-export' });
    } finally {
      setLoading(false);
    }
  }, [tableData, activeRegion]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Refresh data when region changes
  useEffect(() => {
    if (activeRegion) {
      fetchData();
    }
  }, [activeRegion, fetchData]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSaveEnabled || !hasUnsavedChanges || saveStatus === 'saving') return;

    const autoSaveTimer = setTimeout(async () => {
      if (currentUser && settings) {
        setSaveStatus('saving');
        try {
          await handleSaveAll(true); // Pass true to indicate auto-save
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          setSaveStatus('saved');
          toast.success("Auto-saved successfully!");
        } catch (error) {
          console.error("Auto-save failed:", error);
          setSaveStatus('error');
          toast.error("Auto-save failed");
        }
      }
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [autoSaveEnabled, hasUnsavedChanges, saveStatus, currentUser, settings]);

  // Enhanced handleChange with validation and change tracking
  const handleChange = useCallback((employeeNumber, value) => {
    // Validation
    if (Number(value) < 0) {
      setInputErrors((prev) => ({ ...prev, [employeeNumber]: "Value cannot be negative" }));
      setValidationErrors((prev) => ({ ...prev, [employeeNumber]: "Value cannot be negative" }));
      return;
    }

    // Clear errors
    setInputErrors((prev) => {
      const copy = { ...prev };
      delete copy[employeeNumber];
      return copy;
    });
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[employeeNumber];
      return copy;
    });

    // Update data
    setTableData((prev) =>
      prev.map((row) => {
        if (row.employeeNumber === employeeNumber) {
          const num = Number(value);
          const courtRate = settings?.courtAppearance ?? settings?.compensationSettingsId?.courtAppearance ?? 0;
          const newRow = {
            ...row,
            noOfCourtAppearance: isNaN(num) ? 0 : num,
            courtAppearanceAmount: settings ? num * courtRate : 0,
            isModified: true,
          };
          return newRow;
        }
        return row;
      })
    );

    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  }, [settings]);

  // Enhanced save function with better error handling and validation
  const handleSaveAll = useCallback(async (isAutoSave = false) => {
    if (!settings) {
      toast.error("Settings not loaded.");
      return;
    }

    // Check for validation errors
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    const processBy = `${currentUser.FirstName} ${currentUser.LastName}`;
    const processDate = new Date();
    const fiscalYear = settings.fiscalYear;
    const budgetType = settings.budgetType;

    try {
      setSaveStatus('saving');
      const modified = tableData.filter((row) => row.isModified);

      if (modified.length === 0) {
        if (!isAutoSave) {
          toast("No changes to save.");
        }
        setSaveStatus('saved');
        return;
      }

      await Promise.all(
        modified.map((row) => {
          const payload = {
            employeeNumber: row.employeeNumber,
            employeeFullName: row.employeeFullName,
            positionTitle: row.positionTitle,
            department: row.department,
            division: row.division,
            region: row.region,
            noOfCourtAppearance: row.noOfCourtAppearance,
            courtAppearanceAmount: row.noOfCourtAppearance * (settings?.courtAppearance ?? settings?.compensationSettingsId?.courtAppearance ?? 0),
            processBy,
            processDate,
            fiscalYear,
            budgetType,
          };
          if ((row._id || "").includes("_temp")) {
            return api.post("/court-appearances", payload);
          } else {
            return api.put(`/court-appearances/${row._id}`, payload);
          }
        })
      );

      if (!isAutoSave) {
        toast.success(`Successfully saved ${modified.length} changes.`);
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      await fetchData();
    } catch (err) {
      console.error("Batch save error:", err);
      setSaveStatus('error');
      toast.error(err.response?.data?.message || "Error saving changes.");
    }
  }, [settings, validationErrors, currentUser, tableData, fetchData]);

  // Enhanced cancel function
  const handleCancel = useCallback(() => {
    setTableData(JSON.parse(JSON.stringify(originalData)));
    setInputErrors({});
    setValidationErrors({});
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
    setSelectedRows([]);
    toast("Changes discarded.");
  }, [originalData]);

  // Save status component
  const SaveStatusIndicator = () => {
    const getStatusColor = () => {
      switch (saveStatus) {
        case 'saving': return 'info';
        case 'saved': return 'success';
        case 'error': return 'error';
        default: return 'text.secondary';
      }
    };

    const getStatusText = () => {
      switch (saveStatus) {
        case 'saving': return 'Saving...';
        case 'saved': return lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Saved';
        case 'error': return 'Save failed';
        default: return hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved';
      }
    };

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {saveStatus === 'saving' && <CircularProgress size={16} />}
        <Typography
          variant="caption"
          color={`${getStatusColor()}.main`}
          sx={{ fontWeight: 'medium' }}
        >
          {getStatusText()}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={autoSaveEnabled}
              onChange={(e) => {
                setAutoSaveEnabled(e.target.checked);
                toast.success(e.target.checked ? "Auto-save enabled" : "Auto-save disabled");
              }}
              size="small"
            />
          }
          label="Auto-save"
          sx={{ ml: 2 }}
        />
      </Box>
    );
  };

  // Enhanced header buttons with more functionality
  const headerButtons = useMemo(() => (
    <Stack direction="row" spacing={1} alignItems="center">
      {/* Save Status Indicator */}
      <SaveStatusIndicator />

      {/* Hierarchical Level Indicator */}
      <Chip
        label={getHierarchicalDisplay()}
        size="small"
        variant="outlined"
        sx={{ 
          mr: 1,
          backgroundColor: getHierarchicalColor(),
          color: 'white',
          fontWeight: 'bold'
        }}
      />

      {/* Validation Errors Alert */}
      {Object.keys(validationErrors).length > 0 && (
        <Chip
          label={`${Object.keys(validationErrors).length} validation errors`}
          color="error"
          size="small"
          variant="outlined"
        />
      )}

      {/* Save Button */}
      <Tooltip title="Save all changes">
        <span>
          <Button
            onClick={() => handleSaveAll(false)}
            color="success"
            variant="contained"
            disabled={saveStatus === 'saving' || Object.keys(validationErrors).length > 0}
            sx={{
              background: "#009688",
              color: "#fff",
              "&:hover": {
                background: "#00796B",
                color: "#fff",
                textDecoration: "underline rgb(255, 255, 255)"
              },
              "&:disabled": {
                background: "#ccc",
                color: "#666"
              }
            }}
            startIcon={saveStatus === 'saving' ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </span>
      </Tooltip>

      {/* Cancel Button */}
      <Tooltip title="Discard all changes">
        <span>
          <Button
            onClick={handleCancel}
            color="warning"
            variant="contained"
            disabled={saveStatus === 'saving'}
            sx={{
              background: "#9E9E9E",
              color: "#fff",
              "&:hover": {
                background: "#757575",
                color: "#fff",
                textDecoration: "underline rgb(255, 255, 255)"
              },
            }}
            startIcon={<MdCancel />}
          >
            Cancel
          </Button>
        </span>
      </Tooltip>

      {/* Refresh Button */}
      <Tooltip title="Refresh data">
        <span>
          <IconButton
            onClick={fetchData}
            disabled={loading}
            sx={{
              color: 'white',
              '&:hover': { backgroundColor: alpha('#fff', 0.1) }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Export Menu */}
      <Tooltip title="Export options">
        <IconButton
          onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          sx={{
            color: 'white',
            '&:hover': { backgroundColor: alpha('#fff', 0.1) }
          }}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  ), [saveStatus, lastSaved, hasUnsavedChanges, autoSaveEnabled, validationErrors, loading, handleSaveAll, handleCancel, fetchData, activeRegion]);

  // 7) Table schema
  const schema = {
    employeeNumber: { type: "text", label: "Employee Number" },
    employeeFullName: { type: "text", label: "Full Name", show: true },
    positionTitle: { type: "text", label: "Position Title", show: true },
    department: { type: "text", label: "Department" },
    division: { type: "text", label: "Division" },
    region: { type: "text", label: "Region" },
    noOfCourtAppearance: {
      type: "number",
      label: "No. of Court Appearances",
      show: true,
      customRender: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="number"
            size="small"
            error={Boolean(inputErrors[row.employeeNumber])}
            helperText={inputErrors[row.employeeNumber]}
            slotProps={{
              htmlInput: {
                min: 0,
                step: 1
              }
            }}
            value={row.noOfCourtAppearance ?? ""}
            onChange={(e) =>
              handleChange(
                row.employeeNumber,
                e.target.value === "" ? 0 : e.target.value
              )
            }
            disabled={
              row.status === "Finalized"
            }
            sx={{
              minWidth: 120,
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#009688',
                },
              },
            }}
          />
          {row.isModified && (
            <Chip
              label="Modified"
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}
        </Box>
      ),
    },
    
    courtAppearanceAmount: {
      type: "number",
      label: "Court Appearance Amount",
      show: true,
      customRender: (row) =>
        `₱${(row.courtAppearanceAmount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
    },
    fiscalYear: { type: "text", label: "Fiscal Year" },
    budgetType: { type: "text", label: "Budget Type" },
  };

  // Get hierarchical display for page header
  const hierarchicalDisplay = getHierarchicalDisplay();
  
  return (
    <>
      <CustomPage
        dataListName="court-appearances"
        schema={schema}
        hasAdd={false}
        tableData={tableData}
        customAddElement={headerButtons}
        title={`Court Appearance Management - ${hierarchicalDisplay}`}
        description={`Manage court appearance records and allowances for LEGAL SERVICES personnel`}
      />

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={handleExportToCSV}>
          <ListItemIcon>
            <GetAppIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to CSV</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportPDF} disabled={loading}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to PDF</ListItemText>
        </MenuItem>
      </Menu>

      {/* Validation Errors Alert */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          severity="error"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1300,
            maxWidth: 400
          }}
          onClose={() => setValidationErrors({})}
        >
          <Typography variant="body2" fontWeight="bold">
            Validation Errors ({Object.keys(validationErrors).length}):
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.entries(validationErrors).map(([key, error]) => (
              <li key={key}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
    </>
  );
};

export default EmployeeCourtAppearancePage;
ExportPDF} disabled={loading}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export to PDF</ListItemText>
        </MenuItem>
      </Menu